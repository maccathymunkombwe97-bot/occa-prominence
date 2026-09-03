import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Rocket, 
  ExternalLink, 
  Share2, 
  Clock, 
  ShieldCheck, 
  Building2, 
  MapPin, 
  Check, 
  X, 
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Listing, UserProfile } from '../types';
import { isBoostActive } from '../utils/feedScoring';
import { BOOSTS_ENABLED } from '../config/featureFlags';

interface MyPostsPageProps {
  listings: Listing[];
  myPostIds: string[];
  profile: UserProfile | null;
  isVerified: boolean;
  onOpenDetail: (listing: Listing) => void;
  onOpenNewPost: () => void;
  onDeleteListing: (listingId: string) => Promise<void>;
  onBoostListing: (listingId: string, boostPackage: string, days: number) => Promise<void>;
  onShare: (listing: Listing) => void;
  onOpenUpgradeProfile: () => void;
}

interface BoostPackageOption {
  id: string;
  price: string;
  duration: string;
  days: number;
  badge: string;
  popular?: boolean;
  description: string;
  features: string[];
}

const BOOST_PACKAGES: BoostPackageOption[] = [
  {
    id: 'starter',
    price: '$4.99',
    duration: '1 month',
    days: 30,
    badge: 'Starter Boost',
    description: '5,000+ guaranteed daily reach for 30 days',
    features: ['5,000+ guaranteed daily reach', 'Top feed placement for 30 days', 'Highlighted gold badge'],
  },
  {
    id: 'popular',
    price: '$9.99',
    duration: '1 month',
    days: 30,
    badge: 'Popular Boost',
    popular: true,
    description: '12,000+ guaranteed daily reach — most-picked tier',
    features: ['12,000+ guaranteed daily reach', 'Pinned placement for 30 days', 'Featured partner badge', 'Priority in category search'],
  },
  {
    id: 'max',
    price: '$19.99',
    duration: '1 month',
    days: 30,
    badge: 'Max Boost',
    description: '35,000+ guaranteed daily reach — maximum visibility',
    features: ['35,000+ guaranteed daily reach', '#1 top pinned placement for 30 days', 'Featured partner badge', 'Instant lead-alert priority'],
  },
];

