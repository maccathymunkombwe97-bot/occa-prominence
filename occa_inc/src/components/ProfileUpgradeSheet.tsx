import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  Upload, 
  FileText, 
  Trash2, 
  Building2, 
  Mail, 
  Phone, 
  CheckCircle2,
  Briefcase,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { UserProfile, VerificationDoc, BUSINESS_TYPES } from '../types';
import { uploadImageToImgBB } from '../services/imgbbService';
import { validatePhone } from '../utils/phone';

interface ProfileUpgradeSheetProps {
  isOpen: boolean;
  existingProfile: UserProfile | null;
  onClose: () => void;
  onSaveProfile: (profile: UserProfile) => void;
  onShowToast: (msg: string) => void;
}

export const ProfileUpgradeSheet: React.FC<ProfileUpgradeSheetProps> = ({
  isOpen,
  existingProfile,
  onClose,
  onSaveProfile,
  onShowToast,
}) => {
  const [companyName, setCompanyName] = useState(existingProfile?.companyName || '');
  const [businessType, setBusinessType] = useState(existingProfile?.businessType || '');
  const [email, setEmail] = useState(existingProfile?.email || '');
  const [whatsapp, setWhatsapp] = useState(existingProfile?.whatsapp || '');
  const [businessDetails, setBusinessDetails] = useState(existingProfile?.businessDetails || '');
  const [businessLogoUrl, setBusinessLogoUrl] = useState(existingProfile?.businessLogoUrl || '');
  const [businessBackgroundUrl, setBusinessBackgroundUrl] = useState(existingProfile?.businessBackgroundUrl || '');
  const [verificationDocs, setVerificationDocs] = useState<VerificationDoc[]>(existingProfile?.verificationDocs || []);
  const [isUploadingPic, setIsUploadingPic] = useState(false);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);

  if (!isOpen) return null;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPic(true);
    try {
      const url = await uploadImageToImgBB(file);
      setBusinessLogoUrl(url);
    } catch (err: any) {
      onShowToast(`ImgBB Upload Error: ${err.message || 'Failed'}`);
    } finally {
      setIsUploadingPic(false);
      e.target.value = '';
    }
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBackground(true);
    try {
      const url = await uploadImageToImgBB(file);
      setBusinessBackgroundUrl(url);
    } catch (err: any) {
      onShowToast(`ImgBB Upload Error: ${err.message || 'Failed'}`);
    } finally {
      setIsUploadingBackground(false);
      e.target.value = '';
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingDocs(true);

    try {
      const fileList: File[] = Array.from(files);
      for (const file of fileList) {
        const url = await uploadImageToImgBB(file);
        setVerificationDocs((prev) => [
          ...prev,
          { name: file.name, url },
        ]);
      }
    } catch (err: any) {
      onShowToast(`ImgBB Document Upload Error: ${err.message || 'Failed'}`);
    } finally {
      setIsUploadingDocs(false);
      e.target.value = '';
    }
  };

  const handleRemoveDoc = (index: number) => {
    setVerificationDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessLogoUrl) {
      onShowToast('Please upload a business logo.');
      return;
    }
    if (!companyName.trim() || !businessType || !email.trim() || !whatsapp.trim() || !businessDetails.trim()) {
      onShowToast('Please fill in all required business fields.');
      return;
    }

    const phoneCheck = validatePhone(whatsapp);
    if (!phoneCheck.valid) {
      onShowToast(phoneCheck.error || 'Please enter a valid WhatsApp number.');
      return;
    }

    const updatedProfile: UserProfile = {
      ...(existingProfile || { name: '' }),
      companyName: companyName.trim(),
      businessType,
      email: email.trim(),
      whatsapp: phoneCheck.display,
      businessDetails: businessDetails.trim(),
      businessLogoUrl,
      businessBackgroundUrl,
      verificationDocs,
      isBusinessAccount: true,
      updatedAt: new Date().toISOString(),
    };

    onSaveProfile(updatedProfile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity">
      <div 
        className="w-full max-w-lg max-h-[92vh] bg-neutral-900 border border-neutral-800 rounded-t-xl sm:rounded-xl overflow-hidden flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-black/60 shrink-0">
          <div className="flex items-center gap-2 font-bold text-white text-base">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span>Upgrade to a Business Account</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form id="profileForm" onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
          <p className="text-neutral-400 text-xs leading-relaxed">
            Posting opportunities on Occa Prominence requires a verified business account. Add your business details once to unlock posting.
          </p>

          {/* Business Logo */}
          <div>
            <label className="block font-semibold text-neutral-300 mb-1.5">Business / Company Logo *</label>
            <div className="flex items-center gap-3">
              {businessLogoUrl ? (
                <div className="relative w-16 h-16 rounded-full overflow-hidden border border-neutral-700 shrink-0">
                  <img src={businessLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setBusinessLogoUrl('')}
                    className="absolute inset-0 bg-black/70 opacity-0 hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <label className="w-16 h-16 rounded-full border-2 border-dashed border-neutral-800 hover:border-amber-400 bg-black flex flex-col items-center justify-center text-neutral-400 cursor-pointer shrink-0 transition-colors">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  <span className="text-[9px] mt-0.5 text-neutral-400 font-medium">Upload</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
              )}
              <div className="text-[11px] text-neutral-400">
                Square format recommended (e.g. 200x200px). Shown on all your listings.
              </div>
            </div>
          </div>

          {/* Business Cover / Background Photo */}
          <div>
            <label className="block font-semibold text-neutral-300 mb-1.5">
              Profile Cover Photo <span className="text-neutral-500 font-normal">(Optional)</span>
            </label>
            {businessBackgroundUrl ? (
              <div className="relative w-full h-28 rounded-lg overflow-hidden border border-neutral-700">
                <img src={businessBackgroundUrl} alt="Cover" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setBusinessBackgroundUrl('')}
                  className="absolute inset-0 bg-black/70 opacity-0 hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity"
                >
                  Change
                </button>
              </div>
            ) : (
              <label className="w-full h-28 rounded-lg border-2 border-dashed border-neutral-800 hover:border-amber-400 bg-black flex flex-col items-center justify-center text-neutral-400 cursor-pointer transition-colors">
                {isUploadingBackground ? (
                  <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5 text-amber-400" />
                    <span className="text-[10px] mt-1 text-neutral-400 font-medium">Upload cover photo</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleBackgroundUpload} className="hidden" disabled={isUploadingBackground} />
              </label>
            )}
            <div className="text-[11px] text-neutral-400 mt-1.5">
              Wide format recommended (e.g. 1200x400px). Shown across the top of your public profile.
            </div>
          </div>

          {/* Business Type & Company */}
          <div>
            <label className="block font-semibold text-neutral-300 mb-1">Business Type *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400">
                <Briefcase className="w-4 h-4" />
              </span>
              <select
                required
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg pl-10 pr-3.5 py-2.5 text-white text-xs outline-none transition-colors cursor-pointer"
              >
                <option value="" disabled className="bg-neutral-900 text-neutral-500">Select business type...</option>
                {BUSINESS_TYPES.map((type) => (
                  <option key={type} value={type} className="bg-neutral-900 text-white">
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-neutral-300 mb-1">Company / Organisation Name *</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Apex Capital Holdings"
              className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none transition-colors placeholder:text-neutral-600"
            />
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-300 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none transition-colors placeholder:text-neutral-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-300 mb-1">WhatsApp Number *</label>
              <input
                type="tel"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+260 97 712 3456"
                className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none transition-colors placeholder:text-neutral-600"
              />
            </div>
          </div>

          {/* Business Details */}
          <div>
            <label className="block font-semibold text-neutral-300 mb-1">Business Overview *</label>
            <textarea
              required
              rows={3}
              value={businessDetails}
              onChange={(e) => setBusinessDetails(e.target.value)}
              placeholder="Briefly describe what your business specializes in..."
              className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none resize-y transition-colors placeholder:text-neutral-600"
            />
          </div>

          {/* Verification Documents */}
          <div>
            <label className="block font-semibold text-neutral-300 mb-1">
              Verification Documents <span className="text-neutral-500 font-normal">(Optional)</span>
            </label>
            <div className="space-y-2">
              {verificationDocs.map((doc, i) => (
                <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black border border-neutral-800">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs text-neutral-200 truncate">{doc.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveDoc(i)}
                    className="p-1 text-neutral-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-black border border-dashed border-neutral-800 hover:border-amber-400 text-neutral-300 font-semibold cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>Upload Certificate or PACRA Registration</span>
                <input type="file" accept="image/*,.pdf" multiple onChange={handleDocUpload} className="hidden" />
              </label>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-800 bg-black/60 flex flex-col gap-2 shrink-0">
          <button
            type="submit"
            form="profileForm"
            className="w-full py-3 rounded-lg bg-amber-400 text-black font-bold text-xs uppercase tracking-wider hover:bg-amber-300 transition-all shadow-sm"
          >
            Save & Unlock Posting
          </button>
        </div>
      </div>
    </div>
  );
};
