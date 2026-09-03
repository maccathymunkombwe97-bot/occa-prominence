import { Listing, AppSettings } from '../types';

/**
 * A listing counts as actively boosted only while `isBoosted` is set AND
 * (when present) `boostedUntil` hasn't passed yet. Without this check,
 * paid time-limited boosts (e.g. "7 days", "1 month") would behave as
 * permanent, since nothing else in the app ever clears `isBoosted`.
 */
export function isBoostActive(listing: Pick<Listing, 'isBoosted' | 'boostedUntil'>): boolean {
  if (!listing?.isBoosted) return false;
  if (!listing.boostedUntil) return true;
  const expiry = new Date(listing.boostedUntil).getTime();
  if (isNaN(expiry)) return true;
  return expiry > Date.now();
}

/**
 * Retrieves recent search history terms from localStorage
 */
export function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem('occa_search_history');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(s => String(s).toLowerCase().trim()).filter(Boolean);
  } catch (e) {
    console.warn('Error reading search history', e);
  }
  return [];
}

/**
 * Saves a new search query term to localStorage
 */
export function recordSearchQuery(term: string) {
  if (!term || term.trim().length < 2) return;
  const cleanTerm = term.trim().toLowerCase();
  const current = getSearchHistory();
  const filtered = current.filter(t => t !== cleanTerm);
  const updated = [cleanTerm, ...filtered].slice(0, 20); // Keep last 20 queries
  try {
    localStorage.setItem('occa_search_history', JSON.stringify(updated));
  } catch (e) {
    console.warn('Error saving search term', e);
  }
}

/**
 * Clears search history from localStorage
 */
export function clearSearchHistory() {
  try {
    localStorage.removeItem('occa_search_history');
  } catch (e) {}
}

/**
 * Ranks listings based on:
 * 1. Region Priority: User Town (highest) > User Country (national) > International (lowest)
 * 2. Personalization: Saved Posts categories/keywords + Recent Searches matching
 * 3. Boosted status high exposure
 */
export function scoreAndRankListings(
  listings: Listing[],
  savedPostIds: string[],
  settings: AppSettings
): Listing[] {
  const userTown = (settings.userTown || 'Lusaka').toLowerCase().trim();
  const userCountry = (settings.userCountry || 'Zambia').toLowerCase().trim();
  const isPersonalized = settings.enablePersonalizedFeed !== false;
  const searchHistory = isPersonalized ? getSearchHistory() : [];

  // Extract saved listings to build category and keyword interest profiles
  const savedListings = listings.filter(l => savedPostIds.includes(l.id));
  const savedCategories = new Set(savedListings.map(l => l.category));
  const savedKeywords = new Set<string>();

  savedListings.forEach(l => {
    const text = `${l.title} ${l.companyName} ${l.description}`.toLowerCase();
    text.split(/\W+/).forEach(word => {
      if (word.length > 3) savedKeywords.add(word);
    });
  });

  // Filter according to regionFilter if set specifically
  let candidateListings = listings;
  if (settings.regionFilter === 'town') {
    candidateListings = listings.filter(l => (l.town || '').toLowerCase().includes(userTown));
  } else if (settings.regionFilter === 'country') {
    candidateListings = listings.filter(l => (l.country || '').toLowerCase().includes(userCountry));
  } else if (settings.regionFilter === 'international') {
    candidateListings = listings.filter(l => {
      const c = (l.country || '').toLowerCase();
      return c && !c.includes(userCountry);
    });
  }

  // Calculate composite score for each listing
  const scored = candidateListings.map(l => {
    let score = 0;
    const lTown = (l.town || '').toLowerCase();
    const lCountry = (l.country || '').toLowerCase();

    // 1. Regional Score
    if (lTown && (lTown.includes(userTown) || userTown.includes(lTown))) {
      score += 1000; // Exact/matching Town
    } else if (lCountry && (lCountry.includes(userCountry) || userCountry.includes(lCountry))) {
      score += 500; // Same Country
    } else {
      score += 50; // International / Other Region
    }

    // 2. Personalization Score (Saved Posts Affinity)
    if (isPersonalized) {
      if (savedCategories.has(l.category)) {
        score += 300;
      }

      const lText = `${l.title} ${l.companyName} ${l.description} ${l.category}`.toLowerCase();

      // Saved keywords match
      savedKeywords.forEach(kw => {
        if (lText.includes(kw)) score += 50;
      });

      // Search history match
      searchHistory.forEach(q => {
        if (q && lText.includes(q)) score += 150;
      });
    }

    // 3. Freshness boost
    const createdTime = new Date(l.createdAt).getTime();
    const daysOld = (Date.now() - createdTime) / (1000 * 60 * 60 * 24);
    if (daysOld < 7) {
      score += Math.max(0, 100 - daysOld * 10);
    }

    return { listing: l, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return scored.map(item => item.listing);
}
