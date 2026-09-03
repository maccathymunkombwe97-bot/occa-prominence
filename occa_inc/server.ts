// Must be the first import: several module-scope reads of process.env below
// (e.g. AUTH_SECRET) run before any request handler, so .env has to be loaded
// before them. dotenv was already a listed dependency but was never actually
// invoked anywhere, so .env was silently ignored for local dev until now.
// Harmless on Vercel — there's no .env file there, and Vercel injects env
// vars directly, so this line just no-ops in production.
import "dotenv/config";
import express from "express";
import path from "path";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import { INITIAL_LISTINGS } from "./src/data/mockListings.js";
import { Listing, UserProfile, AppSettings, Review, Conversation, Message } from "./src/types.js";
import { 
  initTursoTables, 
  fetchListingsFromTurso, 
  saveListingToTurso, 
  deleteListingFromTurso, 
  fetchProfileFromTurso, 
  saveProfileToTurso, 
  fetchSettingsFromTurso, 
  saveSettingsToTurso, 
  fetchSavedPostsFromTurso, 
  saveSavedPostsToTurso,
  saveAllListingsToTurso,
  getTursoConfig,
  fetchClientsFromTurso,
  saveClientsToTurso,
  fetchUsersFromTurso,
  saveUserToTurso,
  saveAllUsersToTurso,
  fetchReviewsFromTurso,
  saveReviewToTurso,
  saveAllReviewsToTurso,
  deleteReviewFromTurso,
  fetchConversationsFromTurso,
  saveConversationToTurso,
  saveAllConversationsToTurso,
  fetchMessagesFromTurso,
  saveMessageToTurso,
  saveAllMessagesToTurso,
  type ConversationRecord,
  type MessageRecord,
} from "./src/lib/tursoDb.js";
import { validatePhone, type PhoneValidation } from "./src/utils/phone.js";


