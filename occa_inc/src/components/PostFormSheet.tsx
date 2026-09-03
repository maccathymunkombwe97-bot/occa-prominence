import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Upload, 
  Trash2, 
  Package, 
  Wrench, 
  Handshake, 
  FileText, 
  Building2, 
  Rocket,
  Sparkles,
  MessageSquare,
  Mail,
  MessageCircle
} from 'lucide-react';
import { ContactMethod, Listing, ListingCategory, UserProfile } from '../types';
import { uploadImageToImgBB } from '../services/imgbbService';

const CONTACT_METHOD_OPTIONS: { id: ContactMethod; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'whatsapp', label: 'WhatsApp', hint: 'Buyers chat with you on WhatsApp', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'email', label: 'Email', hint: 'Buyers write to you via Gmail', icon: <Mail className="w-4 h-4" /> },
  { id: 'dm', label: 'Direct Message', hint: 'Buyers text you via SMS', icon: <MessageCircle className="w-4 h-4" /> },
];

interface PostFormSheetProps {
  isOpen: boolean;
  profile: UserProfile | null;
  onClose: () => void;
  onSubmitListing: (newListing: Omit<Listing, 'id' | 'createdAt'>) => Promise<void>;
  onShowToast: (msg: string) => void;
}

const CATEGORY_OPTIONS: { id: ListingCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'products', label: 'Products', icon: <Package className="w-4 h-4" /> },
  { id: 'services', label: 'Services', icon: <Wrench className="w-4 h-4" /> },
  { id: 'partnerships', label: 'Partnerships', icon: <Handshake className="w-4 h-4" /> },
  { id: 'tenders', label: 'Tenders', icon: <FileText className="w-4 h-4" /> },
  { id: 'acquisitions', label: 'Acquisitions', icon: <Building2 className="w-4 h-4" /> },
  { id: 'ventures', label: 'Ventures', icon: <Rocket className="w-4 h-4" /> },
];

