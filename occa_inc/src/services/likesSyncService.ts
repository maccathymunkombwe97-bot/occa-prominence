import { Listing } from '../types';
import { buildLikesSyncPayload } from '../utils/organicGrowth';

/**
 * Writes every currently-loaded listing's on-screen total like count (the organic-growth
 * engine's live number plus any real manual likes — see organicGrowth.ts) to the database,
 * via POST /api/listings/sync-likes. This is what turns the likes generator's output from a
 * purely-recomputed formula into a permanent database record: whatever total a viewer is
 * shown gets written down.
 *
 * Safe to call often — cheap even on a short interval:
 *  - The server only ever raises a post's stored count, never lowers it.
 *  - The server skips writing (and touching Turso) for any post whose count hasn't grown
 *    since the last sync.
 *  - Failures are swallowed (network hiccups, offline, etc.) since this is a best-effort
 *    background sync, not a user-facing action — the next scheduled call will catch up.
 */
export async function syncLikesToServer(listings: Listing[]): Promise<void> {
  if (!Array.isArray(listings) || listings.length === 0) return;

  const counts = buildLikesSyncPayload(listings);
  if (Object.keys(counts).length === 0) return;

  try {
    await fetch('/api/listings/sync-likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counts }),
    });
  } catch (e) {
    console.warn('[likesSyncService] Failed to sync like counts to server:', e);
  }
}
