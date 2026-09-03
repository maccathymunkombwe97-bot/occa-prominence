import React, { useEffect, useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X } from 'lucide-react';

// Chrome/Edge/Android fire this event when the site qualifies as an installable
// PWA (valid manifest + registered service worker + served over HTTPS). Capturing
// it lets us trigger the native "Install" prompt from our own button instead of
// waiting for the browser's address-bar icon.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const APK_URL = '/downloads/occa-prominence.apk';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's own flag for "launched from home screen"
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

interface InstallAppButtonProps {
  className?: string;
  /** 'full' shows Install + Download APK side by side (Settings page).
   *  'compact' shows a single icon pill that adapts its action (header nav). */
  variant?: 'full' | 'compact';
}

export const InstallAppButton: React.FC<InstallAppButtonProps> = ({ className = '', variant = 'full' }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const handleInstallClick = async () => {
    // Real one-tap install: Chrome/Edge on Android & desktop support this.
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
      return;
    }
    // iOS Safari has no install prompt API — show the manual steps instead.
    if (isIOS()) {
      setShowIosHint(true);
      return;
    }
    // No install prompt available (e.g. desktop Firefox, or Android browser
    // that doesn't support PWA install) — fall back to the native APK.
    window.location.href = APK_URL;
  };

  if (variant === 'compact') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={handleInstallClick}
          className="relative p-2 sm:px-3.5 sm:py-2 rounded-full transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-black hover:bg-amber-400"
          title="Install App"
        >
          <Smartphone className="w-4 h-4" />
          <span className="hidden md:inline">Install</span>
        </button>

        {showIosHint && (
          <div className="absolute right-0 top-full mt-2 z-40 w-72 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-xs text-neutral-300 shadow-xl">
            <button
              onClick={() => setShowIosHint(false)}
              className="absolute top-2 right-2 text-neutral-500 hover:text-white"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="font-bold text-white mb-2">Add OCCA to your Home Screen</p>
            <ol className="space-y-1.5">
              <li className="flex items-center gap-2">
                <Share className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                Tap the Share icon in Safari's toolbar
              </li>
              <li className="flex items-center gap-2">
                <PlusSquare className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                Scroll down and tap "Add to Home Screen"
              </li>
            </ol>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-start gap-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400 text-black text-xs font-bold uppercase tracking-wider hover:bg-yellow-300 transition-colors shadow-sm"
        >
          <Smartphone className="w-4 h-4" />
          Install App
        </button>

        <a
          href={APK_URL}
          download
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-700 text-neutral-300 text-xs font-bold uppercase tracking-wider hover:text-white hover:border-neutral-500 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download APK
        </a>
      </div>

      {showIosHint && (
        <div className="relative mt-1 w-72 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-xs text-neutral-300 shadow-xl">
          <button
            onClick={() => setShowIosHint(false)}
            className="absolute top-2 right-2 text-neutral-500 hover:text-white"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <p className="font-bold text-white mb-2">Add OCCA to your Home Screen</p>
          <ol className="space-y-1.5">
            <li className="flex items-center gap-2">
              <Share className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              Tap the Share icon in Safari's toolbar
            </li>
            <li className="flex items-center gap-2">
              <PlusSquare className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              Scroll down and tap "Add to Home Screen"
            </li>
          </ol>
        </div>
      )}
    </div>
  );
};