export const PostFormSheet: React.FC<PostFormSheetProps> = ({
  isOpen,
  profile,
  onClose,
  onSubmitListing,
  onShowToast,
}) => {
  const [category, setCategory] = useState<ListingCategory>('products');
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState(profile?.companyName || '');
  const [companySector, setCompanySector] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [town, setTown] = useState('Lusaka');
  const [country, setCountry] = useState('Zambia');
  const [compensation, setCompensation] = useState('');
  const [type, setType] = useState('Direct Sale');
  const [externalLink, setExternalLink] = useState('');
  const [images, setImages] = useState<string[]>([]);
  // No external channel is pre-selected — in-app Messages is always on for every listing,
  // so WhatsApp/Email/SMS here are purely optional extras the poster opts into.
  const [contactMethods, setContactMethods] = useState<ContactMethod[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Sync saved poster account profile data from device storage when sheet opens
  React.useEffect(() => {
    if (isOpen && profile) {
      if (profile.companyName) {
        setCompanyName(profile.companyName);
      }
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleAiEnhance = async () => {
    if (!title.trim()) {
      onShowToast('Please enter a listing title first.');
      return;
    }
    setIsEnhancing(true);
    try {
      const res = await fetch('/api/ai/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, rawDescription: description }),
      });
      const data = await res.json();
      if (data.success && data.enhanced) {
        if (data.enhanced.description) setDescription(data.enhanced.description);
        if (data.enhanced.requirements) setRequirements(data.enhanced.requirements);
        if (data.enhanced.suggestedCompensation && !compensation) setCompensation(data.enhanced.suggestedCompensation);
      } else {
        onShowToast(data.error || 'AI enhancement unavailable.');
      }
    } catch (e) {
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);

    try {
      const results = await Promise.allSettled(
        Array.from<File>(files).map((file) => uploadImageToImgBB(file))
      );
      const uploadedUrls = results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
        .map((r) => r.value);
      const failedCount = results.length - uploadedUrls.length;

      if (uploadedUrls.length > 0) {
        setImages((prev) => [...prev, ...uploadedUrls]);
      }
      if (failedCount > 0) {
        const firstError = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
        onShowToast(
          uploadedUrls.length > 0
            ? `${failedCount} photo(s) failed to upload. The rest were added.`
            : `Photo upload failed: ${firstError?.reason?.message || 'Please try again.'}`
        );
      }
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToggleContactMethod = (method: ContactMethod) => {
    setContactMethods((prev) => {
      if (prev.includes(method)) {
        // Keep at least one channel enabled so buyers always have a way to reach out.
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== method);
      }
      return [...prev, method];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !companyName.trim() || !description.trim()) {
      onShowToast('Please fill in title, company name, and description.');
      return;
    }
    // No minimum required here — every listing can already be messaged in-app by default,
    // so enabling an external channel below is optional, not a prerequisite to publish.
    if (contactMethods.includes('whatsapp') && !profile?.whatsapp) {
      onShowToast('Add a WhatsApp number to your business profile first, or unselect WhatsApp.');
      return;
    }
    if (contactMethods.includes('email') && !profile?.email) {
      onShowToast('Add an email to your business profile first, or unselect Email.');
      return;
    }
    if (contactMethods.includes('dm') && !profile?.whatsapp) {
      onShowToast('Add a phone number to your business profile first, or unselect Direct Message.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitListing({
        category,
        title: title.trim(),
        companyName: companyName.trim(),
        companySector: companySector.trim(),
        description: description.trim(),
        requirements: requirements.trim(),
        town: town.trim(),
        country: country.trim(),
        compensation: compensation.trim(),
        type: type.trim(),
        externalLink: externalLink.trim(),
        images: images.length > 0 ? images : [
          'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80'
        ],
        posterName: profile?.name || companyName.trim(),
        posterEmail: profile?.email || '',
        posterWhatsapp: profile?.whatsapp || '',
        posterBusinessDetails: profile?.businessDetails || '',
        posterProfilePic: profile?.businessLogoUrl || profile?.profilePicUrl || '',
        posterBackgroundUrl: profile?.businessBackgroundUrl || '',
        posterVerificationDocs: profile?.verificationDocs || [],
        posterVerified: true,
        contactMethods,
      });

      onClose();
    } catch (err) {
      // onSubmitListing (App.tsx) already shows a specific error toast with the
      // real server/network failure reason and rolls back the optimistic post —
      // avoid clobbering that message with a generic one here.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity">
      <div 
        className="w-full max-w-xl max-h-[92vh] bg-neutral-900 border border-neutral-800 rounded-t-xl sm:rounded-xl overflow-hidden flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-black/60 shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-amber-400" />
            New Corporate Listing
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form id="listingForm" onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
          {/* Category Selector Grid */}
          <div>
            <label className="block font-semibold text-neutral-300 mb-2">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORY_OPTIONS.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                    category === cat.id
                      ? 'bg-amber-400/20 border-amber-400 text-amber-400 font-bold'
                      : 'bg-black border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                  }`}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block font-semibold text-neutral-300 mb-1">Listing Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Industrial Solar Mini-Grid Tender, Commercial Freight Fleet"
              className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none transition-colors placeholder:text-neutral-600"
            />
          </div>

          {/* Company & Sector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-300 mb-1">Company / Organisation *</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your company name"
                className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none transition-colors placeholder:text-neutral-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-300 mb-1">Business Sector</label>
              <input
                type="text"
                value={companySector}
                onChange={(e) => setCompanySector(e.target.value)}
                placeholder="e.g. Energy, Agriculture, Finance"
                className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none transition-colors placeholder:text-neutral-600"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-neutral-300 mb-1">Full Description *</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the opportunity, scope of supply, or strategic partnership terms..."
              className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none resize-y transition-colors placeholder:text-neutral-600"
            />
          </div>

          {/* Requirements */}
          <div>
            <label className="block font-semibold text-neutral-300 mb-1">Requirements / Eligibility (Optional)</label>
            <textarea
              rows={2}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Minimum qualifications, tax compliance certificates, or fleet capacity required..."
              className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none resize-y transition-colors placeholder:text-neutral-600"
            />
          </div>

          {/* Location & Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-300 mb-1">Town / City</label>
              <input
                type="text"
                value={town}
                onChange={(e) => setTown(e.target.value)}
                placeholder="e.g. Lusaka, Ndola"
                className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none transition-colors placeholder:text-neutral-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-300 mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Zambia"
                className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none transition-colors placeholder:text-neutral-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-300 mb-1">Compensation / Value</label>
              <input
                type="text"
                value={compensation}
                onChange={(e) => setCompensation(e.target.value)}
                placeholder="e.g. K500,000 Contract Value"
                className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none transition-colors placeholder:text-neutral-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-300 mb-1">Deal Type</label>
              <input
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="e.g. Open Tender, Direct Sale, JV"
                className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none transition-colors placeholder:text-neutral-600"
              />
            </div>
          </div>

          {/* External Link */}
          <div>
            <label className="block font-semibold text-neutral-300 mb-1">External Link (Optional)</label>
            <input
              type="url"
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              placeholder="https://company.example.com/tender-docs"
              className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none transition-colors placeholder:text-neutral-600"
            />
          </div>

          {/* Contact Methods — secondary to in-app Messages, which is always on for every listing */}
          <div>
            <label className="block font-semibold text-neutral-300 mb-1">Other ways for buyers to reach you</label>
            <p className="text-[10px] text-neutral-500 mb-2">
              Every listing can already be messaged in-app — that's the default. Optionally enable extra channels
              below so buyers can also reach you on WhatsApp, email, or SMS.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CONTACT_METHOD_OPTIONS.map((opt) => {
                const isSelected = contactMethods.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleToggleContactMethod(opt.id)}
                    className={`flex items-start gap-2 py-2.5 px-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-amber-400/10 border-amber-400/60 text-amber-400'
                        : 'bg-black border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 ${isSelected ? 'text-amber-400' : 'text-neutral-500'}`}>
                      {opt.icon}
                    </span>
                    <span>
                      <span className="block text-xs font-bold">{opt.label}</span>
                      <span className="block text-[10px] text-neutral-500 leading-snug">{opt.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo Uploads */}
          <div>
            <label className="block font-semibold text-neutral-300 mb-1">Photos / Product Showcase</label>
            <p className="text-[10px] text-neutral-500 mb-2">Tap Add to select one or more photos from your gallery at once.</p>
            <div className="flex flex-wrap gap-2 items-center">
              {images.map((imgUrl, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-neutral-700 group">
                  <img src={imgUrl} alt={`Upload ${i}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 text-white flex items-center justify-center opacity-80 hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}

              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-neutral-800 hover:border-amber-400 flex flex-col items-center justify-center text-neutral-400 cursor-pointer transition-colors bg-black relative">
                {isUploadingImage ? (
                  <div className="flex flex-col items-center">
                    <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[8px] mt-1 font-semibold text-neutral-400">Uploading</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span className="text-[9px] mt-1 font-semibold text-neutral-400">Add</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={isUploadingImage}
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </form>

        {/* Submit Footer */}
        <div className="p-4 border-t border-neutral-800 bg-black/60 shrink-0">
          <button
            type="submit"
            form="listingForm"
            disabled={isSubmitting}
            className="w-full py-3 rounded-lg bg-amber-400 text-black font-bold text-xs uppercase tracking-wider hover:bg-amber-300 disabled:opacity-50 transition-all shadow-sm"
          >
            {isSubmitting ? 'Publishing Listing...' : 'Publish Corporate Listing'}
          </button>
        </div>
      </div>
    </div>
  );
};
