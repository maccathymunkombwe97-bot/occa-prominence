import { Listing } from '../types';
import { getCompanyClientsCount } from './numberFormatter';

/**
 * ORGANIC ENGAGEMENT SIMULATION
 * ------------------------------------------------------------------------
 * Every number this file produces is a PURE function of stable inputs (a post's id
 * and createdAt, a company's name and its posts) plus the current wall-clock time.
 * Nothing here is stored and nothing is rolled once and cached — that's what makes it
 * safe: every device, every page, every viewer computes the exact same number at the
 * exact same moment, so likes/clients can never drift, desync, or get double-counted
 * between the server, localStorage, Google Sheets sync, or SmolDB.
 *
 * The displayed total for anything is always:
 *
 *     total = organic (simulated, time-driven, capped)  +  manual (real user actions)
 *
 * The manual component is the ONLY part that is ever persisted/incremented — via the
 * real Like/Save button for posts (Listing.manualLikes) and the real "Connect Client"
 * button for companies. The organic component just grows on its own as time passes.
 *
 * SHAPE — modeled on how engagement actually behaves on a real feed-based platform, at a
 *   normal, non-viral pace:
 *   1. Early traction: a modest share of a post's eventual likes lands over its first
 *      several days, as it gradually gets seen — a handful in the first hours, tens by
 *      the end of day one, growing steadily from there. Not a burst — a build-up.
 *   2. Long, slow tail: after that, growth doesn't stop — it just settles into a quiet,
 *      gradual trickle that continues for months, as the post keeps getting found via
 *      search, shares, and profile visits, still climbing slowly even a year in.
 *   Implemented as a two-timescale (bi-exponential) curve — a moderate-pace early
 *   component and a slow long-tail component blended per-post — which produces that
 *   gradual build-and-settle shape instead of a single uniform ramp or a sudden spike.
 *
 * PACE — real engagement isn't a flat drip; it rises and falls with when people are
 *   actually online. A day/night + weekday/weekend "activity rhythm" warps how fast
 *   real elapsed time counts toward the curve above (see `effectiveElapsedHours`),
 *   so growth visibly quickens during evenings/weekends and goes quiet overnight —
 *   the same rhythm real platforms' own engagement graphs show. The rhythm is always
 *   strictly positive, so this only ever changes the *pace* of growth, never its
 *   direction — the total is still strictly non-decreasing, always.
 *   The rhythm is computed in UTC, not local time, so every viewer — regardless of
 *   their own timezone — still lands on the exact same number at the exact same
 *   real-world moment, preserving cross-device consistency.
 */

const MS_PER_HOUR = 1000 * 60 * 60;
const HOURS_PER_WEEK = 168;

/** Hard ceiling for the simulated ("organic") portion of any single post's likes. */
export const POST_ORGANIC_LIKE_CAP = 2500;

/** How much slower the client generator runs versus the like generator, per the spec. */
const CLIENT_GROWTH_SLOWDOWN = 10;

/**
 * Global slowdown applied to the slow-tail phase of the like curve: stretches the
 * long trickle out in time so it reads as gradual and realistic (a post is still
 * visibly, slowly climbing toward its cap even a year in) rather than wrapping up
 * in weeks. The client-growth curve derives its own speed from the same blended
 * timescale (see CLIENT_GROWTH_SLOWDOWN above), so client growth stays exactly
 * 10x slower than likes either way.
 */
const LIKE_GROWTH_SLOWDOWN = 2.6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Deterministic 32-bit string hash (djb2 variant) — seeds the PRNGs below. */
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
}

/** Mulberry32 — small, fast, fully deterministic PRNG. Same seed = same sequence forever. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------------ */
/* HUMAN ACTIVITY RHYTHM — day/night + weekday/weekend pacing                */
/* ------------------------------------------------------------------------ */

/**
 * Hour-of-day activity multiplier (UTC hour 0-23) — quiet overnight, ramping up
 * through the morning, a small midday lull, and a clear evening peak before tapering
 * back down. This is the same rough silhouette real engagement-by-hour graphs show.
 */
const HOURLY_ACTIVITY: number[] = [
  0.2, 0.14, 0.1, 0.08, 0.08, 0.12, // 12am-5am UTC
  0.22, 0.42, 0.62, 0.78, 0.88, 0.95, // 6am-11am UTC
  1.05, 1.0, 0.9, 0.85, 0.9, 1.05, // 12pm-5pm UTC
  1.35, 1.55, 1.5, 1.3, 0.95, 0.55, // 6pm-11pm UTC
];

