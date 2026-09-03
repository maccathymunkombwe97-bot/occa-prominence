import React, { useState, useRef } from 'react';
import { 
  X, 
  MapPin, 
  Share2, 
  MessageCircle, 
  ExternalLink, 
  Building2, 
  CheckCircle2,
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  MoreHorizontal
} from 'lucide-react';
import { Listing } from '../types';
import { getCategoryIcon } from './ListingCard';
import { ImageViewerModal } from './ImageViewerModal';
import { hasAvailableExternalContactMethods } from '../utils/contactAvailability';

interface DetailSheetProps {
  listing: Listing | null;
  /** Still accepted for prop-shape parity with ListingCard's caller — this sheet no
   * longer renders a like/save control itself. */
  isSaved: boolean;
  onClose: () => void;
  onToggleSave: (id: string) => void;
  onShare: (listing: Listing) => void;
  onInboxContact: (listing: Listing) => void;
  onOpenAuthorProfile: (listing: Listing) => void;
  onShowOtherContactOptions?: (listing: Listing) => void;
}

export const DetailSheet: React.FC<DetailSheetProps> = ({
  listing,
  isSaved,
  onClose,
  onToggleSave,
  onShare,
  onInboxContact,
  onOpenAuthorProfile,
  onShowOtherContactOptions,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);
  const [justShared, setJustShared] = useState(false);

  // Touch gesture refs
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  if (!listing) return null;

  const authorName = listing.posterName || listing.companyName;

  const handleNextImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!listing.images || listing.images.length <= 1) return;
    setActiveImageIndex((prev) => (prev + 1) % listing.images.length);
  };

  const handlePrevImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!listing.images || listing.images.length <= 1) return;
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : listing.images.length - 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 40) {
      handleNextImage();
    } else if (distance < -40) {
      handlePrevImage();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleShareClick = () => {
    onShare(listing);
    setJustShared(true);
    setTimeout(() => setJustShared(false), 1400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity animate-in fade-in">
      <div 
        className="w-full max-w-2xl max-h-[92vh] bg-neutral-900 border border-neutral-800 rounded-t-xl sm:rounded-xl overflow-hidden flex flex-col shadow-xl animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-black">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
            {getCategoryIcon(listing.category)}
            <span>{listing.category} Listing</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sheet Content Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Image Gallery Carousel with Touch Swiping & Click to Full View */}
          {listing.images && listing.images.length > 0 && (
            <div 
              className="relative aspect-[4/3] h-72 sm:h-80 w-full rounded-xl bg-black overflow-hidden border border-neutral-800 cursor-pointer"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={() => setIsViewerOpen(true)}
            >
              <img
                src={listing.images[activeImageIndex]}
                alt={`${listing.title} photo ${activeImageIndex + 1}`}
                className="w-full h-full object-cover transition-opacity duration-300"
              />

              {/* Carousel Dots */}
              {listing.images.length > 1 && (
                <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 z-10">
                  {listing.images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageIndex(idx);
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

          {/* Author Badge */}
          {authorName && (
            <div 
              onClick={() => onOpenAuthorProfile(listing)}
              className="flex items-center gap-2.5 p-3 rounded-lg bg-black border border-neutral-800 cursor-pointer hover:border-amber-400/50 transition-all"
            >
              {listing.posterProfilePic ? (
                <img
                  src={listing.posterProfilePic}
                  alt={authorName}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAvatarViewerOpen(true);
                  }}
                  className="w-9 h-9 rounded-full object-cover bg-neutral-800 border border-neutral-700"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-amber-400 text-sm">
                  {authorName[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-bold text-white truncate">
                  <span>{authorName}</span>
                  {listing.posterVerified && (
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                </div>
                <div className="text-xs text-neutral-400 truncate">
                  {listing.companyName}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-amber-400 hover:underline shrink-0">
                View Profile
              </span>
            </div>
          )}

          {/* Title & Organization */}
          <div>
            <h2 className="text-xl font-bold text-white leading-snug mb-1">
              {listing.title}
            </h2>
            <div className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{listing.companyName}</span>
              {listing.companySector && <span className="text-neutral-500 font-normal">• {listing.companySector}</span>}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {(listing.town || listing.country) && (
              <div className="p-3 bg-black border border-neutral-800 rounded-lg">
                <div className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider mb-1">
                  Location
                </div>
                <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1 truncate">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">
                    {[listing.town, listing.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              </div>
            )}

            {listing.compensation && (
              <div className="p-3 bg-black border border-neutral-800 rounded-lg">
                <div className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider mb-1">
                  Compensation
                </div>
                <div className="text-xs font-bold text-amber-400 truncate">
                  {listing.compensation}
                </div>
              </div>
            )}

            {listing.type && (
              <div className="p-3 bg-black border border-neutral-800 rounded-lg">
                <div className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider mb-1">
                  Type
                </div>
                <div className="text-xs font-semibold text-neutral-200 truncate">
                  {listing.type}
                </div>
              </div>
            )}
          </div>

          {/* About & Description */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Overview & Opportunity Details
            </div>
            <div className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed bg-black p-4 rounded-lg border border-neutral-800">
              {listing.description}
            </div>
          </div>

          {/* Requirements */}
          {listing.requirements && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Application & Technical Requirements
              </div>
              <div className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed bg-black p-4 rounded-lg border border-neutral-800">
                {listing.requirements}
              </div>
            </div>
          )}

          {/* External Link */}
          {listing.externalLink && (
            <a
              href={listing.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 p-3.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-sm transition-all border border-neutral-700"
            >
              <ExternalLink className="w-4 h-4 text-amber-400" />
              <span>Visit Official External Link</span>
            </a>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-800 bg-black flex items-stretch gap-2 shrink-0">
          <div className="grid grid-cols-2 gap-2.5 flex-1 min-w-0">
          <button
            onClick={handleShareClick}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border font-semibold text-xs transition-all duration-300 active:scale-95 ${
              justShared
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 animate-share-pop'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white'
            }`}
            title="Share"
          >
            {justShared ? (
              <Check className="w-4 h-4 text-emerald-400 animate-check-in" />
            ) : (
              <Share2 className="w-4 h-4 text-neutral-400" />
            )}
            <span>{justShared ? 'Shared' : 'Share'}</span>
          </button>

          <button
            onClick={() => onInboxContact(listing)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-amber-400 text-black font-bold text-xs uppercase tracking-wider hover:bg-amber-300 transition-all shadow-sm"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Message</span>
          </button>
          </div>

          {onShowOtherContactOptions && hasAvailableExternalContactMethods(listing) && (
            <button
              onClick={() => onShowOtherContactOptions(listing)}
              className="shrink-0 w-10 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-amber-400 transition-all active:scale-95 flex items-center justify-center"
              title="Other ways to contact (WhatsApp, Email, DM)"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
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
    </div>
  );
};