const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// --- Password / security-answer hashing (Node's built-in scrypt, no extra dependency) ---
function hashSecret(plainText: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(plainText, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifySecret(plainText: string, stored: string): boolean {
  const [salt, key] = (stored || "").split(":");
  if (!salt || !key) return false;
  const derivedKey = crypto.scryptSync(plainText, salt, 64).toString("hex");
  const keyBuffer = Buffer.from(key, "hex");
  const derivedBuffer = Buffer.from(derivedKey, "hex");
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

// --- Per-device session tokens (stateless, HMAC-signed) ---
// IMPORTANT: set AUTH_TOKEN_SECRET in your environment (Vercel project settings too).
// Without it, this falls back to TURSO_AUTH_TOKEN, then to an insecure dev default —
// fine for local dev, but every serverless cold start with the insecure default would
// still validate fine since the fallback is deterministic, just not secret. Set a real
// AUTH_TOKEN_SECRET before shipping.
const AUTH_SECRET =
  process.env.AUTH_TOKEN_SECRET ||
  process.env.TURSO_AUTH_TOKEN ||
  "insecure-dev-secret-change-me";

if (!process.env.AUTH_TOKEN_SECRET && process.env.VERCEL) {
  console.warn(
    "[Auth] AUTH_TOKEN_SECRET is not set. Set it in your Vercel project's environment " +
    "variables so session tokens are signed with a real secret."
  );
}

function createAuthToken(phone: string): string {
  const payloadB64 = Buffer.from(JSON.stringify({ phone, iat: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

function verifyAuthToken(token: string): { phone: string } | null {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const expectedSig = crypto.createHmac("sha256", AUTH_SECRET).update(payloadB64).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (!payload.phone) return null;
    return { phone: payload.phone };
  } catch {
    return null;
  }
}

// Every request for personal data (profile/settings/saved posts) must carry
// "Authorization: Bearer <token>". This is what makes each device its own
// account instead of every device sharing one global in-memory profile.
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const session = token ? verifyAuthToken(token) : null;
  if (!session) {
    res.status(401).json({ success: false, error: "Not authenticated. Please sign in again." });
    return;
  }
  (req as any).userPhone = session.phone;
  next();
}

// Like requireAuth, but never rejects the request — attaches req.userPhone only if a
// valid token is present. Used by public endpoints that still want to personalize the
// response for a signed-in caller, e.g. flagging which review in a public list is theirs.
function optionalAuth(req: express.Request, _res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const session = token ? verifyAuthToken(token) : null;
  if (session) {
    (req as any).userPhone = session.phone;
  }
  next();
}

// Looks a user account up by every key shape a given real phone number could
// plausibly be stored under — the current canonical form plus older/legacy
// forms (see src/utils/phone.ts) — so an account registered before this
// normalization existed, or under a slightly different typed format, still
// authenticates correctly instead of intermittently failing.
function findUserRecord(validated: PhoneValidation): { key: string; user: any } | null {
  const candidates = [validated.storageKey, ...(validated.legacyKeys || [])].filter(Boolean) as string[];
  for (const key of candidates) {
    if (usersStore[key]) {
      return { key, user: usersStore[key] };
    }
  }
  return null;
}

// Strips the server-only authorPhone field before a review ever reaches a client, and
// flags whether the current viewer (if any) is the author — a UI hint only; actual
// edit/delete permission is enforced independently on the write endpoints below.
function toPublicReview(review: Review, viewerPhone?: string) {
  const { authorPhone, ...rest } = review;
  return { ...rest, isOwn: !!viewerPhone && authorPhone === viewerPhone };
}

// Strips the server-only posterPhone field before a listing ever reaches a client, and
// flags whether the current viewer (if any) owns it — a UI hint that drives "My Posts"
// client-side. Actual edit/delete/boost permission is enforced independently on the
// write endpoints below by matching posterPhone against the requester's authenticated
// phone — this function only controls what's visible in read responses.
function toPublicListing(listing: Listing, viewerPhone?: string): Listing {
  const { posterPhone, ...rest } = listing;
  return { ...rest, isOwnPost: !!viewerPhone && posterPhone === viewerPhone };
}

// Looks up an account's public display info (name/photo/company) by phone, with a safe
// fallback for the rare case a conversation outlives the account record it points to.
function getPublicUserInfo(phone: string): { name: string; profilePicUrl?: string; companyName?: string } {
  const account = usersStore[phone];
  const profile = account?.profile;
  return {
    name: (profile?.name && String(profile.name).trim()) || "Occa User",
    profilePicUrl: profile?.profilePicUrl || undefined,
    companyName: profile?.companyName || undefined,
  };
}

// Turns a server-side conversation record (which carries both participants' phones)
// into the client-safe shape: only the OTHER participant's public info is exposed, never
// either phone number, and unreadCount/lastMessageIsMine are computed relative to whoever
// is asking. This is the messaging equivalent of toPublicListing/toPublicReview above.
//
// `precomputedUnread`, when provided, skips this conversation's own pass over
// messagesStore — used by GET /api/conversations (see computeUnreadCountsByConversation
// below) so listing N conversations costs one pass over messagesStore, not N passes.
function toPublicConversation(conv: ConversationRecord, viewerPhone: string, precomputedUnread?: number): Conversation {
  const otherPhone = conv.participantPhones.find((p) => p !== viewerPhone) || conv.participantPhones[0];
  const unreadCount =
    precomputedUnread !== undefined
      ? precomputedUnread
      : messagesStore.filter(
          (m) =>
            m.conversationId === conv.id &&
            m.senderPhone !== viewerPhone &&
            (!conv.lastReadAt?.[viewerPhone] || m.createdAt > conv.lastReadAt[viewerPhone])
        ).length;

  return {
    id: conv.id,
    otherParticipant: getPublicUserInfo(otherPhone),
    listingId: conv.listingId,
    listingTitle: conv.listingTitle,
    lastMessageText: conv.lastMessageText,
    lastMessageAt: conv.lastMessageAt,
    lastMessageIsMine: !!conv.lastMessageSenderPhone && conv.lastMessageSenderPhone === viewerPhone,
    unreadCount,
    createdAt: conv.createdAt,
  };
}

// Computes unread counts for a batch of conversations in a single pass over
// messagesStore, keyed by conversation id — O(messages) instead of the O(conversations *
// messages) that calling toPublicConversation once per conversation would cost when
// listing a whole chat list (GET /api/conversations).
function computeUnreadCountsByConversation(convs: ConversationRecord[], viewerPhone: string): Record<string, number> {
  const lastReadByConv = new Map(convs.map((c) => [c.id, c.lastReadAt?.[viewerPhone]]));
  const counts: Record<string, number> = {};
  for (const m of messagesStore) {
    if (!lastReadByConv.has(m.conversationId)) continue; // not one of the conversations we're counting for
    if (m.senderPhone === viewerPhone) continue;
    const lastRead = lastReadByConv.get(m.conversationId);
    if (lastRead && m.createdAt <= lastRead) continue;
    counts[m.conversationId] = (counts[m.conversationId] || 0) + 1;
  }
  return counts;
}

// Strips the server-only senderPhone before a message ever reaches a client, replacing
// it with the sender's public display info and an `isMine` flag relative to the viewer.
function toPublicMessage(msg: MessageRecord, viewerPhone: string): Message {
  const sender = getPublicUserInfo(msg.senderPhone);
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    text: msg.text,
    createdAt: msg.createdAt,
    isMine: msg.senderPhone === viewerPhone,
    senderName: sender.name,
    senderProfilePicUrl: sender.profilePicUrl,
  };
}
// In-memory request-serving cache only — NOT a persistence layer. It exists
// so a warm serverless instance can answer reads without round-tripping to
// Turso every time. It starts from these bare defaults on every cold start
// and is immediately overwritten by initDatabaseAndHydrate() below, which
// pulls the real state from Turso. Turso is the only source of truth.
let listingsStore: Listing[] = INITIAL_LISTINGS;
let profileStore: UserProfile | null = null;
let savedPostsStore: string[] = [];
let clientsStore: string[] = [];
let usersStore: Record<string, any> = {};
let reviewsStore: Review[] = [];
let conversationsStore: ConversationRecord[] = [];
let messagesStore: MessageRecord[] = [];
let settingsStore: AppSettings = {
  defaultViewMode: "cards",
  notificationsEnabled: true,
  dealAlertsEnabled: true,
  autoRotateCarousel: true,
  darkTheme: true,
  userTown: "Lusaka",
  userCountry: "Zambia",
  regionFilter: "all",
  enablePersonalizedFeed: true,
};

// Auto-hydrate latest content from the Turso database on cold start
async function initDatabaseAndHydrate() {
  try {
    console.log("[Turso] Initializing database tables...");
    const initialized = await initTursoTables();

    if (!initialized) {
      console.warn("[Turso] FLAG: could not connect/initialize Turso at startup — running on the local (ephemeral) store only until this succeeds.");
    }

    if (initialized) {
      // 1. Try loading listings from Turso
      const tursoListings = await fetchListingsFromTurso();
      if (tursoListings && tursoListings.length > 0) {
        console.log(`[Turso Hydration] Loaded ${tursoListings.length} posts from Turso database!`);
        listingsStore = tursoListings;
      } else {
        // Seed initial listings to Turso if empty
        console.log(`[Turso Seeding] Seeding initial ${listingsStore.length} posts to Turso...`);
        await saveAllListingsToTurso(listingsStore);
      }

      // Merge INITIAL_LISTINGS into listingsStore if some are missing (like newly added mock ones)
      let mergedListings = false;
      for (const initial of INITIAL_LISTINGS) {
        if (!listingsStore.some(l => l.id === initial.id)) {
          listingsStore.push(initial);
          mergedListings = true;
        }
      }
      if (mergedListings) {
        console.log(`[Turso Merge] Merged missing listings into active store`);
        await saveAllListingsToTurso(listingsStore);
      }

      // Ensure every listing has a manualLikes counter to track REAL user like/save actions.
      // Simulated "organic" growth is still computed on the fly by src/utils/organicGrowth.ts
      // for the live-updating number — it's never written straight into manualLikes, so it
      // can't drift or get double-counted with real likes. A periodic snapshot of the total
      // (organic + manual) IS persisted separately, into `syncedLikes`, via POST
      // /api/listings/sync-likes — see that route for details.
      let updatedListings = false;
      listingsStore = listingsStore.map(listing => {
        if (typeof listing.manualLikes !== 'number') {
          updatedListings = true;
          // Migrate any legacy combined counter into manualLikes so real history isn't lost.
          const legacy = typeof listing.likesCount === 'number' ? listing.likesCount : 0;
          return { ...listing, manualLikes: legacy };
        }
        return listing;
      });
      if (updatedListings || mergedListings) {
      }

      // 2. Try loading profile from Turso
      const tursoProfile = await fetchProfileFromTurso();
      if (tursoProfile) {
        profileStore = tursoProfile;
      } else if (profileStore) {
        await saveProfileToTurso(profileStore);
      }

      // 3. Try loading settings from Turso
      const tursoSettings = await fetchSettingsFromTurso();
      if (tursoSettings) {
        settingsStore = tursoSettings;
      } else if (settingsStore) {
        await saveSettingsToTurso(settingsStore);
      }

      // 4. Try loading saved posts from Turso
      const tursoSaved = await fetchSavedPostsFromTurso();
      if (tursoSaved && tursoSaved.length > 0) {
        savedPostsStore = tursoSaved;
      } else if (savedPostsStore.length > 0) {
        await saveSavedPostsToTurso(savedPostsStore);
      }

      // 5. Try loading client connections from Turso
      const tursoClients = await fetchClientsFromTurso();
      if (tursoClients && tursoClients.length > 0) {
        clientsStore = tursoClients;
      } else if (clientsStore.length > 0) {
        await saveClientsToTurso(clientsStore);
      }

      // 6. Try loading registered user accounts from Turso. This is
      // critical for correctness: /tmp storage on serverless hosts is
      // ephemeral per-instance, so without this, accounts created via
      // /api/auth/register can "disappear" the moment a request lands on
      // a different serverless instance than the one that registered them.
      const tursoUsers = await fetchUsersFromTurso();
      if (tursoUsers && Object.keys(tursoUsers).length > 0) {
        usersStore = tursoUsers;
      } else if (Object.keys(usersStore).length > 0) {
        await saveAllUsersToTurso(usersStore);
      }

      // 7. Try loading company reviews from Turso
      const tursoReviews = await fetchReviewsFromTurso();
      if (tursoReviews && tursoReviews.length > 0) {
        reviewsStore = tursoReviews;
      } else if (reviewsStore.length > 0) {
        await saveAllReviewsToTurso(reviewsStore);
      }

      // 8. Try loading in-app message conversations from Turso
      const tursoConversations = await fetchConversationsFromTurso();
      if (tursoConversations && tursoConversations.length > 0) {
        conversationsStore = tursoConversations;
      } else if (conversationsStore.length > 0) {
        await saveAllConversationsToTurso(conversationsStore);
      }

      // 9. Try loading in-app messages from Turso
      const tursoMessages = await fetchMessagesFromTurso();
      if (tursoMessages && tursoMessages.length > 0) {
        messagesStore = tursoMessages;
      } else if (messagesStore.length > 0) {
        await saveAllMessagesToTurso(messagesStore);
      }
    }
  } catch (err: any) {
    console.warn("[Turso Hydration] Cold-start sync notice:", err.message || err);
  }
}

const hydrationReady = initDatabaseAndHydrate();

// Every request must wait for the initial Turso hydration above to
// finish before touching listingsStore/profileStore/usersStore/etc. Without
// this, a cold-start request could be answered (and the function frozen
// right after, per Vercel's execution model) before the async Turso fetch
// resolves — silently serving empty/stale data instead of what's really in
// the database. Awaiting an already-resolved promise on warm invocations is
// effectively free, so this costs nothing once a container has hydrated once.
app.use(async (_req, _res, next) => {
  try {
    await hydrationReady;
  } catch {
    // initDatabaseAndHydrate logs its own errors; let requests proceed with
    // whatever state is available rather than hang indefinitely.
  }
  next();
});

// Initialize Gemini Client
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// --- API ROUTES ---

// Health check
app.get("/api/health", (_req, res) => {
  const { url } = getTursoConfig();
  res.json({
    status: "ok",
    app: "Occa Prominence Server",
    database: `Turso libSQL Active (${url})`,
    timestamp: new Date().toISOString(),
    totalListings: listingsStore.length,
  });
});

// Turso Connection Status Endpoint
app.get("/api/turso/status", async (_req, res) => {
  try {
    const { url } = getTursoConfig();
    const tursoListings = await fetchListingsFromTurso();
    res.json({
      success: true,
      tursoUrl: url,
      connected: true,
      totalTursoListings: tursoListings.length,
      totalMemoryListings: listingsStore.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, connected: false, error: err.message });
  }
});

// Listings Endpoints
app.get("/api/listings", optionalAuth, (req, res) => {
  const viewerPhone = (req as any).userPhone as string | undefined;
  res.json({
    success: true,
    listings: listingsStore.map((l) => toPublicListing(l, viewerPhone)),
  });
});

app.post("/api/listings", requireAuth, async (req, res) => {
  try {
    const phone = (req as any).userPhone as string;
    const listingData = req.body;
    if (!listingData.title || !listingData.companyName || !listingData.category) {
      res.status(400).json({ success: false, error: "Missing required fields: title, companyName, category" });
      return;
    }

    const newListing: Listing = {
      ...listingData,
      id: listingData.id || `occ-custom-${Date.now()}`,
      createdAt: listingData.createdAt || new Date().toISOString(),
      manualLikes: typeof listingData.manualLikes === 'number' ? listingData.manualLikes : 0,
      images: Array.isArray(listingData.images) && listingData.images.length > 0 
        ? listingData.images 
        : ["https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80"],
      // Always the authenticated caller's own phone — never trust a client-supplied
      // value here, or any account could post listings that show up as another
      // account's "My Posts".
      posterPhone: phone,
    };

    listingsStore = [newListing, ...listingsStore];
    // Must be awaited: on Vercel, the serverless function is frozen right after
    // res.json() is sent, killing any still-pending network call. Without this
    // await, the write to Turso never actually completes.
    const syncedToTurso = await saveListingToTurso(newListing);
    if (!syncedToTurso) {
      console.warn(`[Turso] FLAG: listing '${newListing.id}' was NOT persisted to Turso — it only exists in the local (ephemeral) store.`);
    }


    res.json({ success: true, listing: toPublicListing(newListing, phone), syncedToTurso });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Permanently records the like counts currently being shown on posts (the organic-growth
// engine's live number, plus real manual likes — see src/utils/organicGrowth.ts) into the
// database. Called periodically by the client with a snapshot of what's on screen. Each
// listing's stored `syncedLikes` can only ever move up: the server takes the max of what's
// already recorded and what's coming in, so a slow/duplicate/out-of-order request can never
// erase a higher number that was already persisted, and posts that haven't grown since the
// last sync are skipped entirely (no wasted writes).
app.post("/api/listings/sync-likes", async (req, res) => {
  try {
    const counts = req.body?.counts;
    if (!counts || typeof counts !== "object" || Array.isArray(counts)) {
      res.status(400).json({ success: false, error: "Expected { counts: { [listingId]: number } }" });
      return;
    }

    const updated: string[] = [];
    for (const [id, rawCount] of Object.entries(counts)) {
      const count = Number(rawCount);
      // Sanity bounds guard the permanent record against a malformed or malicious payload —
      // never negative, never absurdly larger than anything the growth engine could produce.
      if (!Number.isFinite(count) || count < 0 || count > 1_000_000) continue;

      const index = listingsStore.findIndex((item) => item.id === id);
      if (index === -1) continue;

      const current = listingsStore[index].syncedLikes ?? 0;
      const next = Math.max(current, Math.floor(count));
      if (next === current) continue; // already recorded at least this many — nothing to do

      listingsStore[index] = { ...listingsStore[index], syncedLikes: next };
      const synced = await saveListingToTurso(listingsStore[index]);
      if (!synced) {
        console.warn(`[Turso] FLAG: syncedLikes update for listing '${id}' was NOT persisted to Turso.`);
      }
      updated.push(id);
    }

    res.json({ success: true, updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/listings/:id", requireAuth, async (req, res) => {
  try {
    const phone = (req as any).userPhone as string;
    const { id } = req.params;
    const existing = listingsStore.find((item) => item.id === id);
    if (!existing) {
      res.status(404).json({ success: false, error: "Listing not found" });
      return;
    }
    // Only the account that created a listing may delete it. Older listings created
    // before posterPhone existed have no owner on record, so they're left undeletable
    // via this endpoint rather than allowing any account to claim/delete them.
    if (existing.posterPhone !== phone) {
      res.status(403).json({ success: false, error: "You can only delete your own posts." });
      return;
    }
    listingsStore = listingsStore.filter((item) => item.id !== id);
    const syncedToTurso = await deleteListingFromTurso(id);
    if (!syncedToTurso) {
      console.warn(`[Turso] FLAG: delete of listing '${id}' did NOT reach Turso — it may still exist there.`);
    }
    res.json({ success: true, message: `Listing ${id} deleted`, syncedToTurso });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Boost Reach Endpoint
app.post("/api/listings/:id/boost", requireAuth, async (req, res) => {
  try {
    const phone = (req as any).userPhone as string;
    const { id } = req.params;
    const { boostPackage, days } = req.body;

    const index = listingsStore.findIndex((item) => item.id === id);
    if (index === -1) {
      res.status(404).json({ success: false, error: "Listing not found" });
      return;
    }
    if (listingsStore[index].posterPhone !== phone) {
      res.status(403).json({ success: false, error: "You can only boost your own posts." });
      return;
    }

    const durationDays = typeof days === "number" ? days : 7;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + durationDays);

    listingsStore[index] = {
      ...listingsStore[index],
      isBoosted: true,
      boostPackage: boostPackage || "$0.99 - 7 days",
      boostedUntil: expiryDate.toISOString(),
    };

    const syncedToTurso = await saveListingToTurso(listingsStore[index]);
    if (!syncedToTurso) {
      console.warn(`[Turso] FLAG: boost on listing '${id}' was NOT persisted to Turso.`);
    }

    res.json({
      success: true,
      listing: toPublicListing(listingsStore[index], phone),
      message: `Listing boosted with ${boostPackage || "$0.99 - 7 days"}`,
      syncedToTurso,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Profile Endpoints — scoped to the authenticated device's account, not a shared global
app.get("/api/profile", requireAuth, (req, res) => {
  const phone = (req as any).userPhone as string;
  const user = usersStore[phone];
  const profile = user?.profile || null;
  res.json({
    success: true,
    profile,
    isVerified: !!profile?.isBusinessAccount,
  });
});

app.post("/api/profile", requireAuth, async (req, res) => {
  try {
    const phone = (req as any).userPhone as string;
    if (!usersStore[phone]) {
      res.status(404).json({ success: false, error: "Account not found." });
      return;
    }

    const body = { ...req.body };
    if (body.whatsapp !== undefined && String(body.whatsapp).trim()) {
      const validatedWhatsapp = validatePhone(String(body.whatsapp));
      if (!validatedWhatsapp.valid) {
        res.status(400).json({ success: false, error: validatedWhatsapp.error || "Invalid WhatsApp number." });
        return;
      }
      body.whatsapp = validatedWhatsapp.display;
    }

    const updatedProfile: UserProfile = {
      ...body,
      updatedAt: new Date().toISOString(),
    };

    usersStore[phone].profile = updatedProfile;
    const syncedToTurso = await saveUserToTurso(phone, usersStore[phone]);
    if (!syncedToTurso) {
      console.warn(`[Turso] FLAG: profile update for user '${phone}' was NOT persisted to Turso.`);
    }


    res.json({ success: true, profile: updatedProfile, isVerified: !!updatedProfile?.isBusinessAccount, syncedToTurso });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Stateless tokens can't be revoked server-side, so logout is just an
// acknowledgement — the client deletes its own token, which is what actually
// signs the device out.
app.post("/api/profile/logout", (_req, res) => {
  res.json({ success: true, message: "Logged out successfully from session" });
});

// --- NEW PHONE & PASSWORD & SECURITY QUESTION AUTHENTICATION ENDPOINTS ---

// Register Station / Account
app.post("/api/auth/register", async (req, res) => {
  try {
    const { phone, password, securityQuestion, securityAnswer, name, bio, profilePicUrl } = req.body;
    if (!phone || !password || !securityQuestion || !securityAnswer) {
      res.status(400).json({ success: false, error: "All registration fields are required." });
      return;
    }
    if (!name || !String(name).trim()) {
      res.status(400).json({ success: false, error: "Your name is required." });
      return;
    }
    if (!profilePicUrl) {
      res.status(400).json({ success: false, error: "A profile picture is required." });
      return;
    }

    // Validate against real E.164/ITU numbering-plan data: rejects made-up
    // country codes (e.g. "+103", which isn't assigned to any country) and
    // real country codes followed by the wrong digit count for that country
    // (e.g. keeping a local leading 0 after the code — "+260 0977123456").
    // A number that fails this check isn't reliably reachable on WhatsApp.
    const validated = validatePhone(phone);
    if (!validated.valid || !validated.storageKey) {
      res.status(400).json({ success: false, error: validated.error || "Invalid phone number formatting." });
      return;
    }
    const { storageKey, display, legacyKeys } = validated;

    // Check the canonical key AND every legacy shape this same real number
    // could already be stored under, so the same phone can't register twice
    // just by being typed differently.
    const duplicateKey = [storageKey, ...(legacyKeys || [])].find((k) => usersStore[k]);
    if (duplicateKey) {
      res.status(400).json({ success: false, error: "This phone number is already registered." });
      return;
    }

    // Initialize default profile: basic info required at signup,
    // business/posting fields stay empty until the user upgrades their account.
    const defaultProfile = {
      name: String(name).trim(),
      bio: bio ? String(bio).trim() : "",
      profilePicUrl,
      isBusinessAccount: false,
      companyName: "",
      businessType: "",
      email: "",
      whatsapp: display, // canonical, dial-able international format
      businessDetails: "",
      businessLogoUrl: "",
      verificationDocs: [],
    };

    // Store hashed credentials — never plaintext.
    usersStore[storageKey] = {
      phone: display,
      password: hashSecret(password.trim()),
      securityQuestion: securityQuestion.trim(),
      securityAnswer: hashSecret(securityAnswer.trim().toLowerCase()),
      profile: defaultProfile,
      settings: null, // null = use client-side defaults until this user saves their own
      savedPostIds: [],
      createdAt: new Date().toISOString(),
    };

    const syncedToTurso = await saveUserToTurso(storageKey, usersStore[storageKey]);
    if (!syncedToTurso) {
      console.warn(`[Turso] FLAG: new registration for '${storageKey}' was NOT persisted to Turso — account only exists in the local (ephemeral) store.`);
    }

    // Issue a token scoped to THIS device/session. Each device that logs in
    // or registers gets its own token, so opening the app elsewhere no longer
    // shows someone else's account.
    const token = createAuthToken(storageKey);

    res.json({
      success: true,
      profile: defaultProfile,
      token,
      message: "Station registered successfully.",
      syncedToTurso,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Login Station / Account
app.post("/api/auth/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      res.status(400).json({ success: false, error: "Phone number and password are required." });
      return;
    }

    const validated = validatePhone(phone);
    if (!validated.valid || !validated.storageKey) {
      res.status(400).json({ success: false, error: validated.error || "Invalid phone number formatting." });
      return;
    }

    // Try the canonical key first, then fall back to legacy key shapes —
    // this is what fixes accounts that intermittently failed to authenticate
    // because they were registered under a differently-formatted version of
    // the exact same real phone number (e.g. with vs without a country code).
    const found = findUserRecord(validated);
    if (!found) {
      res.status(401).json({ success: false, error: "No profile found matching this phone number." });
      return;
    }
    const { key: matchedKey, user } = found;

    if (!verifySecret(password.trim(), user.password)) {
      res.status(401).json({ success: false, error: "Incorrect security password. Access Denied." });
      return;
    }

    // Self-heal: alias the record under the canonical key so future logins
    // for this number hit it directly, without disturbing the old key.
    if (matchedKey !== validated.storageKey && !usersStore[validated.storageKey]) {
      usersStore[validated.storageKey] = user;
      await saveUserToTurso(validated.storageKey, user);
    }

    const profile = user.profile || {
      name: "",
      companyName: "",
      email: "",
      whatsapp: validated.display,
      businessDetails: "",
      profilePicUrl: "",
      verificationDocs: [],
    };
    const token = createAuthToken(validated.storageKey);

    res.json({
      success: true,
      profile,
      token,
      message: "Logged in successfully."
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Retrieve Security Question
app.post("/api/auth/forgot-password/question", (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      res.status(400).json({ success: false, error: "Phone number is required." });
      return;
    }

    const validated = validatePhone(phone);
    if (!validated.valid) {
      res.status(400).json({ success: false, error: validated.error || "Invalid phone number formatting." });
      return;
    }

    const found = findUserRecord(validated);
    if (!found) {
      res.status(404).json({ success: false, error: "This phone number is not registered." });
      return;
    }

    res.json({
      success: true,
      question: found.user.securityQuestion
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify Answer and Reset Password
app.post("/api/auth/forgot-password/verify", async (req, res) => {
  try {
    const { phone, answer, newPassword } = req.body;
    if (!phone || !answer || !newPassword) {
      res.status(400).json({ success: false, error: "All verification fields are required." });
      return;
    }

    const validated = validatePhone(phone);
    if (!validated.valid || !validated.storageKey) {
      res.status(400).json({ success: false, error: validated.error || "Invalid phone number formatting." });
      return;
    }

    const found = findUserRecord(validated);
    if (!found) {
      res.status(404).json({ success: false, error: "This phone number is not registered." });
      return;
    }
    const { user } = found;

    if (!verifySecret(answer.trim().toLowerCase(), user.securityAnswer)) {
      res.status(401).json({ success: false, error: "Security question answer is incorrect. Access Denied." });
      return;
    }

    // Update password (hashed) and alias under the canonical key.
    user.password = hashSecret(newPassword.trim());
    usersStore[validated.storageKey] = user;
    const syncedToTurso = await saveUserToTurso(validated.storageKey, user);
    if (!syncedToTurso) {
      console.warn(`[Turso] FLAG: password reset for '${validated.storageKey}' was NOT persisted to Turso.`);
    }

    const profile = user.profile || {
      name: "",
      companyName: "",
      email: "",
      whatsapp: validated.display,
      businessDetails: "",
      profilePicUrl: "",
      verificationDocs: [],
    };
    const token = createAuthToken(validated.storageKey);

    res.json({
      success: true,
      profile,
      token,
      message: "Password successfully updated! Secure login active.",
      syncedToTurso,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ImgBB Direct Image Storage Upload Endpoint
app.post("/api/upload/imgbb", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      res.status(400).json({ success: false, error: "Image data is required" });
      return;
    }

    // Base64 string length approximates bytes * 4/3. Guard well under
    // Vercel's ~4.5MB platform request cap so we return a clean JSON error
    // instead of letting the platform reject the request with a non-JSON body.
    const approxBytes = (image.length * 3) / 4;
    if (approxBytes > 4 * 1024 * 1024) {
      res.status(413).json({
        success: false,
        error: "Image is too large. Please use a smaller photo (under ~4MB).",
      });
      return;
    }

    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        success: false,
        error: "Image hosting is not configured on the server (missing IMGBB_API_KEY).",
      });
      return;
    }

    const bodyParams = new URLSearchParams();
    bodyParams.append("image", cleanBase64);

    const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    const data = await imgbbRes.json();
    if (data.success && data.data) {
      // Direct CDN image URL (i.ibb.co) that bypasses viewer pages with ads
      const directUrl = data.data.display_url || data.data.url || data.data.image?.url;
      res.json({
        success: true,
        url: directUrl,
        displayUrl: data.data.display_url,
        width: data.data.width,
        height: data.data.height,
        deleteUrl: data.data.delete_url,
      });
    } else {
      res.status(400).json({
        success: false,
        error: data.error?.message || "ImgBB upload failed",
      });
    }
  } catch (err: any) {
    console.error("ImgBB upload error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Saved Posts Endpoints
app.get("/api/saved", requireAuth, (req, res) => {
  const phone = (req as any).userPhone as string;
  const savedPostIds: string[] = usersStore[phone]?.savedPostIds || [];
  res.json({ success: true, savedPostIds });
});

app.post("/api/saved", requireAuth, async (req, res) => {
  const phone = (req as any).userPhone as string;
  if (!usersStore[phone]) {
    res.status(404).json({ success: false, error: "Account not found." });
    return;
  }
  const { listingId } = req.body;
  if (!listingId) {
    res.status(400).json({ success: false, error: "Missing listingId" });
    return;
  }

  let savedPostIds: string[] = usersStore[phone].savedPostIds || [];
  let increment = true;
  if (savedPostIds.includes(listingId)) {
    savedPostIds = savedPostIds.filter((id) => id !== listingId);
    increment = false;
  } else {
    savedPostIds = [...savedPostIds, listingId];
  }
  usersStore[phone].savedPostIds = savedPostIds;
  let syncedToTurso = await saveUserToTurso(phone, usersStore[phone]);
  if (!syncedToTurso) {
    console.warn(`[Turso] FLAG: saved-posts update for '${phone}' was NOT persisted to Turso.`);
  }

  // Update listing manualLikes to track this REAL like/save action.
  // (Simulated organic growth is computed on the fly on the client — see organicGrowth.ts —
  // so only the real, human-driven count is ever persisted here.)
  const listingIdx = listingsStore.findIndex((l) => l.id === listingId);
  if (listingIdx !== -1) {
    const curLikes = listingsStore[listingIdx].manualLikes ?? listingsStore[listingIdx].likesCount ?? 0;
    listingsStore[listingIdx] = {
      ...listingsStore[listingIdx],
      manualLikes: increment ? curLikes + 1 : Math.max(0, curLikes - 1)
    };
    const listingSynced = await saveListingToTurso(listingsStore[listingIdx]);
    if (!listingSynced) {
      console.warn(`[Turso] FLAG: like-count update for listing '${listingId}' was NOT persisted to Turso.`);
    }
    syncedToTurso = syncedToTurso && listingSynced;
  }

  res.json({ success: true, savedPostIds, listings: listingsStore, syncedToTurso });
});

app.delete("/api/saved", requireAuth, async (req, res) => {
  const phone = (req as any).userPhone as string;
  let syncedToTurso = true;
  if (usersStore[phone]) {
    usersStore[phone].savedPostIds = [];
    syncedToTurso = await saveUserToTurso(phone, usersStore[phone]);
    if (!syncedToTurso) {
      console.warn(`[Turso] FLAG: clearing saved posts for '${phone}' was NOT persisted to Turso.`);
    }
  }
  res.json({ success: true, savedPostIds: [], syncedToTurso });
});

// Client Connections Endpoints — scoped to the authenticated device's account, same
// pattern as /api/saved above. Previously these read/wrote a single global
// `clientsStore` shared by every account on the server, which meant one user's
// "Connect Client" taps were visible to (and toggleable by) every other user — the
// most severe form of cross-account bleed in the app. Each account now has its own
// `clients` list, exactly like it already has its own `savedPostIds`.
app.get("/api/clients", requireAuth, (req, res) => {
  const phone = (req as any).userPhone as string;
  const clients: string[] = usersStore[phone]?.clients || [];
  res.json({ success: true, clients });
});

app.post("/api/clients", requireAuth, async (req, res) => {
  const phone = (req as any).userPhone as string;
  if (!usersStore[phone]) {
    res.status(404).json({ success: false, error: "Account not found." });
    return;
  }
  const { companyName } = req.body;
  if (!companyName) {
    res.status(400).json({ success: false, error: "Missing companyName" });
    return;
  }

  let clients: string[] = usersStore[phone].clients || [];
  if (clients.includes(companyName)) {
    clients = clients.filter((c) => c !== companyName);
  } else {
    clients = [...clients, companyName];
  }
  usersStore[phone].clients = clients;
  const syncedToTurso = await saveUserToTurso(phone, usersStore[phone]);
  if (!syncedToTurso) {
    console.warn(`[Turso] FLAG: client-connections update for '${phone}' was NOT persisted to Turso.`);
  }
  res.json({ success: true, clients, syncedToTurso });
});

app.delete("/api/clients", requireAuth, async (req, res) => {
  const phone = (req as any).userPhone as string;
  let syncedToTurso = true;
  if (usersStore[phone]) {
    usersStore[phone].clients = [];
    syncedToTurso = await saveUserToTurso(phone, usersStore[phone]);
    if (!syncedToTurso) {
      console.warn(`[Turso] FLAG: clearing client connections for '${phone}' was NOT persisted to Turso.`);
    }
  }
  res.json({ success: true, clients: [], syncedToTurso });
});

// Company Reviews & Ratings Endpoints — public read (so ratings show for every visitor),
// authenticated write. A reviewer may only edit/delete their OWN review: enforced by
// matching the review's stored authorPhone against the requester's authenticated phone
// (derived from their Bearer token), never by anything the client claims in the request body.
app.get("/api/reviews", optionalAuth, (req, res) => {
  const companyName = String(req.query.company || "").trim();
  if (!companyName) {
    res.status(400).json({ success: false, error: "Missing company query parameter." });
    return;
  }

  const viewerPhone = (req as any).userPhone as string | undefined;
  const companyReviews = reviewsStore
    .filter((r) => r.companyName.trim().toLowerCase() === companyName.toLowerCase())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((r) => toPublicReview(r, viewerPhone));

  res.json({ success: true, reviews: companyReviews });
});

app.post("/api/reviews", requireAuth, async (req, res) => {
  try {
    const phone = (req as any).userPhone as string;
    const user = usersStore[phone];
    if (!user) {
      res.status(404).json({ success: false, error: "Account not found." });
      return;
    }

    const companyName = String(req.body.companyName || "").trim();
    const rating = Number(req.body.rating);
    const text = req.body.text ? String(req.body.text).trim() : "";

    if (!companyName) {
      res.status(400).json({ success: false, error: "Missing companyName." });
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ success: false, error: "Rating must be a whole number from 1 to 5." });
      return;
    }
    if (
      user.profile?.companyName &&
      user.profile.companyName.trim().toLowerCase() === companyName.toLowerCase()
    ) {
      res.status(400).json({ success: false, error: "You can't review your own company." });
      return;
    }

    // One review per reviewer per company — posting again edits the existing one,
    // which is what powers the "only they can edit" requirement without needing
    // the client to know/send a review id up front.
    const existingIndex = reviewsStore.findIndex(
      (r) => r.authorPhone === phone && r.companyName.trim().toLowerCase() === companyName.toLowerCase()
    );

    const now = new Date().toISOString();
    const authorName = (user.profile?.name && String(user.profile.name).trim()) || "Occa User";
    const authorProfilePic = user.profile?.profilePicUrl || undefined;

    let saved: Review;
    if (existingIndex !== -1) {
      saved = {
        ...reviewsStore[existingIndex],
        rating,
        text,
        authorName,
        authorProfilePic,
        updatedAt: now,
      };
      reviewsStore[existingIndex] = saved;
    } else {
      saved = {
        id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        companyName,
        authorPhone: phone,
        authorName,
        authorProfilePic,
        rating,
        text,
        createdAt: now,
      };
      reviewsStore = [saved, ...reviewsStore];
    }

    const syncedToTurso = await saveReviewToTurso(saved);
    if (!syncedToTurso) {
      console.warn(`[Turso] FLAG: review '${saved.id}' was NOT persisted to Turso.`);
    }

    res.json({ success: true, review: toPublicReview(saved, phone), syncedToTurso });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/reviews/:id", requireAuth, async (req, res) => {
  try {
    const phone = (req as any).userPhone as string;
    const { id } = req.params;

    const review = reviewsStore.find((r) => r.id === id);
    if (!review) {
      res.status(404).json({ success: false, error: "Review not found." });
      return;
    }
    if (review.authorPhone !== phone) {
      res.status(403).json({ success: false, error: "You can only delete your own review." });
      return;
    }

    reviewsStore = reviewsStore.filter((r) => r.id !== id);
    const syncedToTurso = await deleteReviewFromTurso(id);
    if (!syncedToTurso) {
      console.warn(`[Turso] FLAG: delete of review '${id}' did NOT reach Turso — it may still exist there.`);
    }

    res.json({ success: true, message: `Review ${id} deleted.`, syncedToTurso });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// In-App Messaging Endpoints — the platform's primary means of communication between
// buyers and posters. One conversation per pair of accounts (started from a listing's
// "Message" button), each holding an ordered thread of messages. WhatsApp/Email/SMS
// (ContactOptionsSheet on the client) remain optional secondary channels a poster can
// additionally enable — they don't replace this.
//
// List every conversation the authenticated account participates in, most recently
// active first, each carrying only the OTHER participant's public info plus an unread
// count relative to this viewer. Unread counts for the whole list are computed in one
// pass over messagesStore (see computeUnreadCountsByConversation) rather than one pass
// per conversation, so this stays cheap as either list grows.
app.get("/api/conversations", requireAuth, (req, res) => {
  const phone = (req as any).userPhone as string;
  const mine = conversationsStore.filter((c) => c.participantPhones.includes(phone));
  const unreadCounts = computeUnreadCountsByConversation(mine, phone);
  const sorted = [...mine].sort(
    (a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime()
  );
  res.json({
    success: true,
    conversations: sorted.map((c) => toPublicConversation(c, phone, unreadCounts[c.id] || 0)),
  });
});

// Starts a new conversation with a listing's poster, or returns the existing one if this
// pair of accounts already has a thread going (messaging stays a single running
// conversation per pair, not a fresh one per listing). This is what the "Message" button
// on a listing calls.
app.post("/api/conversations/start", requireAuth, async (req, res) => {
  try {
    const phone = (req as any).userPhone as string;
    const listingId = String(req.body.listingId || "");
    if (!listingId) {
      res.status(400).json({ success: false, error: "Missing listingId." });
      return;
    }

    const listing = listingsStore.find((l) => l.id === listingId);
    if (!listing) {
      res.status(404).json({ success: false, error: "Listing not found." });
      return;
    }
    const posterPhone = listing.posterPhone;
    if (!posterPhone) {
      res.status(400).json({ success: false, error: "This listing has no linked account to message." });
      return;
    }
    if (posterPhone === phone) {
      res.status(400).json({ success: false, error: "You can't message yourself about your own listing." });
      return;
    }

    let conv = conversationsStore.find(
      (c) => c.participantPhones.includes(phone) && c.participantPhones.includes(posterPhone)
    );
    let syncedToTurso = true;
    if (!conv) {
      conv = {
        id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        participantPhones: [phone, posterPhone],
        listingId: listing.id,
        listingTitle: listing.title,
        lastReadAt: {},
        createdAt: new Date().toISOString(),
      };
      conversationsStore = [conv, ...conversationsStore];
      syncedToTurso = await saveConversationToTurso(conv);
      if (!syncedToTurso) {
        console.warn(`[Turso] FLAG: new conversation '${conv.id}' was NOT persisted to Turso.`);
      }
    }

    res.json({ success: true, conversation: toPublicConversation(conv, phone), syncedToTurso });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch a conversation's message history (oldest first) and mark it as read for the
// requesting account. A conversation may only be read by one of its two participants.
//
// Efficiency notes (this endpoint is polled every few seconds by an open thread):
// - `?since=<ISO timestamp>` returns only messages newer than that, so a poll re-syncs a
//   handful of new messages instead of re-downloading and re-sorting the whole thread.
// - The read-receipt (lastReadAt) is only updated — and only written to Turso — when
//   there's actually something new to mark read. Once a viewer is caught up, repeated
//   silent polls that find nothing new cost zero database writes.
app.get("/api/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const phone = (req as any).userPhone as string;
    const conv = conversationsStore.find((c) => c.id === req.params.id);
    if (!conv || !conv.participantPhones.includes(phone)) {
      res.status(404).json({ success: false, error: "Conversation not found." });
      return;
    }

    const since = typeof req.query.since === "string" ? req.query.since : undefined;
    const allMessagesInConv = messagesStore.filter((m) => m.conversationId === conv!.id);
    const messages = (since ? allMessagesInConv.filter((m) => m.createdAt > since) : allMessagesInConv).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const viewerLastRead = conv.lastReadAt?.[phone];
    const hasUnread = allMessagesInConv.some(
      (m) => m.senderPhone !== phone && (!viewerLastRead || m.createdAt > viewerLastRead)
    );
    let syncedToTurso = true;
    if (hasUnread) {
      conv.lastReadAt = { ...conv.lastReadAt, [phone]: new Date().toISOString() };
      syncedToTurso = await saveConversationToTurso(conv);
      if (!syncedToTurso) {
        console.warn(`[Turso] FLAG: read-receipt update for conversation '${conv.id}' was NOT persisted to Turso.`);
      }
    }

    res.json({
      success: true,
      messages: messages.map((m) => toPublicMessage(m, phone)),
      // The viewer's own request just (or already had) read everything up to now, so the
      // conversation handed back here always reflects zero unread — no extra pass needed.
      conversation: toPublicConversation(conv, phone, 0),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send a message into an existing conversation. Only the two participants may post into
// it — enforced server-side by matching the authenticated phone, never by anything the
// client claims about which conversation it's writing to.
app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const phone = (req as any).userPhone as string;
    const conv = conversationsStore.find((c) => c.id === req.params.id);
    if (!conv || !conv.participantPhones.includes(phone)) {
      res.status(404).json({ success: false, error: "Conversation not found." });
      return;
    }

    const text = String(req.body.text || "").trim();
    if (!text) {
      res.status(400).json({ success: false, error: "Message can't be empty." });
      return;
    }
    if (text.length > 4000) {
      res.status(400).json({ success: false, error: "Message is too long." });
      return;
    }

    const now = new Date().toISOString();
    const message: MessageRecord = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      conversationId: conv.id,
      senderPhone: phone,
      text,
      createdAt: now,
    };
    messagesStore = [...messagesStore, message];

    conv.lastMessageText = text;
    conv.lastMessageAt = now;
    conv.lastMessageSenderPhone = phone;
    // The sender has, by definition, seen everything in the thread up to and including
    // their own new message — this is what keeps a conversation from showing as unread
    // to the person who just sent the last message in it.
    conv.lastReadAt = { ...conv.lastReadAt, [phone]: now };

    const [messageSynced, conversationSynced] = await Promise.all([
      saveMessageToTurso(message),
      saveConversationToTurso(conv),
    ]);
    const syncedToTurso = messageSynced && conversationSynced;
    if (!syncedToTurso) {
      console.warn(`[Turso] FLAG: message '${message.id}' in conversation '${conv.id}' was NOT fully persisted to Turso.`);
    }

    res.json({
      success: true,
      message: toPublicMessage(message, phone),
      // The sender's lastReadAt was just set to `now` above, so this is always 0 —
      // skip the redundant scan.
      conversation: toPublicConversation(conv, phone, 0),
      syncedToTurso,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Settings Endpoints — per-user; null means "use client-side defaults"
app.get("/api/settings", requireAuth, (req, res) => {
  const phone = (req as any).userPhone as string;
  const settings = usersStore[phone]?.settings || null;
  res.json({ success: true, settings });
});

app.post("/api/settings", requireAuth, async (req, res) => {
  const phone = (req as any).userPhone as string;
  if (!usersStore[phone]) {
    res.status(404).json({ success: false, error: "Account not found." });
    return;
  }
  const updated = { ...(usersStore[phone].settings || {}), ...req.body };
  usersStore[phone].settings = updated;
  const syncedToTurso = await saveUserToTurso(phone, usersStore[phone]);
  if (!syncedToTurso) {
    console.warn(`[Turso] FLAG: settings update for '${phone}' was NOT persisted to Turso.`);
  }
  res.json({ success: true, settings: updated, syncedToTurso });
});

// AI Tender & Listing Assistant Endpoint
app.post("/api/ai/enhance", async (req, res) => {
  try {
    const { title, category, rawDescription } = req.body;
    if (!title) {
      res.status(400).json({ success: false, error: "Title is required for AI enhancement" });
      return;
    }

    const ai = getAiClient();
    const prompt = `You are a corporate procurement expert for Occa Prominence. 
Enhance this business listing or tender into polished, professional corporate language.
Title: "${title}"
Category: "${category || "general"}"
Raw Notes: "${rawDescription || title}"

Provide a JSON object with:
- "description": A detailed, formal corporate post description (2-3 sentences).
- "requirements": Standard corporate procurement or partner requirements.
- "suggestedCompensation": A realistic corporate deal value or pricing structure estimate.

Respond ONLY with valid JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const resultText = response.text || "{}";
    const parsed = JSON.parse(resultText);

    res.json({
      success: true,
      enhanced: parsed,
    });
  } catch (err: any) {
    console.error("AI Enhance error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to generate AI enhancement",
    });
  }
});

// --- SERVER START & VITE MIDDLEWARE ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Lazy/dynamic import: vite is a dev-server-only, ESM-only package.
    // Keeping this import inside the dev branch (instead of a static
    // top-level import) means it's never pulled into the production
    // serverless bundle that api/index.ts -> server.ts produces on Vercel,
    // where statically importing it can crash the whole function at
    // cold start and take down every /api/* route with a generic,
    // non-JSON 500 error.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Occa Prominence Backend] Server listening on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;


