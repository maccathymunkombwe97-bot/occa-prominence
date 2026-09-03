import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Share2, 
  MessageCircle, 
  CheckCircle2, 
  Check,
  Package, 
  Wrench, 
  Handshake, 
  FileText, 
  Building2, 
  Rocket,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  MoreHorizontal
} from 'lucide-react';
import { Listing, ListingCategory } from '../types';
import { ImageViewerModal } from './ImageViewerModal';
import { hasAvailableExternalContactMethods } from '../utils/contactAvailability';

interface ListingCardProps {
  listing: Listing;
  /** Still accepted from parents that track it for feed-ranking purposes (see
   * scoreAndRankListings) — this card no longer renders a like/save control itself. */
  isSaved: boolean;
  isMyPost?: boolean;
  autoRotateCarousel?: boolean;
  onOpenDetail: (listing: Listing) => void;
  onOpenAuthorProfile: (listing: Listing) => void;
  onToggleSave: (listingId: string) => void;
  onShare: (listing: Listing) => void;
  onInboxContact: (listing: Listing) => void;
  /** Opens the WhatsApp/Email/DM picker for this listing's poster — optional secondary
   * channels alongside in-app Messages. Omitted only shows the button when provided. */
  onShowOtherContactOptions?: (listing: Listing) => void;
}