/** Day-of-week multiplier (0=Sun..6=Sat), layered on top of the hourly shape. */
const WEEKDAY_ACTIVITY: number[] = [1.08, 0.85, 0.88, 0.92, 0.98, 1.12, 1.18];

function activityWeightAt(msTimestamp: number): number {
  const d = new Date(msTimestamp);
  return HOURLY_ACTIVITY[d.getUTCHours()] * WEEKDAY_ACTIVITY[d.getUTCDay()];
}

// Precomputed once: total activity-weight across any full 7-day span is the same
// regardless of which day it starts on (it's a full cycle sum either way), so whole
// elapsed weeks can be converted to "effective hours" in O(1) instead of walking
// every hour of a post's entire lifetime.
const HOURLY_SUM = HOURLY_ACTIVITY.reduce((sum, h) => sum + h, 0);
const WEEK_TOTAL_ACTIVITY = WEEKDAY_ACTIVITY.reduce((sum, dayMult) => sum + dayMult * HOURLY_SUM, 0);
// Average multiplier across a week — used to normalize effective hours back onto the
// same real-time scale the rest of the app already tunes against, so a "flat" week
// of constant weight 1 still equals 168 effective hours, same as 168 real hours.
const AVERAGE_ACTIVITY = WEEK_TOTAL_ACTIVITY / HOURS_PER_WEEK;

/**
 * Converts real elapsed time into "effective" elapsed hours, warped by the repeating
 * day/night + weekday/weekend rhythm above — full stretches of high activity advance
 * the growth curve faster, quiet overnight/off-peak stretches advance it slower, just
 * like when real people are actually online. Always strictly increasing in real
 * elapsed time (every activity weight is > 0), so this only ever changes *pace*,
 * never direction. The remainder walk below is capped at 168 iterations regardless
 * of how old a post is, so this stays cheap enough to call on every render/live-tick.
 */
function effectiveElapsedHours(fromMs: number, toMs: number): number {
  if (toMs <= fromMs) return 0;

  const totalHours = (toMs - fromMs) / MS_PER_HOUR;
  const fullWeeks = Math.floor(totalHours / HOURS_PER_WEEK);
  let effective = fullWeeks * WEEK_TOTAL_ACTIVITY;

  const remainderStart = fromMs + fullWeeks * HOURS_PER_WEEK * MS_PER_HOUR;
  const remainderHours = Math.min(HOURS_PER_WEEK, (toMs - remainderStart) / MS_PER_HOUR);
  const fullRemainderHours = Math.floor(remainderHours);

  let cursor = remainderStart;
  for (let i = 0; i < fullRemainderHours; i++) {
    effective += activityWeightAt(cursor);
    cursor += MS_PER_HOUR;
  }
  const partialHour = remainderHours - fullRemainderHours;
  if (partialHour > 0) {
    effective += activityWeightAt(cursor) * partialHour;
  }

  return effective / AVERAGE_ACTIVITY;
}

/* ------------------------------------------------------------------------ */
/* POST LIKES                                                                */
/* ------------------------------------------------------------------------ */

interface PostGrowthProfile {
  /** This post's individual ceiling for simulated likes — always <= POST_ORGANIC_LIKE_CAP. */
  cap: number;
  /** Fraction of `cap` earned during the early-traction phase (the rest via the slow tail). */
  fastShare: number;
  /** Time constant (effective hours) of the early-traction phase. */
  tauFastHours: number;
  /** Time constant (effective hours) of the slow long-tail phase. */
  tauSlowHours: number;
}

/**
 * Every post gets its own randomized-but-stable growth profile, derived from its id, so
 * reloading the page never re-rolls it. Caps are skewed low (most posts land in the low
 * hundreds; a rare few "popular" posts approach the 2.5k ceiling). A modest share of a
 * post's traction (28-50%) builds up over its first ~1.5-8 effective days, with the
 * majority arriving via a long, slow tail (30-190 days of effective time, stretched
 * further by LIKE_GROWTH_SLOWDOWN) — a gradual, non-viral build rather than a burst.
 */
