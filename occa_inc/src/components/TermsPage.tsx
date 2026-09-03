import React from 'react';
import { ArrowLeft, ShieldCheck, Quote } from 'lucide-react';

interface TermsPageProps {
  onClose: () => void;
}

/**
 * Full-screen Terms & Conditions overlay. Shared between the sign-in screen (AuthGate)
 * and Settings ("Help & Terms of Service"), so there is exactly one source of truth for
 * this content. Closes back to whatever screen opened it via `onClose`.
 */
export const TermsPage: React.FC<TermsPageProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-black text-neutral-100 overflow-y-auto">
      <div className="sticky top-0 z-10 bg-black/95 backdrop-blur border-b border-neutral-800">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 -ml-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <h1 className="text-sm font-black uppercase tracking-wider text-white">
              Terms &amp; Conditions
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8 text-xs leading-relaxed text-neutral-300">
        <p className="text-neutral-500">Last updated: July 2026</p>

        <section className="space-y-2">
          <h2 className="text-white font-bold text-sm uppercase tracking-wide">1. Acceptance of Terms</h2>
          <p>
            By creating an account or otherwise using Occa Prominence ("Occa", "the platform"), you agree to
            be bound by these Terms &amp; Conditions. If you do not agree, please do not use the platform.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-white font-bold text-sm uppercase tracking-wide">2. Accounts &amp; Eligibility</h2>
          <p>
            You must provide accurate information when registering, including a working phone number used to
            secure your account. You are responsible for keeping your password and security question answer
            confidential, and for all activity that happens under your account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-white font-bold text-sm uppercase tracking-wide">3. Listings &amp; Content</h2>
          <p>
            Businesses that publish listings (products, services, partnerships, tenders, acquisitions, or
            ventures) are solely responsible for the accuracy of what they post. Occa does not manufacture,
            sell, or guarantee any product, service, or opportunity listed on the platform, and does not
            act as a party to any transaction, agreement, or partnership formed between users.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-white font-bold text-sm uppercase tracking-wide">4. Prohibited Conduct</h2>
          <p>
            You agree not to post fraudulent, misleading, or illegal listings; not to impersonate a business
            or individual you do not represent; not to harvest or misuse other users' contact information;
            and not to attempt to disrupt, reverse-engineer, or abuse the platform's systems.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-white font-bold text-sm uppercase tracking-wide">5. Engagement Metrics</h2>
          <p>
            Figures such as likes and client counts shown on posts and company profiles combine real,
            user-driven actions with a modeled organic-growth estimate reflecting typical audience reach
            over time. They are provided for general indicative purposes and are not a guarantee of actual
            traffic, sales, or business outcomes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-white font-bold text-sm uppercase tracking-wide">6. Boosted Listings &amp; Payments</h2>
          <p>
            Boost packages extend a listing's visibility for a fixed period. Fees for boosts and any other
            paid features are non-refundable once a boost period has started, except where required by law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-white font-bold text-sm uppercase tracking-wide">7. Limitation of Liability</h2>
          <p>
            Occa is provided "as is." To the fullest extent permitted by law, Occa and its team are not
            liable for any indirect, incidental, or consequential damages arising from your use of the
            platform or from any dealings between users.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-white font-bold text-sm uppercase tracking-wide">8. Privacy</h2>
          <p>
            Information you provide (profile details, contact information, listings) is used to operate the
            platform and to connect you with other businesses. We do not sell your personal data to third
            parties.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-white font-bold text-sm uppercase tracking-wide">9. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time as the platform grows. Continued use of Occa after
            an update means you accept the revised Terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-white font-bold text-sm uppercase tracking-wide">10. Contact</h2>
          <p>
            Questions about these Terms can be directed to the Occa support team from within the app's
            Settings page.
          </p>
        </section>

        {/* Founder's Note */}
        <section className="pt-4 mt-4 border-t border-neutral-800">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Quote className="w-4 h-4" />
              <span className="font-bold text-[11px] uppercase tracking-wider">A Note From Our Founder</span>
            </div>
            <p className="text-neutral-200 text-sm italic leading-relaxed">
              "Occa is a platform that was built to foster and support entrepreneurship — to give every
              business, from the smallest hustle to the largest enterprise, a real place to be seen, to
              connect, and to grow. An opportunity should never be locked behind someone you already know; it should be
              something anyone with an ambition and the vision can reach. Thank you for building your future with
              us."
            </p>
            <div className="pt-1">
              <p className="text-white font-black text-sm">Maccathy Munkombwe</p>
              <p className="text-amber-400 font-bold text-[11px] uppercase tracking-wider">Founder &amp; CEO, Occa</p>
            </div>
          </div>
        </section>

        <div className="pt-2 pb-8 text-center">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold rounded-lg uppercase tracking-wider text-xs transition-all cursor-pointer"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};