export const getCategoryIcon = (cat: ListingCategory) => {
  switch (cat) {
    case 'products':
      return <Package className="w-3.5 h-3.5" />;
    case 'services':
      return <Wrench className="w-3.5 h-3.5" />;
    case 'partnerships':
      return <Handshake className="w-3.5 h-3.5" />;
    case 'tenders':
      return <FileText className="w-3.5 h-3.5" />;
    case 'acquisitions':
      return <Building2 className="w-3.5 h-3.5" />;
    case 'ventures':
      return <Rocket className="w-3.5 h-3.5" />;
    default:
      return <Package className="w-3.5 h-3.5" />;
  }
};

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  isSaved,
  isMyPost = false,
  autoRotateCarousel = true,
  onOpenDetail,
  onOpenAuthorProfile,
  onToggleSave,
  onShare,
  onInboxContact,
  onShowOtherContactOptions,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);
  const [justShared, setJustShared] = useState(false);

  // Swipe gesture refs — X and Y are both tracked so a swipe can be told apart
  // from an ordinary vertical scroll through the feed (see handleTouchEnd).
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);

  // Auto-rotate uses a self-rescheduling timeout (not setInterval) so that any
  // manual navigation — next/prev arrow, dot tap, or a swipe — pushes the next
  // auto tick a full interval out. Previously the interval ran on a fixed clock
  // regardless of manual taps, so a manual swipe could be immediately followed
  // by an auto-tick a moment later, reading as a jarring double-flip instead of
  // one gentle change.
  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageCount = listing.images?.length ?? 0;

  const scheduleAutoRotate = React.useCallback(() => {
    if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    if (!autoRotateCarousel || imageCount <= 1 || isViewerOpen) return;
    rotateTimerRef.current = setTimeout(() => {
      setActiveImageIndex((prev) => (prev + 1) % imageCount);
      scheduleAutoRotate();
    }, 7000);
  }, [autoRotateCarousel, imageCount, isViewerOpen]);

  useEffect(() => {
    scheduleAutoRotate();
    return () => {
      if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    };
  }, [scheduleAutoRotate]);

  const goToImage = (index: number) => {
    if (!listing.images || listing.images.length <= 1) return;
    setActiveImageIndex(index);
    scheduleAutoRotate();
  };

  const handleNextImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (imageCount <= 1) return;
    goToImage((activeImageIndex + 1) % imageCount);
  };

  const handlePrevImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (imageCount <= 1) return;
    goToImage(activeImageIndex > 0 ? activeImageIndex - 1 : imageCount - 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    // Reset any stale end position from a previous, incomplete gesture.
    touchEndX.current = null;
    touchEndY.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (
      touchStartX.current === null ||
      touchEndX.current === null ||
      touchStartY.current === null ||
      touchEndY.current === null
    ) {
      touchStartX.current = null;
      touchEndX.current = null;
      touchStartY.current = null;
      touchEndY.current = null;
      return;
    }

    const dx = touchStartX.current - touchEndX.current;
    const dy = touchStartY.current - touchEndY.current;

    // Only treat this as an image swipe when the motion is clearly horizontal
    // and deliberate — otherwise an ordinary vertical scroll past the post
    // (which always carries a little horizontal wobble) ends up flipping the
    // image underneath the user's thumb.
    const isDeliberateSwipe = Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5;

    if (isDeliberateSwipe) {
      e.stopPropagation();
      if (dx > 0) {
        handleNextImage();
      } else {
        handlePrevImage();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
    touchStartY.current = null;
    touchEndY.current = null;
  };

  const getInitials = (name: string) => {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  };

  const handleShareClick = () => {
    onShare(listing);
    setJustShared(true);
    setTimeout(() => setJustShared(false), 1400);
  };

  const authorName = listing.posterName || listing.companyName;

  return (
    <article className="py-6 border-b border-slate-200/80 dark:border-neutral-800 transition-all group/post">
      {/* Author Header */}
      {authorName && (
        <div className="flex items-center justify-between gap-3 mb-3">
          <div 
            className="flex items-center gap-2.5 cursor-pointer group/author"
          >
            {listing.posterProfilePic ? (
              <img 
                src={listing.posterProfilePic} 
                alt={authorName}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAvatarViewerOpen(true);
                }}
                className="w-8 h-8 rounded-full object-cover bg-neutral-900 border border-neutral-800" 
              />
            ) : (
              <div
                onClick={() => onOpenAuthorProfile(listing)}
                className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs font-bold text-amber-400"
              >
                {getInitials(authorName)}
              </div>
            )}
            <div onClick={() => onOpenAuthorProfile(listing)}>
              <div className="flex items-center gap-1.5 text-xs font-bold text-white group-hover/author:text-amber-400 transition-colors">
                <span>{authorName}</span>
                {listing.posterVerified && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
              </div>
              <div className="text-[11px] text-neutral-400">
                {listing.companyName} {listing.companySector && `• ${listing.companySector}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-md border border-amber-400/30">
              {getCategoryIcon(listing.category)}
              {listing.category}
            </span>
            {isMyPost && (
              <span className="text-[10px] font-bold text-neutral-300 bg-neutral-800 px-2 py-0.5 rounded-md border border-neutral-700">
                Your Post
              </span>
            )}
          </div>
        </div>
      )}

      {/* Post Content Body */}
      <div className="space-y-2.5 cursor-pointer" onClick={() => onOpenDetail(listing)}>
        <h3 className="text-lg font-bold text-white leading-snug group-hover/post:text-amber-400 transition-colors">
          {listing.title}
        </h3>

        {listing.description && (
          <p className="text-xs text-neutral-300 line-clamp-3 leading-relaxed">
            {listing.description}
          </p>
        )}

        {/* Media Carousel (Clean image with touch swiping & full view click) */}
        {listing.images && listing.images.length > 0 && (
          <div 
            className="relative aspect-[4/3] h-96 sm:h-[30rem] w-full rounded-none bg-neutral-900 overflow-hidden my-3 border border-neutral-800/80 cursor-pointer"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={() => setIsViewerOpen(true)}
          >
            {/* Crossfading image layers — previously this swapped the <img> `src` directly,
                which just cuts to the new photo the instant it decodes (worse if it's still
                loading, since the frame goes blank first). Stacking each image absolutely and
                fading the incoming one in over the outgoing one gives a smooth dissolve for
                both the auto-rotate timer and manual next/prev/dot taps. */}
            <AnimatePresence initial={false}>
              <motion.img
                key={activeImageIndex}
                src={listing.images[activeImageIndex]}
                alt={listing.title}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            </AnimatePresence>

            {/* Carousel Dots */}
            {listing.images.length > 1 && (
              <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 z-10">
                {listing.images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      goToImage(idx);
                    }}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === activeImageIndex ? 'w-4 bg-amber-400' : 'w-1.5 bg-neutral-500/80 shadow-xs'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Meta tags */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-neutral-400">
          {(listing.town || listing.country) && (
            <div className="flex items-center gap-1 font-medium text-neutral-300">
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{[listing.town, listing.country].filter(Boolean).join(', ')}</span>
            </div>
          )}

          {listing.compensation && (
            <div className="font-bold text-amber-400 bg-neutral-900 border border-amber-400/30 px-2.5 py-0.5 rounded-md text-xs">
              {listing.compensation}
            </div>
          )}
        </div>
      </div>

      {/* Clean Action Footer */}
      <div className="flex items-stretch gap-2 pt-3.5 mt-3 border-t border-neutral-800/80" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-2 gap-3 flex-1 min-w-0">
        <button
          onClick={handleShareClick}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all duration-300 active:scale-95 ${
            justShared
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 animate-share-pop'
              : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
          }`}
        >
          {justShared ? (
            <Check className="w-3.5 h-3.5 text-emerald-400 animate-check-in" />
          ) : (
            <Share2 className="w-3.5 h-3.5 text-neutral-400" />
          )}
          <span>{justShared ? 'Shared' : 'Share'}</span>
        </button>

        <button
          onClick={() => onInboxContact(listing)}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-amber-400 text-black text-xs font-bold hover:bg-amber-300 transition-all active:scale-98 shadow-sm"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>Message</span>
        </button>
        </div>

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

      {/* Full Image Viewer & Downloader Modal */}
      {listing.images && listing.images.length > 0 && (
        <ImageViewerModal
          isOpen={isViewerOpen}
          images={listing.images}
          initialIndex={activeImageIndex}
          title={listing.title}
          onClose={() => setIsViewerOpen(false)}
        />
      )}

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
    </article>
  );
};
