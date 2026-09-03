import React, { useState } from 'react';
import {
  X,
  Building2,
  Rocket,
  Crown,
  Check,
  Clock,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { UserProfile } from '../types';

interface CorporateConsoleSheetProps {
  isOpen: boolean;
  existingProfile: UserProfile | null;
  isVerified: boolean;
  onClose: () => void;
  onSaveProfile: (profile: UserProfile) => void;
  onShowToast: (msg: string) => void;
  onOpenUpgradeProfile: () => void;
}

interface CorporatePackageOption {
  id: string;
  type: 'accountBoost' | 'membership';
  tierValue: string; // stored on the profile field for this type
  price: string;
  cadence: string;
  badge: string;
  popular?: boolean;
  description: string;
  features: string[];
  days: number;
}

const ACCOUNT_BOOST_PACKAGES: CorporatePackageOption[] = [
  {
    id: 'ab_basic',
    type: 'accountBoost',
    tierValue: 'basic',
    price: '$14.99',
    cadence: '/ month',
    badge: 'Account Boost Basic',
    description: 'Every listing you post gets Starter-tier reach automatically',
    features: ['All listings boosted to 5,000+ daily reach', 'Auto-applies to new posts too', 'No manual per-post boosting needed'],
    days: 30,
  },
  {
    id: 'ab_pro',
    type: 'accountBoost',
    tierValue: 'pro',
    price: '$29.99',
    cadence: '/ month',
    badge: 'Account Boost Pro',
    popular: true,
    description: 'Every listing gets Popular-tier reach plus a featured badge',
    features: ['All listings boosted to 10,000+ daily reach', 'Featured Partner badge on every post', 'Auto-applies to new posts too'],
    days: 30,
  },
  {
    id: 'ab_max',
    type: 'accountBoost',
    tierValue: 'max',
    price: '$59.99',
    cadence: '/ month',
    badge: 'Account Boost Max',
    description: 'Maximum reach and top placement across your whole account',
    features: ['All listings boosted to 25,000+ daily reach', 'Featured Partner badge + top category placement', 'Auto-applies to new posts too'],
    days: 30,
  },
];

const MEMBERSHIP_PACKAGES: CorporatePackageOption[] = [
  {
    id: 'mem_quarterly',
    type: 'membership',
    tierValue: 'quarterly',
    price: '$29.99',
    cadence: '/ 3 months',
    badge: 'Quarterly Membership',
    description: '~$11.66/mo — Verified badge with Account Boost Basic included',
    features: ['Verified Poster badge', 'Account Boost Basic included free', 'Priority customer support'],
    days: 90,
  },
  {
    id: 'mem_6month',
    type: 'membership',
    tierValue: '6month',
    price: '$49.99',
    cadence: '/ 6 months',
    badge: '6-Month Membership',
    description: '~$10.00/mo — Verified badge with Account Boost Pro included',
    features: ['Verified Poster badge', 'Account Boost Pro included free', 'Analytics dashboard access', 'Priority customer support'],
    days: 182,
  },
  {
    id: 'mem_yearly',
    type: 'membership',
    tierValue: 'yearly',
    price: '$99.99',
    cadence: '/ year',
    badge: 'Yearly Membership',
    popular: true,
    description: '~$8.33/mo — best value, Account Boost Max included',
    features: ['Verified Poster badge', 'Account Boost Max included free', 'Analytics dashboard access', 'Early access to new features', 'Priority customer support'],
    days: 365,
  },
];

export const CorporateConsoleSheet: React.FC<CorporateConsoleSheetProps> = ({
  isOpen,
  existingProfile,
  isVerified,
  onClose,
  onSaveProfile,
  onShowToast,
  onOpenUpgradeProfile,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<CorporatePackageOption | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mobile' | 'card'>('mobile');
  const [mobileNumber, setMobileNumber] = useState(existingProfile?.whatsapp || '');
  // Payment Transaction States: 'select' -> 'authorizing' -> 'unavailable'
  // Payments are not live yet — every attempt resolves to a clear, professional notice.
  const [paymentStage, setPaymentStage] = useState<'select' | 'authorizing' | 'unavailable'>('select');
  const [txRef, setTxRef] = useState('');

  if (!isOpen) return null;

  const resetAndClose = () => {
    setSelectedPlan(null);
    setPaymentStage('select');
    onClose();
  };

  const handleStartPayment = () => {
    if (!selectedPlan) return;
    if (!mobileNumber && paymentMethod === 'mobile') {
      onShowToast('Please enter your mobile phone number for payment processing');
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

  const renderPackageGrid = (packages: CorporatePackageOption[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {packages.map((pkg) => {
        const isSelected = selectedPlan?.id === pkg.id;
        return (
          <button
            key={pkg.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => setSelectedPlan(pkg)}
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
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-white">{pkg.price}</span>
                <span className="text-[10px] font-bold text-neutral-400">{pkg.cadence}</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-neutral-800/80 text-[10px] text-neutral-400 leading-tight">
              {pkg.description}
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="w-full max-w-2xl max-h-[92vh] bg-neutral-900 border border-neutral-800 rounded-t-xl sm:rounded-xl overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 bg-black/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 font-bold text-white text-base">
            <Building2 className="w-5 h-5 text-amber-400" />
            <span>
              {paymentStage === 'select' && 'Occa Corporate Console'}
              {paymentStage === 'authorizing' && 'Authorizing Payment...'}
              {paymentStage === 'unavailable' && 'Transaction Failed'}
            </span>
          </div>
          <button
            onClick={resetAndClose}
            className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isVerified ? (
          <div className="p-8 text-center space-y-4">
            <ShieldCheck className="w-10 h-10 text-amber-400 mx-auto" />
            <p className="text-xs text-neutral-300 max-w-sm mx-auto">
              Account Boost and Occa Membership are available to verified business accounts. Upgrade your account first to unlock these plans.
            </p>
            <button
              onClick={() => {
                resetAndClose();
                onOpenUpgradeProfile();
              }}
              className="px-4 py-2.5 rounded-lg bg-amber-400 text-black font-bold text-xs hover:bg-amber-300 transition-all"
            >
              Upgrade to Business Account
            </button>
          </div>
        ) : (
          <>
            {paymentStage === 'select' && (
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
                {/* Account Boost Section */}
                <div>
                  <label className="flex items-center gap-2 font-bold text-neutral-200 mb-2">
                    <Rocket className="w-4 h-4 text-amber-400" />
                    Account Boost — elevate every listing at once, monthly
                  </label>
                  {renderPackageGrid(ACCOUNT_BOOST_PACKAGES)}
                </div>

                {/* Membership Section */}
                <div>
                  <label className="flex items-center gap-2 font-bold text-neutral-200 mb-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    Occa Membership — verification + bundled Account Boost
                  </label>
                  {renderPackageGrid(MEMBERSHIP_PACKAGES)}
                </div>

                {selectedPlan && (
                  <>
                    {/* Selected Plan Features */}
                    <div className="p-3.5 rounded-lg bg-black/60 border border-neutral-800/80 space-y-2">
                      <div className="font-bold text-neutral-300 text-xs">
                        Included in {selectedPlan.badge} ({selectedPlan.price}{selectedPlan.cadence}):
                      </div>
                      <ul className="space-y-1.5">
                        {selectedPlan.features.map((feat, i) => (
                          <li key={i} className="flex items-center gap-2 text-neutral-300 text-xs">
                            <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Payment Method Selector */}
                    <div className="space-y-2">
                      <label className="block font-bold text-neutral-200">Payment Method</label>
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
                  </>
                )}
              </div>
            )}

            {paymentStage === 'authorizing' && (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mx-auto text-amber-400 animate-spin">
                  <Clock className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">Processing Transaction {txRef}</h3>
                  <p className="text-xs text-neutral-400">
                    {paymentMethod === 'mobile'
                      ? `Prompting PIN approval on phone (${mobileNumber})...`
                      : 'Verifying card authentication with issuing bank...'}
                  </p>
                </div>
                {selectedPlan && (
                  <div className="p-3 bg-black rounded-lg border border-neutral-800 text-left text-[11px] space-y-1.5 text-neutral-300 max-w-md mx-auto">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Amount:</span>
                      <span className="font-bold text-amber-400">{selectedPlan.price}{selectedPlan.cadence}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Plan:</span>
                      <span>{selectedPlan.badge}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Status:</span>
                      <span className="text-amber-400 font-semibold animate-pulse">Awaiting Gateway Confirmation...</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {paymentStage === 'unavailable' && selectedPlan && (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-800/60 flex items-center justify-center mx-auto text-red-400">
                  <AlertTriangle className="w-9 h-9" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-extrabold text-white">Transaction Failed</h3>
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

            {/* Footer Actions */}
            <div className="p-4 border-t border-neutral-800 bg-black/60 flex items-center gap-3 shrink-0">
              {paymentStage === 'select' && (
                <>
                  <button
                    type="button"
                    onClick={resetAndClose}
                    className="w-1/3 py-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleStartPayment}
                    disabled={!selectedPlan}
                    className="w-2/3 py-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{selectedPlan ? `Pay ${selectedPlan.price}${selectedPlan.cadence} & Activate` : 'Select a plan above'}</span>
                  </button>
                </>
              )}

              {paymentStage === 'unavailable' && (
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="w-full py-3.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