function getPostGrowthProfile(postId: string): PostGrowthProfile {
  const rng = mulberry32(hashString(`post-likes:${postId}`));
  const capRoll = rng();
  const fastShareRoll = rng();
  const fastSpeedRoll = rng();
  const slowSpeedRoll = rng();

  // Power curve skews rolls toward the low end, so big caps are rare/"standout" posts.
  const cap = Math.round(30 + (POST_ORGANIC_LIKE_CAP - 30) * Math.pow(capRoll, 2.3));

  const fastShare = 0.28 + fastShareRoll * 0.22; // 28-50% of the cap via early traction
  const tauFastHours = 36 + fastSpeedRoll * 156; // ~1.5-8 effective days
  const tauSlowHours = (30 + slowSpeedRoll * 160) * 24 * LIKE_GROWTH_SLOWDOWN; // ~30-190 days, stretched

  return { cap: clamp(cap, 5, POST_ORGANIC_LIKE_CAP), fastShare, tauFastHours, tauSlowHours };
}

/**
 * Simulated ("organic") likes a post has accrued between its creation and `now`.
 *
 * A two-timescale curve: a moderate-pace exponential approach to `fastShare` of the cap
 * (early traction, over the post's first several days) blended with a slow exponential
 * approach to the remainder (the long trickle afterward) — giving a gradual, believable
 * build rather than a sudden spike or a flat uniform ramp. Elapsed time is first run
 * through `effectiveElapsedHours` so the pace itself ebbs and flows with a realistic
 * day/night, weekday/weekend rhythm. Because both components are pure, strictly
 * increasing functions of that effective time, the result is strictly non-decreasing —
 * it only ever goes up as real time passes, never resets, and never exceeds its cap.
 */
export function getOrganicPostLikes(listing: Pick<Listing, 'id' | 'createdAt'>, now: number = Date.now()): number {
  if (!listing?.id || !listing.createdAt) return 0;
  const createdMs = new Date(listing.createdAt).getTime();
  if (isNaN(createdMs) || now <= createdMs) return 0;

  const { cap, fastShare, tauFastHours, tauSlowHours } = getPostGrowthProfile(listing.id);
  const effHours = effectiveElapsedHours(createdMs, now);

  const fast = 1 - Math.exp(-effHours / tauFastHours);
  const slow = 1 - Math.exp(-effHours / tauSlowHours);

  const raw = cap * (fastShare * fast + (1 - fastShare) * slow);
  return clamp(Math.floor(raw), 0, cap);
}

/**
 * Real, human-driven likes from the actual Like/Save button — the only persisted counter.
 * Falls back to the legacy `likesCount` field for older/imported records so historical
 * engagement isn't lost, but never lets the simulated engine write through that field.
 */
export function getManualPostLikes(listing: Pick<Listing, 'manualLikes' | 'likesCount'>): number {
  if (!listing) return 0;
  if (typeof listing.manualLikes === 'number' && !isNaN(listing.manualLikes)) {
    return Math.max(0, listing.manualLikes);
  }
  if (typeof listing.likesCount === 'number' && !isNaN(listing.likesCount)) {
    return Math.max(0, listing.likesCount);
  }
  return 0;
}

/**
 * The number to show in the UI: simulated organic growth + real user likes — floored by
 * whatever total has already been permanently recorded to the database for this post (see
 * `Listing.syncedLikes` and POST /api/listings/sync-likes). In normal operation the live
 * formula is already at or above that floor, since it's strictly non-decreasing; the floor
 * only matters as a safety net (e.g. immediately after a fresh cold start, or if the growth
 * formula's parameters ever change), guaranteeing a number that's already been shown and
 * recorded can never appear to go backwards.
 */
export function getTotalPostLikes(listing: Listing, now: number = Date.now()): number {
  const live = getOrganicPostLikes(listing, now) + getManualPostLikes(listing);
  const recorded =
    typeof listing?.syncedLikes === 'number' && !isNaN(listing.syncedLikes)
      ? Math.max(0, listing.syncedLikes)
      : 0;
  return Math.max(live, recorded);
}

/**
 * Snapshot of every listing's current on-screen total (see getTotalPostLikes), keyed by
 * listing id — exactly the shape POST /api/listings/sync-likes expects. Sending this
 * periodically is what makes the likes generator's output permanent: whatever a viewer is
 * shown gets written to the database instead of only ever existing as a recomputed formula.
 */
