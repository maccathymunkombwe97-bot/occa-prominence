import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, MessageCircle, Package, Wrench, Sparkles, ShieldCheck } from 'lucide-react';
import { Listing, ListingCategory, AppSettings } from '../types';
import { ListingCard } from './ListingCard';

interface HomePageProps {
  listings: Listing[];
  savedPostIds: string[];
  myPostIds: string[];
  activeCategory: ListingCategory | 'all';
  viewMode: 'cards' | 'table';
  settings: AppSettings;
  onUpdateSettings: (updated: Partial<AppSettings>) => void;
  onSelectCategory: (cat: ListingCategory | 'all') => void;
  onToggleViewMode: () => void;
  onOpenDetail: (listing: Listing) => void;
  onOpenAuthorProfile: (listing: Listing) => void;
  onToggleSave: (listingId: string) => void;
  onShare: (listing: Listing) => void;
  onInboxContact: (listing: Listing) => void;
  onShowOtherContactOptions?: (listing: Listing) => void;
  onOpenNewPost: () => void;
  isBusinessAccount?: boolean;
}

const CATEGORIES: { id: ListingCategory | 'all'; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'products', label: 'Products', icon: <Package className="w-3.5 h-3.5" /> },
  { id: 'services', label: 'Services', icon: <Wrench className="w-3.5 h-3.5" /> },
];

export const HomePage: React.FC<HomePageProps> = ({
  listings,
  savedPostIds,
  myPostIds,
  activeCategory,
  settings,
  onSelectCategory,
  onOpenDetail,
  onOpenAuthorProfile,
  onToggleSave,
  onShare,
  onInboxContact,
  onShowOtherContactOptions,
}) => {
  const visible = listings.filter((l) => activeCategory === 'all' || l.category === activeCategory);

  return (
    <div className="min-h-screen pb-24 bg-black text-white">
      <section className="relative overflow-hidden border-b border-neutral-800 bg-gradient-to-b from-neutral-950 via-black to-black">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-16">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }} className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[10px] font-black uppercase tracking-[.18em] mb-5">
              <ShieldCheck className="w-3.5 h-3.5" /> Official OCCA Store
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[.95]">
              Technology built for <span className="text-amber-400">your business.</span>
            </h1>
            <p className="mt-5 text-sm sm:text-base text-neutral-400 max-w-xl leading-relaxed">
              Explore OCCA products and digital services, see what we offer, and contact our team directly from the app.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={() => onSelectCategory('products')} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 text-black px-5 py-3 text-xs font-black uppercase tracking-wider hover:bg-amber-300 transition-colors">
                Browse products <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => onSelectCategory('services')} className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white px-5 py-3 text-xs font-black uppercase tracking-wider hover:border-neutral-700 transition-colors">
                Our services
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 pt-7">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-black">What we offer</h2>
            <p className="text-xs text-neutral-500 mt-1">Products and services from OCCA</p>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button key={cat.id} onClick={() => onSelectCategory(cat.id)} className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors ${activeCategory === cat.id ? 'bg-amber-400 border-amber-400 text-black' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white'}`}>
                {cat.icon}{cat.label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-10 text-center">
            <Package className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
            <h3 className="font-bold">More coming soon</h3>
            <p className="text-xs text-neutral-500 mt-1">OCCA is preparing more products and services for you.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isSaved={savedPostIds.includes(listing.id)}
                isMyPost={false}
                autoRotateCarousel={settings.autoRotateCarousel}
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
      </main>
    </div>
  );
};