export const MyPostsPage: React.FC<MyPostsPageProps> = ({
  listings,
  myPostIds,
  profile,
  isVerified,
  onOpenDetail,
  onOpenNewPost,
  onDeleteListing,
  onBoostListing,
  onShare,
  onOpenUpgradeProfile,
}) => {
  // Filter user's published listings. `myPostIds` is derived from each listing's
  // `isOwnPost` flag, which the server computes per-request by comparing the
  // listing's stored posterPhone against the caller's authenticated session
  // phone (see server.ts toPublicListing / requireAuth) — the only source that
  // actually reflects who owns a post.
  //
  // This used to ALSO match listings by companyName/posterName text equality
  // against the signed-in profile. That was the bug: any two accounts that
  // happened to share a name or business name (very possible — e.g. common
  // names, generic company names) would see each other's posts show up as
  // "their own" on this console, with delete/boost buttons on posts they
  // didn't create. Ownership must only ever come from the authenticated,
  // database-verified id match below.
  const myPosts = listings.filter((l) => myPostIds.includes(l.id));

  // Modal States
  const [boostModalListing, setBoostModalListing] = useState<Listing | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<BoostPackageOption>(BOOST_PACKAGES[0]);
  const [paymentMethod, setPaymentMethod] = useState<'mobile' | 'card'>('mobile');
  const [mobileNumber, setMobileNumber] = useState(profile?.whatsapp || '');
  
  // Payment Transaction States: 'select' -> 'authorizing' -> 'unavailable'
  // Payments are not live yet — every attempt resolves to a clear, professional notice.
  const [paymentStage, setPaymentStage] = useState<'select' | 'authorizing' | 'unavailable'>('select');
  const [txRef, setTxRef] = useState('');

  const [deleteModalListing, setDeleteModalListing] = useState<Listing | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleStartPayment = () => {
    if (!mobileNumber && paymentMethod === 'mobile') {
      alert('Please enter your mobile phone number for payment processing');
      return;
    }
    const generatedRef = 'OCCA-' + Math.floor(100000 + Math.random() * 900000);
    setTxRef(generatedRef);
    setPaymentStage('authorizing');

    // Simulate a real gateway round trip, then report that payments aren't live yet
    setTimeout(() => {
      setPaymentStage('unavailable');
    }, 2800);
  };

  const handleCloseBoostModal = () => {
    setBoostModalListing(null);
    setPaymentStage('select');
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalListing) return;
    setIsDeleting(true);
    try {
      await onDeleteListing(deleteModalListing.id);
      setDeleteModalListing(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-8 animate-in fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Corporate Publisher Console
            </span>
            {isVerified && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/30">
                <ShieldCheck className="w-3 h-3" />
                Verified Partner
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            My Published Listings
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl">
            Manage your active tenders, products, and services. Boost reach with targeted promotion packages or delete completed listings.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!isVerified && (
            <button
              onClick={onOpenUpgradeProfile}
              className="px-4 py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-amber-400 font-bold text-xs flex items-center gap-2 transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Upgrade Account</span>
            </button>
          )}

          <button
            onClick={onOpenNewPost}
            className="px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>New Corporate Listing</span>
          </button>
        </div>
      </div>

      {/* Account Info Bar */}
      {profile && (
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {(profile.businessLogoUrl || profile.profilePicUrl) ? (
              <img src={profile.businessLogoUrl || profile.profilePicUrl} alt={profile.companyName || profile.name} className="w-10 h-10 rounded-full object-cover border border-amber-400" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-black border border-amber-400 flex items-center justify-center font-bold text-amber-400 text-sm">
                {(profile.companyName || profile.name)?.[0] || '?'}
              </div>
            )}
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>{profile.companyName || profile.name}</span>
                {isVerified && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
              </div>
              <div className="text-xs text-neutral-400">
                {profile.companyName ? (
                  <>Rep: <span className="text-neutral-200">{profile.name}</span> ({profile.email})</>
                ) : (
                  <span className="text-neutral-200">{profile.bio || 'No business info yet — upgrade to post listings'}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-neutral-400">
            <div>
              <span className="block text-[10px] uppercase font-bold text-neutral-500">Total Published</span>
              <span className="text-base font-black text-white">{myPosts.length}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-neutral-500">Active Boosted</span>
              <span className="text-base font-black text-amber-400">
                {myPosts.filter((p) => isBoostActive(p)).length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Posts Section */}
      {myPosts.length === 0 ? (
        <div className="text-center py-16 px-4 bg-neutral-900/50 border border-neutral-800 rounded-2xl space-y-4">
          <div className="w-16 h-16 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center mx-auto text-amber-400">
            <Zap className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-bold text-white">No Published Listings Yet</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              You haven't posted any corporate listings or tenders under this account yet. Click below to create your first listing.
            </p>
          </div>
          <button
            onClick={onOpenNewPost}
            className="px-6 py-3 rounded-lg bg-amber-400 text-black font-bold text-xs uppercase tracking-wider hover:bg-amber-300 transition-all shadow-md inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Corporate Listing</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myPosts.map((listing) => (
            <div
              key={listing.id}
              className={`p-5 rounded-xl bg-neutral-900 border transition-all flex flex-col justify-between space-y-4 ${
                isBoostActive(listing) 
                  ? 'border-amber-400/80 shadow-lg shadow-amber-400/5 bg-gradient-to-b from-neutral-900 to-amber-950/10' 
                  : 'border-neutral-800 hover:border-neutral-700'
              }`}
            >
              {/* Top Details Header */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-black border border-neutral-800 text-[10px] font-extrabold text-amber-400 uppercase tracking-wider">
                      {listing.category}
                    </span>
                    {isBoostActive(listing) && (
                      <span className="px-2.5 py-1 rounded-md bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                        <Sparkles className="w-3 h-3 fill-current" />
                        <span>Boosted Reach</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-500 font-medium">
                    {new Date(listing.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div>
                  <h3 
                    onClick={() => onOpenDetail(listing)}
                    className="text-base font-bold text-white hover:text-amber-400 transition-colors cursor-pointer leading-snug line-clamp-2"
                  >
                    {listing.title}
                  </h3>
                  <div className="text-xs text-neutral-400 font-semibold flex items-center gap-1.5 mt-1">
                    <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{listing.companyName}</span>
                    {listing.town && <span>• {listing.town}</span>}
                  </div>
                </div>

                <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                  {listing.description}
                </p>

                {isBoostActive(listing) && (
                  <div className="p-2.5 rounded-lg bg-amber-400/10 border border-amber-400/30 text-[11px] text-amber-300 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Rocket className="w-3.5 h-3.5 text-amber-400" />
                      <span>Boost Package: {listing.boostPackage}</span>
                    </div>
                    {listing.boostedUntil && (
                      <span className="text-[10px] text-amber-400/80 font-medium">
                        Active until {new Date(listing.boostedUntil).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {BOOSTS_ENABLED && (
                    <button
                      onClick={() => setBoostModalListing(listing)}
                      className={`px-3.5 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                        isBoostActive(listing)
                          ? 'bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-amber-400/40'
                          : 'bg-amber-400 hover:bg-amber-300 text-black shadow-sm'
                      }`}
                    >
                      <Rocket className="w-3.5 h-3.5" />
                      <span>{isBoostActive(listing) ? 'Extend Boost' : 'Boost Reach'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => onShare(listing)}
                    className="p-2 rounded-lg bg-black hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
                    title="Share Listing"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenDetail(listing)}
                    className="p-2 rounded-lg bg-black hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors text-xs font-semibold"
                    title="View Listing Details"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setDeleteModalListing(listing)}
                    className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-400 hover:text-red-200 transition-colors"
                    title="Delete Post"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Boost Reach Package Selection Modal */}
      {boostModalListing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl animate-in zoom-in-95 space-y-0">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-800 bg-black/60 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-white text-base">
                <Rocket className="w-5 h-5 text-amber-400" />
                <span>
                  {paymentStage === 'select' && 'Boost Reach & Priority Placement'}
                  {paymentStage === 'authorizing' && 'Authorizing Payment...'}
                  {paymentStage === 'unavailable' && 'Transaction Failed'}
                </span>
              </div>
              <button
                onClick={handleCloseBoostModal}
                className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            {paymentStage === 'select' && (
              <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs">
                {/* Selected Listing Preview */}
                <div className="p-3.5 rounded-lg bg-black border border-neutral-800">
                  <div className="text-[10px] uppercase font-bold text-neutral-500 mb-0.5">
                    Target Listing
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {boostModalListing.title}
                  </div>
                  <div className="text-xs text-amber-400 font-medium">
                    {boostModalListing.companyName}
                  </div>
                </div>

                {/* Package Selection */}
                <div>
                  <label className="block font-bold text-neutral-200 mb-2">
                    Select Promotion Package
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {BOOST_PACKAGES.map((pkg) => {
                      const isSelected = selectedPackage.id === pkg.id;
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedPackage(pkg)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between relative text-left w-full ${
                            isSelected
                              ? 'bg-amber-400/10 border-amber-400 text-white shadow-md'
                              : 'bg-black border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                          }`}
                        >
                          {pkg.popular && (
                            <span className="absolute -top-2.5 right-3 bg-amber-400 text-black text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                              Popular
                            </span>
                          )}
                          <div>
                            <div className="text-[10px] font-extrabold uppercase text-amber-400 tracking-wider">
                              {pkg.badge}
                            </div>
                            <div className="text-xl font-black text-white mt-1">
                              {pkg.price}
                            </div>
                            <div className="text-[11px] font-bold text-neutral-300">
                              {pkg.duration}
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-neutral-800/80 text-[10px] text-neutral-400 leading-tight">
                            {pkg.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Package Features List */}
                <div className="p-3.5 rounded-lg bg-black/60 border border-neutral-800/80 space-y-2">
                  <div className="font-bold text-neutral-300 text-xs">
                    Included in {selectedPackage.badge} ({selectedPackage.price}):
                  </div>
                  <ul className="space-y-1.5">
                    {selectedPackage.features.map((feat, i) => (
                      <li key={i} className="flex items-center gap-2 text-neutral-300 text-xs">
                        <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <label className="block font-bold text-neutral-200">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('mobile')}
                      className={`py-2.5 px-3 rounded-lg border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                        paymentMethod === 'mobile'
                          ? 'bg-amber-400/20 border-amber-400 text-amber-400'
                          : 'bg-black border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <span>Mobile Money (MTN / Airtel / Zamtel)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`py-2.5 px-3 rounded-lg border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                        paymentMethod === 'card'
                          ? 'bg-amber-400/20 border-amber-400 text-amber-400'
                          : 'bg-black border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <span>Debit / Credit Card</span>
                    </button>
                  </div>

                  {paymentMethod === 'mobile' && (
                    <div className="pt-2">
                      <label className="block text-[11px] text-neutral-400 mb-1">
                        Mobile Phone Number for Payment Prompt
                      </label>
                      <input
                        type="tel"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="+260 977 123456"
                        className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2 text-white text-xs outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {paymentStage === 'authorizing' && (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mx-auto text-amber-400 animate-spin">
                  <Clock className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">
                    Processing Transaction {txRef}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {paymentMethod === 'mobile' 
                      ? `Prompting PIN approval on phone (${mobileNumber})...`
                      : 'Verifying card authentication with issuing bank...'}
                  </p>
                </div>
                <div className="p-3 bg-black rounded-lg border border-neutral-800 text-left text-[11px] space-y-1.5 text-neutral-300 max-w-md mx-auto">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Amount:</span>
                    <span className="font-bold text-amber-400">{selectedPackage.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Duration:</span>
                    <span>{selectedPackage.duration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Status:</span>
                    <span className="text-amber-400 font-semibold animate-pulse">Awaiting Gateway Confirmation...</span>
                  </div>
                </div>
              </div>
            )}

            {paymentStage === 'unavailable' && (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-800/60 flex items-center justify-center mx-auto text-red-400">
                  <AlertTriangle className="w-9 h-9" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-extrabold text-white">
                    Transaction Failed
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Reference: <span className="text-neutral-400">{txRef}</span>
                  </p>
                </div>
                <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
                  This feature is currently unavailable and will be enabled soon as we finalize secure payment
                  processing. No amount has been charged. Occa is committed to serving you better — thank you
                  for your understanding.
                </p>
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-800 bg-black/60 flex items-center gap-3">
              {paymentStage === 'select' && (
                <>
                  <button
                    type="button"
                    onClick={handleCloseBoostModal}
                    className="w-1/3 py-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleStartPayment}
                    className="w-2/3 py-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Rocket className="w-4 h-4" />
                    <span>Pay {selectedPackage.price} & Authorize Boost</span>
                  </button>
                </>
              )}

              {paymentStage === 'unavailable' && (
                <button
                  type="button"
                  onClick={handleCloseBoostModal}
                  className="w-full py-3.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalListing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xl animate-in zoom-in-95 p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-full bg-red-950/60 border border-red-800/60">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Listing?</h3>
                <p className="text-xs text-neutral-400">This action cannot be reversed.</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 bg-black p-3 rounded-lg border border-neutral-800 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">"{deleteModalListing.title}"</strong>?
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalListing(null)}
                className="w-1/2 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs uppercase transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="w-1/2 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
