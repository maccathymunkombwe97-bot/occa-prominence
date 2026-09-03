import React from 'react';
import { ArrowLeft, Heart, MapPin, Briefcase } from 'lucide-react';
import { Listing } from '../types';
import { formatCompactNumber } from '../utils/numberFormatter';
import { getTotalPostLikes } from '../utils/organicGrowth';
import { useLiveNow } from '../hooks/useLiveNow';

interface CompanyPostsPageProps {
  companyName: string;
  listings: Listing[];
  currentListingId?: string;
  onOpenDetail: (listing: Listing) => void;
  onBack: () => void;
}

export const CompanyPostsPage: React.FC<CompanyPostsPageProps> = ({
  companyName,
  listings,
  currentListingId,
  onOpenDetail,
  onBack,
}) => {
  const companyListings = [...listings]
    .filter((l) => l.companyName === companyName)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Keeps every post's like count live — ticks forward on its own while this page is open.
  const liveNow = useLiveNow();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-6 animate-in fade-in">
      {/* Back Bar */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-amber-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Profile</span>
      </button>

      <h1 className="text-lg font-extrabold text-white flex items-center gap-2">
        <Briefcase className="w-5 h-5 text-amber-400" />
        Products & Services by {companyName} ({companyListings.length})
      </h1>

      {companyListings.length === 0 ? (
        <div className="text-sm text-neutral-500 py-4">No products and services posted yet.</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {companyListings.map((post) => (
            <button
              key={post.id}
              onClick={() => onOpenDetail(post)}
              className={`text-left rounded-xl border overflow-hidden transition-all group flex flex-col ${
                post.id === currentListingId
                  ? 'bg-amber-400/5 border-amber-400/40'
                  : 'bg-black border-neutral-800 hover:border-amber-400/50 hover:bg-neutral-950'
              }`}
            >
              <div className="w-full h-40 bg-neutral-900 overflow-hidden">
                <img
                  src={post.images?.[0]}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase text-amber-400">
                  <span>{post.category}</span>
                  {post.isBoosted && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 border border-amber-400/30">
                      Boosted
                    </span>
                  )}
                </div>
                <div className="text-base font-bold text-white group-hover:text-amber-400 transition-colors leading-snug">
                  {post.title}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{[post.town, post.country].filter(Boolean).join(', ') || 'Remote'}</span>
                </div>
                <div className="mt-auto pt-2 flex items-center justify-between">
                  {post.compensation ? (
                    <span className="text-xs font-bold text-neutral-300 truncate">{post.compensation}</span>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-1 shrink-0 bg-neutral-900 px-2 py-0.5 rounded text-neutral-400 group-hover:text-amber-400">
                    <Heart className="w-3 h-3 fill-current" />
                    <span className="text-[11px] font-bold">{formatCompactNumber(getTotalPostLikes(post, liveNow))}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
