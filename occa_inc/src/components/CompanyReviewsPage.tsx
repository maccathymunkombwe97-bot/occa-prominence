import React, { useEffect, useState } from 'react';
import { ArrowLeft, Star, MessageSquareText, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Review, UserProfile } from '../types';
import { ImageViewerModal } from './ImageViewerModal';

interface CompanyReviewsPageProps {
  companyName: string;
  profile: UserProfile | null;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onShowToast: (msg: string) => void;
  onBack: () => void;
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

/** Clickable 1-5 star input for writing/editing a review — centered on its own row. */
const StarPicker: React.FC<{ value: number; onChange: (n: number) => void }> = ({ value, onChange }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className="flex items-center justify-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (hovered ?? value) >= n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            className="p-0.5"
            aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
          >
            <Star className={`w-7 h-7 transition-colors ${filled ? 'text-amber-400 fill-current' : 'text-neutral-700'}`} />
          </button>
        );
      })}
    </div>
  );
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

// Full read/write/edit/delete reviews experience for a company, as its own page —
// reached from CompanyProfilePage's "Reviews & Ratings" link rather than living
// inline on the profile itself.
export const CompanyReviewsPage: React.FC<CompanyReviewsPageProps> = ({
  companyName,
  profile,
  authFetch,
  onShowToast,
  onBack,
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isDeletingReview, setIsDeletingReview] = useState(false);
  const [reviewAvatarViewerSrc, setReviewAvatarViewerSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReviewsLoading(true);
    setIsReviewFormOpen(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName]);

  const averageRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const myReview = reviews.find((r) => r.isOwn);
  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  // A rep can't review their own registered company
  const isOwnCompany = !!(
    profile?.companyName && profile.companyName.trim().toLowerCase() === companyName.trim().toLowerCase()
  );

  const openReviewForm = (existing?: Review) => {
    setReviewRating(existing?.rating || 0);
    setReviewText(existing?.text || '');
    setIsReviewFormOpen(true);
  };

  const handleSubmitReview = async () => {
    if (reviewRating < 1) {
      onShowToast('Please select a star rating.');
      return;
    }
    setIsSubmittingReview(true);
    try {
      const res = await authFetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, rating: reviewRating, text: reviewText.trim() }),
      });
      const data = await res.json();
      if (data.success && data.review) {
        setReviews((prev) => {
          const withoutMine = prev.filter((r) => !r.isOwn);
          return [{ ...data.review, isOwn: true }, ...withoutMine];
        });
        setIsReviewFormOpen(false);
        onShowToast(myReview ? 'Your review was updated.' : 'Your review was posted.');
      } else {
        onShowToast(data.error || 'Failed to submit review.');
      }
    } catch (e) {
      onShowToast('Failed to submit review. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!myReview) return;
    if (!window.confirm('Delete your review? This cannot be undone.')) return;
    setIsDeletingReview(true);
    try {
      const res = await authFetch(`/api/reviews/${myReview.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setReviews((prev) => prev.filter((r) => r.id !== myReview.id));
        onShowToast('Your review was deleted.');
      } else {
        onShowToast(data.error || 'Failed to delete review.');
      }
    } catch (e) {
      onShowToast('Failed to delete review. Please try again.');
    } finally {
      setIsDeletingReview(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-6 animate-in fade-in">
      {/* Back Bar */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-amber-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Profile</span>
      </button>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-extrabold text-white flex items-center gap-2">
          <MessageSquareText className="w-5 h-5 text-amber-400" />
          Reviews for {companyName}
        </h1>
        {!isOwnCompany && !isReviewFormOpen && (
          <button
            onClick={() => openReviewForm(myReview)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>{myReview ? 'Edit Your Review' : 'Write a Review'}</span>
          </button>
        )}
      </div>

      {isOwnCompany && <p className="text-xs text-neutral-500">You can't review your own company.</p>}

      {/* Rating Summary */}
      {!reviewsLoading && reviews.length > 0 && (
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-5 flex flex-col sm:flex-row gap-6">
          <div className="text-center shrink-0 sm:w-32 mx-auto sm:mx-0">
            <div className="text-4xl font-extrabold text-white">{averageRating.toFixed(1)}</div>
            <div className="flex justify-center my-1.5">
              <StarRow rating={averageRating} size="w-4 h-4" />
            </div>
            <div className="text-[11px] text-neutral-500">
              {reviews.length} review{reviews.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="flex-1 space-y-1.5">
            {ratingBreakdown.map(({ star, count }) => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-400 w-8 shrink-0">{star} star</span>
                <div className="flex-1 h-1.5 rounded-full bg-neutral-850 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${reviews.length ? (count / reviews.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[11px] text-neutral-500 w-6 text-right shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Write / Edit Review Form */}
      {isReviewFormOpen && (
        <div className="bg-neutral-900/40 border border-amber-400/30 rounded-xl p-5 space-y-3.5">
          <div className="text-xs font-bold uppercase text-neutral-400 tracking-wider text-center">
            {myReview ? 'Edit Your Review' : 'Rate & Review'} — {companyName}
          </div>
          <StarPicker value={reviewRating} onChange={setReviewRating} />
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Type your review — share your experience working with this company (optional)..."
            rows={4}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-400/50 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmitReview}
              disabled={isSubmittingReview}
              className="flex-1 py-2.5 rounded-lg bg-amber-400 text-black font-bold text-xs uppercase tracking-wider hover:bg-amber-300 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmittingReview && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{myReview ? 'Update Review' : 'Post Review'}</span>
            </button>
            <button
              onClick={() => setIsReviewFormOpen(false)}
              disabled={isSubmittingReview}
              className="py-2.5 px-4 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-xs hover:text-white transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Full Reviews List */}
      {reviewsLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-neutral-500 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading reviews...</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 px-4 bg-neutral-900/50 border border-neutral-800 rounded-2xl">
          <p className="text-sm text-neutral-500">No reviews yet. Be the first to share your experience.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className={`p-4 rounded-lg border ${
                review.isOwn ? 'bg-amber-400/5 border-amber-400/25' : 'bg-neutral-900/40 border-neutral-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {review.authorProfilePic ? (
                    <img
                      src={review.authorProfilePic}
                      alt={review.authorName}
                      onClick={() => setReviewAvatarViewerSrc(review.authorProfilePic!)}
                      className="w-8 h-8 rounded-full object-cover bg-neutral-900 border border-neutral-800 shrink-0 cursor-pointer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">
                      {review.authorName[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">
                      {review.authorName}
                      {review.isOwn && <span className="text-amber-400 font-normal"> (You)</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRow rating={review.rating} />
                      <span className="text-[10px] text-neutral-500">
                        {timeAgo(review.updatedAt || review.createdAt)}
                        {review.updatedAt && review.updatedAt !== review.createdAt ? ' (edited)' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {review.isOwn && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openReviewForm(review)}
                      className="p-1.5 rounded-md text-neutral-400 hover:text-amber-400 hover:bg-neutral-900 transition-colors"
                      title="Edit your review"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleDeleteReview}
                      disabled={isDeletingReview}
                      className="p-1.5 rounded-md text-neutral-400 hover:text-red-400 hover:bg-neutral-900 transition-colors disabled:opacity-50"
                      title="Delete your review"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {review.text && (
                <p className="text-sm text-neutral-300 leading-relaxed mt-2.5 whitespace-pre-wrap">{review.text}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Full-size reviewer profile picture viewer */}
      <ImageViewerModal
        isOpen={!!reviewAvatarViewerSrc}
        images={reviewAvatarViewerSrc ? [reviewAvatarViewerSrc] : []}
        initialIndex={0}
        title="Profile Picture"
        onClose={() => setReviewAvatarViewerSrc(null)}
      />
    </div>
  );
};
