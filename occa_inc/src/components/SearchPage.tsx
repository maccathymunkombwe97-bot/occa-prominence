import React, { useState, useMemo, useEffect } from 'react';
import {
  Search as SearchIcon,
  X,
  SlidersHorizontal,
  Layers,
  Package,
  Wrench,
  MapPin,
  Sparkles,
  Wallet,
  Tag,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
} from 'lucide-react';
import { Listing, ListingCategory } from '../types';
import { ListingCard } from './ListingCard';
import { recordSearchQuery } from '../utils/feedScoring';

interface SearchPageProps {
  listings: Listing[];
  savedPostIds: string[];
  myPostIds: string[];
  autoRotateCarousel: boolean;
  onOpenDetail: (listing: Listing) => void;
  onOpenAuthorProfile: (listing: Listing) => void;
  onToggleSave: (listingId: string) => void;
  onShare: (listing: Listing) => void;
  onInboxContact: (listing: Listing) => void;
  onShowOtherContactOptions?: (listing: Listing) => void;
}

type SortOption = 'newest' | 'title' | 'company' | 'priceLow' | 'priceHigh';
type PostedWithin = 'any' | 'today' | 'week' | 'month';

const SEARCH_CATEGORIES: { id: ListingCategory | 'all'; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All Categories', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'products', label: 'Products', icon: <Package className="w-3.5 h-3.5" /> },
  { id: 'services', label: 'Services', icon: <Wrench className="w-3.5 h-3.5" /> },
];

const POPULAR_SUGGESTIONS = [
  'Website',
  'Web App',
  'Invoice',
  'Branding',
  'Business Software',
  'Website Fix',
  'Digital Services'
];

const POSTED_WITHIN_OPTIONS: { id: PostedWithin; label: string }[] = [
  { id: 'any', label: 'Any time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Past 7 days' },
  { id: 'month', label: 'Past 30 days' },
];

/**
 * Compensation/value is entered as free text by posters (e.g. "K500,000 Contract Value",
 * "$5,000/month", "Negotiable") so there's no structured currency or amount to filter on
 * precisely. This pulls out the first number it finds as a best-effort approximation —
 * good enough to power a min/max range filter, but listings with no parseable number (or
 * text like "Negotiable") simply won't match an active price filter, same as any
 * marketplace can't range-filter an item with an unlisted price.
 */
function parseApproxValue(text?: string): number | null {
  if (!text) return null;
  const match = text.replace(/,/g, '').match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const n = parseFloat(match[1]);
  return Number.isFinite(n) ? n : null;
}

function daysAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