export function buildLikesSyncPayload(listings: Listing[], now: number = Date.now()): Record<string, number> {
  const payload: Record<string, number> = {};
  if (!Array.isArray(listings)) return payload;
  for (const listing of listings) {
    if (listing?.id) {
      payload[listing.id] = getTotalPostLikes(listing, now);
    }
  }
  return payload;
}

/* ------------------------------------------------------------------------ */
/* COMPANY CLIENTS                                                           */
/* ------------------------------------------------------------------------ */

/**
 * Each post also organically refers a small, slow trickle of "clients" to its company,
 * growing 10x slower than that same post's own like curve (per the spec: "the clients
 * generator must be 10x slower than the likes generator"). A company's total simulated
 * clients is the sum of every one of its posts' contributions.
 *
 * This design makes posting frequency drive client growth automatically and monotonically:
 * a company with more posts has more contribution curves running at once, so its aggregate
 * growth rate is visibly faster — e.g. a burst of 10 posts in a couple of days runs roughly
 * 2x as many concurrent contributions as a steady ~5-posts-in-2-days baseline, so overall
 * client growth for that window runs at ~2x speed, exactly as specced — without ever going
 * backwards, since every contribution only ever grows with real elapsed time.
 */
function getPostClientContribution(listing: Pick<Listing, 'id' | 'createdAt'>, now: number): number {
  if (!listing?.createdAt) return 0;
  const createdMs = new Date(listing.createdAt).getTime();
  if (isNaN(createdMs) || now <= createdMs) return 0;

  const { fastShare, tauFastHours, tauSlowHours } = getPostGrowthProfile(listing.id);
  const rng = mulberry32(hashString(`post-clients:${listing.id}`));
  const capRoll = rng();
  // A single post can eventually refer somewhere between ~4 and ~60 clients on its own.
  const perPostCap = 4 + 56 * Math.pow(capRoll, 2);

  // 10x slower than this exact post's own blended like-growth timescale.
  const blendedTauHours = (fastShare * tauFastHours + (1 - fastShare) * tauSlowHours) * CLIENT_GROWTH_SLOWDOWN;
  const effHours = effectiveElapsedHours(createdMs, now);
  return perPostCap * (1 - Math.exp(-effHours / blendedTauHours));
}

/**
 * Simulated ("organic") client count for a company, summed across all of its posts and
 * capped at the company's stable overall ceiling (150–8,500, from getCompanyClientsCount —
 * kept as-is so existing companies' general "scale" doesn't shift).
 */
export function getCompanyOrganicClients(companyName: string, listings: Listing[], now: number = Date.now()): number {
  if (!companyName || !Array.isArray(listings) || listings.length === 0) return 0;
  const companyListings = listings.filter((l) => l.companyName === companyName && l.createdAt);
  if (companyListings.length === 0) return 0;

  const overallCap = getCompanyClientsCount(companyName);
  const sum = companyListings.reduce((total, l) => total + getPostClientContribution(l, now), 0);

  return clamp(Math.floor(sum), 0, overallCap);
}

/**
 * Real client connections tied to this company. The app only tracks the current viewer's
 * own connections (a single "Connect Client" toggle), so this is 0 or 1.
 */
export function getManualCompanyClients(companyName: string, connectedClients: string[]): number {
  if (!companyName || !Array.isArray(connectedClients)) return 0;
  return connectedClients.includes(companyName) ? 1 : 0;
}

/** The number to show on a company's profile: simulated organic growth + any real connection. */
export function getCompanyTotalClients(
  companyName: string,
  listings: Listing[],
  connectedClients: string[],
  now: number = Date.now()
): number {
  return getCompanyOrganicClients(companyName, listings, now) + getManualCompanyClients(companyName, connectedClients);
}

/**
 * Sum of total (organic + manual) likes across every post by this company — this is what a
 * profile's aggregate "Likes" stat should show, rather than just whichever single post the
 * viewer happens to currently be looking at.
 */
export function getCompanyTotalLikes(companyName: string, listings: Listing[], now: number = Date.now()): number {
  if (!companyName || !Array.isArray(listings)) return 0;
  return listings
    .filter((l) => l.companyName === companyName)
    .reduce((sum, l) => sum + getTotalPostLikes(l, now), 0);
}
