import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  Building2,
  FileText,
  UserPlus,
  UserCheck,
  Star,
  Briefcase,
  MessageSquareText,
  MessageCircle,
  MoreHorizontal,
} from 'lucide-react';
import { ContactMethod, Listing, Review, UserProfile } from '../types';
import { formatCompactNumber } from '../utils/numberFormatter';
import { getCompanyOrganicClients } from '../utils/organicGrowth';
import { hasAvailableExternalContactMethods } from '../utils/contactAvailability';
import { useLiveNow } from '../hooks/useLiveNow';
import { ImageViewerModal } from './ImageViewerModal';

interface CompanyProfilePageProps {
  listing: Listing;
  listings: Listing[];
  clients: string[];
  onToggleClient: (companyName: string) => void;
  onInboxContact: (listing: Listing) => void;
  onShowOtherContactOptions?: (listing: Listing) => void;
  onOpenDetail: (listing: Listing) => void;
  onBack: () => void;
  profile: UserProfile | null;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onShowToast: (msg: string) => void;
  onViewAllPosts: () => void;
  onViewAllReviews: () => void;
}

/** Read-only row of filled/empty stars for a given rating, always centered within its line. */
const StarRow: React.FC<{ rating: number; size?: string }> = ({ rating, size = 'w-3.5 h-3.5' }) => (
  <div className="flex items-center justify-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        className={`${size} ${n <= Math.round(rating) ? 'text-amber-400 fill-current' : 'text-neutral-700'}`}
      />
    ))}
  </div>
);