export const SearchPage: React.FC<SearchPageProps> = ({
  listings,
  savedPostIds,
  myPostIds,
  autoRotateCarousel,
  onOpenDetail,
  onOpenAuthorProfile,
  onToggleSave,
  onShare,
  onInboxContact,
  onShowOtherContactOptions,
}) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ListingCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced filters
  const [countryFilter, setCountryFilter] = useState('');
  const [townQuery, setTownQuery] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [dealTypeFilter, setDealTypeFilter] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [postedWithin, setPostedWithin] = useState<PostedWithin>('any');

  // Record search history for feed personalization algorithm
  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      recordSearchQuery(query);
    }, 1200);
    return () => clearTimeout(timer);
  }, [query]);

  // Dynamically derived from whatever is actually in the current listings — works
  // whether the app has 3 listings or 3,000, and never goes stale against real data.
  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l) => l.country && set.add(l.country.trim()));
    return Array.from(set).sort();
  }, [listings]);

  const availableDealTypes = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l) => l.type && set.add(l.type.trim()));
    return Array.from(set).sort();
  }, [listings]);

  const activeAdvancedCount = [
    countryFilter,
    townQuery.trim(),
    priceMin.trim(),
    priceMax.trim(),
    dealTypeFilter,
    verifiedOnly ? 'x' : '',
    postedWithin !== 'any' ? postedWithin : '',
  ].filter(Boolean).length;

  const hasAnyFilter = !!query || selectedCategory !== 'all' || activeAdvancedCount > 0;

  const resetAllFilters = () => {
    setQuery('');
    setSelectedCategory('all');
    setCountryFilter('');
    setTownQuery('');
    setPriceMin('');
    setPriceMax('');
    setDealTypeFilter('');
    setVerifiedOnly(false);
    setPostedWithin('any');
  };

  const filteredListings = useMemo(() => {
    const q = query.trim().toLowerCase();
    const townQ = townQuery.trim().toLowerCase();
    const min = priceMin.trim() ? parseFloat(priceMin) : null;
    const max = priceMax.trim() ? parseFloat(priceMax) : null;

    return listings
      .filter((l) => {
        if (selectedCategory !== 'all' && l.category !== selectedCategory) return false;

        if (countryFilter && (l.country || '').trim().toLowerCase() !== countryFilter.toLowerCase()) {
          return false;
        }

        if (townQ && !(l.town || '').toLowerCase().includes(townQ)) {
          return false;
        }

        if (dealTypeFilter && (l.type || '').trim().toLowerCase() !== dealTypeFilter.toLowerCase()) {
          return false;
        }

        if (verifiedOnly && !l.posterVerified) return false;

        if (postedWithin !== 'any') {
          const limit = postedWithin === 'today' ? 1 : postedWithin === 'week' ? 7 : 30;
          if (daysAgo(l.createdAt) > limit) return false;
        }

        if (min !== null || max !== null) {
          const val = parseApproxValue(l.compensation);
          if (val === null) return false;
          if (min !== null && val < min) return false;
          if (max !== null && val > max) return false;
        }

        if (!q) return true;

        const haystack = [
          l.title,
          l.companyName,
          l.companySector,
          l.category,
          l.description,
          l.requirements,
          l.town,
          l.country,
          l.compensation,
          l.type,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(q);
      })
      .sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'company') return a.companyName.localeCompare(b.companyName);
        if (sortBy === 'priceLow' || sortBy === 'priceHigh') {
          const av = parseApproxValue(a.compensation);
          const bv = parseApproxValue(b.compensation);
          // Listings with no parseable value sort to the end regardless of direction
          if (av === null && bv === null) return 0;
          if (av === null) return 1;
          if (bv === null) return -1;
          return sortBy === 'priceLow' ? av - bv : bv - av;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [
    listings,
    query,
    selectedCategory,
    countryFilter,
    townQuery,
    priceMin,
    priceMax,
    dealTypeFilter,
    verifiedOnly,
    postedWithin,
    sortBy,
  ]);

  return (
    <div className="pb-24 pt-4 px-4 sm:px-8 max-w-6xl mx-auto">
      {/* Title & Banner */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <SearchIcon className="w-6 h-6 text-amber-400" />
          Explore & Search Ledger
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Search OCCA products and digital services.
        </p>
      </div>

      {/* Main Search Input Box */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-6 shadow-sm space-y-3.5">
        <div className="flex items-center gap-2.5 bg-black border border-neutral-800 focus-within:border-amber-400 rounded-lg px-3.5 py-2.5 transition-all">
          <SearchIcon className="w-4 h-4 text-neutral-500 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search OCCA products and services..."
            className="w-full bg-transparent border-none text-white text-sm outline-none placeholder:text-neutral-500 font-medium"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters Row — quick sort + advanced-filters toggle */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
              showAdvanced || activeAdvancedCount > 0
                ? 'bg-amber-400/10 border-amber-400/40 text-amber-400'
                : 'bg-black border-neutral-800 text-neutral-300 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeAdvancedCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-amber-400 text-black text-[10px] font-extrabold">
                {activeAdvancedCount}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {/* Sort By Selector */}
          <div className="flex items-center gap-2 bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-300">
            <span className="text-neutral-500 hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent border-none text-white font-bold outline-none cursor-pointer"
            >
              <option value="newest" className="bg-neutral-900 text-white">Newest First</option>
              <option value="title" className="bg-neutral-900 text-white">Title (A-Z)</option>
              <option value="company" className="bg-neutral-900 text-white">Company Name</option>
              <option value="priceLow" className="bg-neutral-900 text-white">Value: Low to High</option>
              <option value="priceHigh" className="bg-neutral-900 text-white">Value: High to Low</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvanced && (
          <div className="border border-neutral-800 rounded-lg p-3.5 space-y-3.5 bg-black/40 animate-in fade-in">
            <div className="grid sm:grid-cols-2 gap-3">
              {/* Country */}
              <div className="flex items-center gap-2 bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs">
                <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <select
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className="w-full bg-transparent border-none text-neutral-200 outline-none cursor-pointer font-medium"
                >
                  <option value="" className="bg-neutral-900">All Countries</option>
                  {availableCountries.map((c) => (
                    <option key={c} value={c} className="bg-neutral-900">{c}</option>
                  ))}
                </select>
              </div>

              {/* Town / City */}
              <div className="flex items-center gap-2 bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs">
                <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <input
                  type="text"
                  value={townQuery}
                  onChange={(e) => setTownQuery(e.target.value)}
                  placeholder="City or town..."
                  className="w-full bg-transparent border-none text-neutral-200 outline-none placeholder:text-neutral-500 font-medium"
                />
                {townQuery && (
                  <button onClick={() => setTownQuery('')} className="text-neutral-400 hover:text-white shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {/* Price / Value Range */}
              <div className="flex items-center gap-2 bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs">
                <Wallet className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <input
                  type="number"
                  inputMode="decimal"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="Min value"
                  className="w-full min-w-0 bg-transparent border-none text-neutral-200 outline-none placeholder:text-neutral-500 font-medium"
                />
                <span className="text-neutral-600 shrink-0">—</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="Max value"
                  className="w-full min-w-0 bg-transparent border-none text-neutral-200 outline-none placeholder:text-neutral-500 font-medium"
                />
              </div>

              {/* Deal Type */}
              <div className="flex items-center gap-2 bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs">
                <Tag className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <select
                  value={dealTypeFilter}
                  onChange={(e) => setDealTypeFilter(e.target.value)}
                  className="w-full bg-transparent border-none text-neutral-200 outline-none cursor-pointer font-medium"
                  disabled={availableDealTypes.length === 0}
                >
                  <option value="" className="bg-neutral-900">
                    {availableDealTypes.length === 0 ? 'No deal types yet' : 'All Deal Types'}
                  </option>
                  {availableDealTypes.map((t) => (
                    <option key={t} value={t} className="bg-neutral-900">{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {/* Posted Within */}
              <div className="flex items-center gap-2 bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs">
                <CalendarDays className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <select
                  value={postedWithin}
                  onChange={(e) => setPostedWithin(e.target.value as PostedWithin)}
                  className="w-full bg-transparent border-none text-neutral-200 outline-none cursor-pointer font-medium"
                >
                  {POSTED_WITHIN_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} className="bg-neutral-900">{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Verified Only */}
              <button
                type="button"
                onClick={() => setVerifiedOnly((v) => !v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                  verifiedOnly
                    ? 'bg-amber-400/10 border-amber-400/40 text-amber-400'
                    : 'bg-black border-neutral-800 text-neutral-300 hover:text-white'
                }`}
              >
                <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Verified businesses only</span>
              </button>
            </div>

            {activeAdvancedCount > 0 && (
              <button
                onClick={() => {
                  setCountryFilter('');
                  setTownQuery('');
                  setPriceMin('');
                  setPriceMax('');
                  setDealTypeFilter('');
                  setVerifiedOnly(false);
                  setPostedWithin('any');
                }}
                className="text-amber-400 hover:underline text-xs font-bold"
              >
                Clear advanced filters
              </button>
            )}
          </div>
        )}

        {/* Category Chips inside Search */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {SEARCH_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategory === cat.id
                  ? 'bg-amber-400 border-amber-400 text-black shadow-sm'
                  : 'bg-black border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-white'
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Popular Search Suggestions */}
      {!query && (
        <div className="mb-6">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Popular Searches</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {POPULAR_SUGGESTIONS.map((tag) => (
              <button
                key={tag}
                onClick={() => setQuery(tag)}
                className="px-3.5 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-amber-400 hover:border-amber-400/40 transition-all shadow-sm"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results Info Header */}
      <div className="flex items-center justify-between text-xs text-neutral-400 mb-4 px-1">
        <div>
          Showing <span className="font-bold text-white">{filteredListings.length}</span> result
          {filteredListings.length === 1 ? '' : 's'}
          {query && <span> for "<span className="text-amber-400 font-bold">{query}</span>"</span>}
        </div>
        {hasAnyFilter && (
          <button onClick={resetAllFilters} className="text-amber-400 hover:underline text-xs font-bold">
            Clear filters
          </button>
        )}
      </div>

      {/* Search Results Stream (Containerless) */}
      {filteredListings.length === 0 ? (
        <div className="text-center py-16 px-4 bg-neutral-900 border border-neutral-800 rounded-xl shadow-sm">
          <SearchIcon className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">
            No matching products or services found
          </h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-4">
            Try adjusting your search query, clearing filters, or searching for keywords like "website", "invoice" or "branding".
          </p>
          <button
            onClick={resetAllFilters}
            className="bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs px-4 py-2 rounded-lg transition-all"
          >
            Reset Search
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              isSaved={savedPostIds.includes(listing.id)}
              isMyPost={myPostIds.includes(listing.id)}
              autoRotateCarousel={autoRotateCarousel}
              onOpenDetail={onOpenDetail}
              onOpenAuthorProfile={onOpenAuthorProfile}
              onToggleSave={onToggleSave}
              onShare={onShare}
              onInboxContact={onInboxContact}
              onShowOtherContactOptions={onShowOtherContactOptions}
            />
          ))}
        </div>
      )}
    </div>
  );
};
