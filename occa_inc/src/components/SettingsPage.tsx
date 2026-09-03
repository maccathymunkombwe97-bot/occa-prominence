import React, { useState, useEffect } from 'react';
import { 
  User, 
  ShieldCheck, 
  Sliders, 
  Bell, 
  Moon, 
  Trash2, 
  Info, 
  HelpCircle, 
  LogOut, 
  ChevronRight, 
  Check, 
  LayoutGrid, 
  Table as TableIcon,
  Sparkles,
  Smartphone,
  MapPin,
  Compass,
  RotateCcw,
  Fingerprint,
  Cpu,
  RefreshCw,
  Rocket,
  Crown
} from 'lucide-react';
import { AppSettings, UserProfile } from '../types';
import { clearSearchHistory } from '../utils/feedScoring';
import { TermsPage } from './TermsPage';
import { InstallAppButton } from './InstallAppButton';
import { CORPORATE_PLANS_ENABLED } from '../config/featureFlags';

interface SettingsPageProps {
  profile: UserProfile | null;
  isVerified: boolean;
  settings: AppSettings;
  savedCount: number;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenEditProfile: () => void;
  onOpenUpgradeProfile: () => void;
  onOpenCorporateConsole: () => void;
  onClearSavedPosts: () => void;
  onShowToast: (msg: string) => void;
  onExitApp: () => void;
  onNavigateMyPosts?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  profile,
  isVerified,
  settings,
  savedCount,
  onUpdateSettings,
  onOpenEditProfile,
  onOpenUpgradeProfile,
  onOpenCorporateConsole,
  onClearSavedPosts,
  onShowToast,
  onExitApp,
  onNavigateMyPosts,
}) => {
  // Biometrics and WebAuthn references removed per simplification directive
  const [showTerms, setShowTerms] = useState(false);

  if (showTerms) {
    return <TermsPage onClose={() => setShowTerms(false)} />;
  }

  return (
    <div className="pb-28 pt-4 px-4 sm:px-8 max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <Sliders className="w-6 h-6 text-amber-400" />
          Settings & Options
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Manage your account profile, layout options, alerts, and stored phone data.
        </p>
      </div>

      {/* Get the App */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-black/60 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Get the App</h2>
              <p className="text-[11px] text-neutral-400">Install OCCA for one-tap access from your home screen</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <InstallAppButton />
        </div>
      </div>

      {/* Option 1: Basic Profile Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-black/60 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Your Profile</h2>
              <p className="text-[11px] text-neutral-400">Your picture, name, and bio shown across the app</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          {profile ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                {profile.profilePicUrl ? (
                  <img src={profile.profilePicUrl} alt={profile.name} className="w-12 h-12 rounded-full object-cover border border-neutral-700 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-black border border-neutral-700 flex items-center justify-center font-bold text-amber-400 text-sm shrink-0">
                    {profile.name?.[0] || '?'}
                  </div>
                )}
                <div>
                  <div className="font-bold text-white text-sm">{profile.name}</div>
                  {profile.bio ? (
                    <div className="text-neutral-400 text-[11px] mt-0.5 max-w-xs">{profile.bio}</div>
                  ) : (
                    <div className="text-neutral-500 text-[11px] mt-0.5 italic">No bio added yet</div>
                  )}
                </div>
              </div>
              <button
                onClick={onOpenEditProfile}
                className="px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-bold text-xs border border-neutral-700 transition-all shadow-xs shrink-0"
              >
                Edit Profile
              </button>
            </div>
          ) : (
            <div className="text-neutral-400 text-xs">Loading your profile...</div>
          )}
        </div>
      </div>

      {/* Option 2.5: OCCA — Account Boost & Membership (temporarily hidden) */}
      {false && (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-black/60 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">OCCA</h2>
              <p className="text-[11px] text-neutral-400">Account Boost & Occa Membership plans</p>
            </div>
          </div>
          {(profile?.accountBoostTier || profile?.membershipTier) && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30">
              <Rocket className="w-3 h-3" />
              Active Plan
            </span>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="text-neutral-300">
              {profile?.membershipTier ? (
                <span>
                  <span className="font-bold text-white capitalize">{profile.membershipTier}</span> Membership active
                  {profile?.accountBoostTier && (
                    <span> — <span className="font-bold text-white capitalize">{profile.accountBoostTier}</span> Account Boost included</span>
                  )}
                </span>
              ) : profile?.accountBoostTier ? (
                <span>
                  <span className="font-bold text-white capitalize">{profile.accountBoostTier}</span> Account Boost active on all listings
                </span>
              ) : (
                <span>Boost every listing at once, or bundle in verification with Occa Membership.</span>
              )}
            </div>
            <button
              onClick={onOpenCorporateConsole}
              className="px-3.5 py-2 rounded-lg bg-amber-400 text-black font-bold text-xs hover:bg-amber-300 transition-all shrink-0 shadow-sm"
            >
              {(profile?.accountBoostTier || profile?.membershipTier) ? 'Manage Plans' : 'View Plans'}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Device Biometrics & Passkeys Enclave Card Removed */}

      {/* Device Region & Feed Personalization Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-black/60 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Location & Device Feed Personalization</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/30">
                  App Local Memory
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                Prioritizes posts from your town, country, saved posts & recent searches
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4 text-xs">
          {/* Location Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-neutral-300 uppercase mb-1">
                Your Town / City
              </label>
              <input
                type="text"
                value={settings.userTown || ''}
                onChange={(e) => onUpdateSettings({ userTown: e.target.value })}
                placeholder="e.g. Lusaka, Kitwe, Ndola, Livingstone, Harare"
                className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400 font-medium"
              />
              <span className="text-[10px] text-neutral-500 mt-1 block">
                Posts matching this city appear first on your home feed
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-300 uppercase mb-1">
                Your Country
              </label>
              <input
                type="text"
                value={settings.userCountry || ''}
                onChange={(e) => onUpdateSettings({ userCountry: e.target.value })}
                placeholder="e.g. Zambia, Zimbabwe, South Africa, Kenya"
                className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400 font-medium"
              />
              <span className="text-[10px] text-neutral-500 mt-1 block">
                National products and services rank above international posts
              </span>
            </div>
          </div>

          {/* Personalization Toggles */}
          <div className="pt-2 border-t border-neutral-800/80 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Personalized Topics Feed</span>
                </div>
                <div className="text-neutral-400 text-[11px]">
                  Show more products and services similar to posts you save and terms you search
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={settings.enablePersonalizedFeed !== false}
                  onChange={(e) => onUpdateSettings({ enablePersonalizedFeed: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-neutral-400 text-[11px]">
                Reset locally stored search history & topic preferences on this phone
              </span>
              <button
                onClick={() => {
                  clearSearchHistory();
                }}
                className="px-3 py-1.5 rounded-lg bg-black border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white font-bold text-xs transition-all flex items-center gap-1.5 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Reset Feed Memory</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Option 2: Display & Layout Options */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-black/60 border-b border-neutral-800">
          <h2 className="text-sm font-bold text-white">Display & Feed Options</h2>
          <p className="text-[11px] text-neutral-400">Configure how products and services are displayed</p>
        </div>

        <div className="divide-y divide-neutral-800 text-xs">
          {/* Default View Mode */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-white flex items-center gap-1.5">
                <span>Default View Mode</span>
              </div>
              <div className="text-neutral-400 text-[11px]">
                Choose default view style when opening the home feed
              </div>
            </div>

            <div className="flex items-center gap-1 bg-black p-1 rounded-lg border border-neutral-800">
              <button
                onClick={() => onUpdateSettings({ defaultViewMode: 'cards' })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs transition-all ${
                  settings.defaultViewMode === 'cards'
                    ? 'bg-amber-400 text-black shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                onClick={() => onUpdateSettings({ defaultViewMode: 'table' })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs transition-all ${
                  settings.defaultViewMode === 'table'
                    ? 'bg-amber-400 text-black shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>
          </div>

          {/* Auto rotate carousel */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-white">Auto-rotate Multi-Photo Carousels</div>
              <div className="text-neutral-400 text-[11px]">
                Automatically switch listing photos every 7 seconds
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoRotateCarousel}
                onChange={(e) => onUpdateSettings({ autoRotateCarousel: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Option 3: Notifications & Deal Alerts Options */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-black/60 border-b border-neutral-800">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            Notification & Tender Preferences
          </h2>
        </div>

        <div className="divide-y divide-neutral-800 text-xs">
          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-white">New Tender & Deal Notifications</div>
              <div className="text-neutral-400 text-[11px]">
                Receive alerts when new tenders or acquisitions match your criteria
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) => onUpdateSettings({ notificationsEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
            </label>
          </div>

          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-white">WhatsApp Inquiry Alerts</div>
              <div className="text-neutral-400 text-[11px]">
                Allow potential clients to send direct message inquiries via WhatsApp
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.dealAlertsEnabled}
                onChange={(e) => onUpdateSettings({ dealAlertsEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Option 4: Data & Phone Storage Options */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-black/60 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-400" />
              Phone Storage & Saved Data
            </h2>
            <p className="text-[11px] text-neutral-400">Manage data stored locally on your device</p>
          </div>
          <span className="text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
            {savedCount} Saved Item{savedCount === 1 ? '' : 's'}
          </span>
        </div>

        <div className="p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <button
              onClick={onClearSavedPosts}
              disabled={savedCount === 0}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-black border border-red-900/50 text-red-400 font-semibold hover:bg-red-950/40 disabled:opacity-50 transition-all shadow-xs"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Saved Posts</span>
            </button>
          </div>
        </div>
      </div>

      {/* Option 5: App Info, Support & Exit Options */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-black/60 border-b border-neutral-800">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400" />
            App Info & System Support
          </h2>
        </div>

        <div className="divide-y divide-neutral-800 text-xs">
          <div className="p-4 flex items-center justify-between">
            <span className="text-neutral-400">Application Version</span>
            <span className="font-mono font-bold text-amber-400">v2.4.0 (Build 2026.07)</span>
          </div>

          <button
            onClick={() => setShowTerms(true)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-800/60 transition-colors"
          >
            <div className="flex items-center gap-2 text-neutral-300 font-medium">
              <HelpCircle className="w-4 h-4 text-neutral-500" />
              <span>Help & Terms of Service</span>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          </button>

          <button
            onClick={onExitApp}
            className="w-full p-4 flex items-center justify-between text-left text-red-400 hover:bg-red-950/20 transition-colors"
          >
            <div className="flex items-center gap-2 font-bold">
              <LogOut className="w-4 h-4" />
              <span>Exit OCCA</span>
            </div>
            <ChevronRight className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>

      {/* Fingerprint Scanner Simulator Modal Removed */}
    </div>
  );
};
