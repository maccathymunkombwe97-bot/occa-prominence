import React, { useState } from 'react';
import { X, User, RefreshCw } from 'lucide-react';
import { UserProfile } from '../types';
import { uploadImageToImgBB } from '../services/imgbbService';

interface ProfileEditSheetProps {
  isOpen: boolean;
  existingProfile: UserProfile | null;
  onClose: () => void;
  onSaveProfile: (profile: UserProfile) => void;
  onShowToast: (msg: string) => void;
}

export const ProfileEditSheet: React.FC<ProfileEditSheetProps> = ({
  isOpen,
  existingProfile,
  onClose,
  onSaveProfile,
  onShowToast,
}) => {
  const [name, setName] = useState(existingProfile?.name || '');
  const [bio, setBio] = useState(existingProfile?.bio || '');
  const [profilePicUrl, setProfilePicUrl] = useState(existingProfile?.profilePicUrl || '');
  const [isUploadingPic, setIsUploadingPic] = useState(false);

  if (!isOpen) return null;

  const handlePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPic(true);
    try {
      const url = await uploadImageToImgBB(file);
      setProfilePicUrl(url);
    } catch (err: any) {
      onShowToast(`ImgBB Upload Error: ${err.message || 'Failed'}`);
    } finally {
      setIsUploadingPic(false);
      e.target.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profilePicUrl) {
      onShowToast('Please upload a profile picture.');
      return;
    }
    if (!name.trim()) {
      onShowToast('Please enter your name.');
      return;
    }

    const updatedProfile: UserProfile = {
      ...(existingProfile || {}),
      name: name.trim(),
      bio: bio.trim(),
      profilePicUrl,
      updatedAt: new Date().toISOString(),
    };

    onSaveProfile(updatedProfile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity">
      <div
        className="w-full max-w-md max-h-[92vh] bg-neutral-900 border border-neutral-800 rounded-t-xl sm:rounded-xl overflow-hidden flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-black/60 shrink-0">
          <div className="flex items-center gap-2 font-bold text-white text-base">
            <User className="w-5 h-5 text-amber-400" />
            <span>Edit Profile</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form id="editProfileForm" onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
          {/* Profile Picture */}
          <div>
            <label className="block font-semibold text-neutral-300 mb-1.5">Profile Picture *</label>
            <div className="flex items-center gap-3">
              {profilePicUrl ? (
                <div className="relative w-16 h-16 rounded-full overflow-hidden border border-neutral-700 shrink-0">
                  <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setProfilePicUrl('')}
                    className="absolute inset-0 bg-black/70 opacity-0 hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <label className="w-16 h-16 rounded-full border-2 border-dashed border-neutral-800 hover:border-amber-400 bg-black flex flex-col items-center justify-center text-neutral-400 cursor-pointer shrink-0 transition-colors">
                  {isUploadingPic ? (
                    <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                  ) : (
                    <>
                      <User className="w-5 h-5 text-amber-400" />
                      <span className="text-[9px] mt-0.5 text-neutral-400 font-medium">Upload</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handlePicUpload} className="hidden" disabled={isUploadingPic} />
                </label>
              )}
              <div className="text-[11px] text-neutral-400">
                Square format recommended (e.g. 200x200px)
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block font-semibold text-neutral-300 mb-1">Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chilufya Mwenya"
              className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none transition-colors placeholder:text-neutral-600"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block font-semibold text-neutral-300 mb-1">
              Bio <span className="text-neutral-500 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short line about yourself..."
              className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-white text-xs outline-none resize-y transition-colors placeholder:text-neutral-600"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-800 bg-black/60 flex flex-col gap-2 shrink-0">
          <button
            type="submit"
            form="editProfileForm"
            className="w-full py-3 rounded-lg bg-amber-400 text-black font-bold text-xs uppercase tracking-wider hover:bg-amber-300 transition-all shadow-sm"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