export const CompanyProfilePage: React.FC<CompanyProfilePageProps> = ({
  listing,
  listings,
  clients,
  onToggleClient,
  onInboxContact,
  onShowOtherContactOptions,
  onOpenDetail,
  onBack,
  profile,
  authFetch,
  onShowToast,
  onViewAllPosts,
  onViewAllReviews,
}) => {
  const authorName = listing.posterName || listing.companyName;
  const companyName = listing.companyName;
  const isClient = clients.includes(companyName);

  // Keeps every simulated count on this page live — ticks forward on its own while open.
  const liveNow = useLiveNow();

  // Organic (time-driven, posting-frequency-aware) client growth plus the viewer's own connection
  const organicClients = getCompanyOrganicClients(companyName, listings, liveNow);
  const totalClients = isClient ? organicClients + 1 : organicClients;

  // All posts by this company — the count here just feeds the "Products & Services" link;
  // the posts themselves live entirely on their own page (CompanyPostsPage).
  const companyListings = [...listings].filter((l) => l.companyName === companyName);

  // A lightweight review fetch — only used to show the average rating up top and on
  // the "Reviews & Ratings" link below. The full read/write/edit/delete experience
  // lives entirely on its own page (CompanyReviewsPage), reached via onViewAllReviews.
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReviewsLoading(true);

    (async () => {
      try {
        const res = await authFetch(`/api/reviews?company=${encodeURIComponent(companyName)}`);
        const data = await res.json();
        if (!cancelled && data.success && Array.isArray(data.reviews)) {
          setReviews(data.reviews);
        }
      } catch (e) {
        console.warn('Failed to load reviews:', e);
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyName, authFetch]);

  const averageRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <div className="w-full animate-in fade-in">
      {/* Back Bar */}
      <div className="px-4 sm:px-8 pt-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-amber-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Profile Header — full-bleed, edge-to-edge (not a boxed card) */}
      <div className="w-full">
        {/* Cover / Background Photo */}
        <div className="relative w-full h-40 sm:h-64 bg-gradient-to-br from-neutral-900 via-neutral-900 to-black mt-4">
          {listing.posterBackgroundUrl && (
            <img
              src={listing.posterBackgroundUrl}
              alt={`${companyName} cover`}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/10" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-8 pb-6 sm:pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5 -mt-10 sm:-mt-12">
            <div className="relative shrink-0 mx-auto sm:mx-0">
              {listing.posterProfilePic ? (
                <img
                  src={listing.posterProfilePic}
                  alt={authorName}
                  onClick={() => setIsAvatarViewerOpen(true)}
                  className="w-24 h-24 rounded-full object-cover border-4 border-black shadow-lg bg-black cursor-pointer"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-black border-4 border-black shadow-lg flex items-center justify-center text-2xl font-bold text-amber-400">
                  {authorName[0]}
                </div>
              )}
              {listing.posterVerified && (
                <div className="absolute bottom-0 right-0 p-1 bg-black rounded-full border border-neutral-700 shadow-xs">
                  <CheckCircle2 className="w-5 h-5 text-amber-400" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 text-center sm:text-left pt-2 sm:pt-0">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center justify-center sm:justify-start gap-2">
                <span>{authorName}</span>
                {listing.posterVerified && <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />}
              </h1>
              {/* Rating stars sit right under the name, nudged toward the right on every
                  screen size (not just tablet/desktop — a phone-width viewer wouldn't have
                  seen any shift before, since it stayed centered below the `sm:` breakpoint).
                  The left padding shifts the centered group right without jumping it flush
                  to the edge; on wider screens it also right-aligns fully. Tapping it now
                  goes straight to the dedicated Reviews page instead of scrolling down. */}
              {!reviewsLoading && reviews.length > 0 && (
                <button
                  onClick={onViewAllReviews}
                  className="w-full flex items-center justify-center sm:justify-end gap-2 pl-10 sm:pl-0 mt-1.5 hover:opacity-80 transition-opacity"
                >
                  <StarRow rating={averageRating} />
                  <span className="text-xs font-bold text-white">{averageRating.toFixed(1)}</span>
                  <span className="text-xs text-neutral-500 underline decoration-neutral-700 underline-offset-2">
                    ({reviews.length} review{reviews.length !== 1 ? 's' : ''})
                  </span>
                </button>
              )}
              <div className="text-sm text-amber-400 font-bold flex items-center justify-center sm:justify-start gap-1.5 mt-1.5">
                <Building2 className="w-4 h-4 shrink-0" />
                <span>{companyName}</span>
                {listing.companySector && <span className="text-neutral-500 font-normal">• {listing.companySector}</span>}
              </div>
            </div>
          </div>

          {/* Action Buttons — small "Client" + "Message" buttons that fit on one line */}
          <div className="flex flex-row gap-2 mt-5 max-w-xs mx-auto sm:mx-0">
            <button
              onClick={() => onToggleClient(companyName)}
              className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                isClient
                  ? 'bg-amber-400/20 border border-amber-400/50 text-amber-400 hover:bg-amber-400/30'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-200 hover:text-amber-400'
              }`}
            >
              {isClient ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
              <span>Client</span>
            </button>

            <button
              onClick={() => onInboxContact(listing)}
              className="flex-1 py-2 px-3 rounded-lg bg-amber-400 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-amber-300 transition-all shadow-sm"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Message</span>
            </button>

            {onShowOtherContactOptions && hasAvailableExternalContactMethods(listing) && (
              <button
                onClick={() => onShowOtherContactOptions(listing)}
                className="shrink-0 w-9 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-amber-400 transition-all active:scale-95 flex items-center justify-center"
                title="Other ways to contact (WhatsApp, Email, DM)"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Stats Bar — Clients, Rating, right under the action buttons */}
          <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-neutral-800/60">
            <div className="text-center py-1">
              <div className="text-lg font-extrabold text-amber-400">{formatCompactNumber(totalClients)}</div>
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Clients</div>
            </div>
            <div className="text-center py-1 border-l border-neutral-800/60">
              <div className="text-lg font-extrabold text-amber-400">
                {reviews.length > 0 ? averageRating.toFixed(1) : '—'}
              </div>
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Rating</div>
            </div>
          </div>
        </div>
      </div>

      {/* Below-the-fold content stays comfortably readable width; only the cover photo
          and header area above are full-bleed edge-to-edge. */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 pb-10 space-y-4">
        {/* About */}
        {listing.posterBusinessDetails && (
          <div className="bg-black p-5 rounded-xl border border-neutral-800">
            <div className="text-[10px] font-bold uppercase text-neutral-500 mb-2 tracking-wider">
              About the Organisation
            </div>
            <div className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {listing.posterBusinessDetails}
            </div>
          </div>
        )}

        {/* Products & Services — full list lives entirely on its own page */}
        <button
          onClick={onViewAllPosts}
          disabled={companyListings.length === 0}
          className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-black border border-neutral-800 hover:border-amber-400/50 hover:bg-neutral-950 transition-all disabled:cursor-default disabled:hover:border-neutral-800 disabled:hover:bg-black text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white">Products & Services</div>
              <div className="text-xs text-neutral-500">
                {companyListings.length === 0
                  ? 'No products and services posted yet'
                  : `${companyListings.length} post${companyListings.length !== 1 ? 's' : ''} by ${companyName}`}
              </div>
            </div>
          </div>
          {companyListings.length > 0 && <ChevronRight className="w-4 h-4 text-neutral-600 shrink-0" />}
        </button>

        {/* Reviews & Ratings — full read/write/edit/delete experience lives entirely on its own page */}
        <button
          onClick={onViewAllReviews}
          className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-black border border-neutral-800 hover:border-amber-400/50 hover:bg-neutral-950 transition-all text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <MessageSquareText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white">Reviews &amp; Ratings</div>
              <div className="text-xs text-neutral-500">
                {reviewsLoading
                  ? 'Loading…'
                  : reviews.length === 0
                  ? 'No reviews yet — be the first'
                  : `${averageRating.toFixed(1)} average · ${reviews.length} review${reviews.length !== 1 ? 's' : ''}`}
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-600 shrink-0" />
        </button>

        {/* Verification Docs */}
        {listing.posterVerificationDocs && listing.posterVerificationDocs.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase text-neutral-500 tracking-wider">Verification Documents</h2>
            <div className="space-y-1.5">
              {listing.posterVerificationDocs.map((doc, idx) => (
                <a
                  key={idx}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-black border border-neutral-800 text-xs text-neutral-300 hover:text-amber-400 transition-all"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{doc.name}</span>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Full-size profile picture viewer */}
      {listing.posterProfilePic && (
        <ImageViewerModal
          isOpen={isAvatarViewerOpen}
          images={[listing.posterProfilePic]}
          initialIndex={0}
          title={authorName}
          onClose={() => setIsAvatarViewerOpen(false)}
        />
      )}
    </div>
  );
};
