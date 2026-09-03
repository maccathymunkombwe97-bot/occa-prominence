import React, { useState, useEffect } from 'react';
import { PageTab, Listing, ListingCategory, UserProfile, AppSettings, ContactMethod, Conversation } from './types';
import { getAvailableExternalContactMethods } from './utils/contactAvailability';
import { INITIAL_LISTINGS } from './data/mockListings';
import { HeaderNav } from './components/HeaderNav';
import { HomePage } from './components/HomePage';
import { SearchPage } from './components/SearchPage';
import { MyPostsPage } from './components/MyPostsPage';
import { SettingsPage } from './components/SettingsPage';
import { MessagesPage } from './components/MessagesPage';
import { ConversationPage } from './components/ConversationPage';
import { DetailSheet } from './components/DetailSheet';
import { PostFormSheet } from './components/PostFormSheet';
import { ProfileUpgradeSheet } from './components/ProfileUpgradeSheet';
import { CorporateConsoleSheet } from './components/CorporateConsoleSheet';
import { ProfileEditSheet } from './components/ProfileEditSheet';
import { CompanyProfilePage } from './components/CompanyProfilePage';
import { CompanyPostsPage } from './components/CompanyPostsPage';
import { CompanyReviewsPage } from './components/CompanyReviewsPage';
import { ContactOptionsSheet } from './components/ContactOptionsSheet';
import { AuthGate } from './components/AuthGate';
import { SplashScreen } from './components/SplashScreen';
import { syncLikesToServer } from './services/likesSyncService';

const DEFAULT_SETTINGS: AppSettings = {
  defaultViewMode: 'cards',
  notificationsEnabled: true,
  dealAlertsEnabled: true,
  autoRotateCarousel: true,
  darkTheme: true,
  userTown: 'Lusaka',
  userCountry: 'Zambia',
  regionFilter: 'all',
  enablePersonalizedFeed: true,
};

export default function App() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<PageTab>('home');
  const [activeCategory, setActiveCategory] = useState<ListingCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  // Storage state
  const [listings, setListings] = useState<Listing[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  // Derived from listings[].isOwnPost (set server-side per authenticated viewer) rather
  // than tracked as its own local/localStorage list — that older approach never got
  // cleared on logout, so switching accounts on the same device could keep showing a
  // previous account's posts as "my posts". Since ownership now travels with the
  // listing itself from the server, this is always correct for whichever account is
  // currently signed in, with no separate state to go stale.
  const myPostIds = React.useMemo(() => listings.filter((l) => l.isOwnPost).map((l) => l.id), [listings]);
  const [clients, setClients] = useState<string[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // This device's session token. Every account-specific request (profile,
  // settings, saved posts) must send this — it's what keeps one device's
  // login from ever being shown to a different device/browser.
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('occa_auth_token');
    } catch {
      return null;
    }
  });

  // Wrapper around fetch that attaches this device's Authorization header.
  const authFetch = (url: string, options: RequestInit = {}) => {
    const headers = {
      ...(options.headers || {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    };
    return fetch(url, { ...options, headers });
  };

  // Sync dark theme to root element
  useEffect(() => {
    if (settings.darkTheme) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkTheme]);
  const [selectedDetailListing, setSelectedDetailListing] = useState<Listing | null>(null);
  // When set, the main content area shows a full company profile page (recent posts,
  // stats, and public reviews) instead of whichever tab is active, similar to how
  // MyPostsPage/SettingsPage take over <main> — this is a real page, not a modal.
  const [viewingCompanyListing, setViewingCompanyListing] = useState<Listing | null>(null);
  const [companySubPage, setCompanySubPage] = useState<'posts' | 'reviews' | null>(null);

  // Navigate to a company's profile, always starting on the main profile view
  // (not a stale sub-page left over from a previously viewed company).
  const openCompanyProfile = (listing: Listing) => {
    setCompanySubPage(null);
    setViewingCompanyListing(listing);
  };
  const [contactOptionsListing, setContactOptionsListing] = useState<Listing | null>(null);
  const [contactOptionsMethods, setContactOptionsMethods] = useState<ContactMethod[]>([]);
  // In-app messaging — the platform's primary means of communication. `conversations` is
  // this account's full chat list (kept in sync via fetchConversations/polling below);
  // `openConversation` is whichever thread is currently open in the Messages tab.
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(false);
  const [openConversation, setOpenConversation] = useState<Conversation | null>(null);
  const totalUnreadMessages = React.useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations]
  );
  const [isPostFormOpen, setIsPostFormOpen] = useState<boolean>(false);
  const [isProfileUpgradeOpen, setIsProfileUpgradeOpen] = useState<boolean>(false);
  const [isCorporateConsoleOpen, setIsCorporateConsoleOpen] = useState<boolean>(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initial load from local storage & background Google Sheets sync
  useEffect(() => {
    // 1. Instant Static Load from LocalStorage or Hardcoded Initial Data
    let initialSet: Listing[] = INITIAL_LISTINGS;
    try {
      const storedListings = localStorage.getItem('occa_listings');
      if (storedListings) {
        const parsed = JSON.parse(storedListings);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialSet = parsed.filter((l: Listing) => (l.companyName || '').trim().toLowerCase() === 'occa');
        }
      }
    } catch (e) {
      console.warn('Error reading occa_listings from localStorage', e);
    }
    setListings(initialSet);

    // Load Local Profile & Settings
    try {
      const storedProfile = localStorage.getItem('occa_profile');
      const storedToken = localStorage.getItem('occa_auth_token');
      // Only trust a cached profile if this device still has the session token
      // that goes with it — otherwise this is a leftover/copied cache with no
      // way to authenticate it, and the user should land on sign-in instead.
      if (storedProfile && storedToken) {
        const parsedProf = JSON.parse(storedProfile);
        setProfile(parsedProf);
        setIsVerified(!!parsedProf.isBusinessAccount);
      } else if (storedProfile && !storedToken) {
        localStorage.removeItem('occa_profile');
        localStorage.removeItem('occa_company_name');
      }

      const storedSaved = localStorage.getItem('occa_saved_posts');
      if (storedSaved) {
        setSavedPostIds(JSON.parse(storedSaved));
      }

      const storedClients = localStorage.getItem('occa_clients');
      if (storedClients) {
        setClients(JSON.parse(storedClients));
      }

      const storedSettings = localStorage.getItem('occa_settings');
      if (storedSettings) {
        const parsedSet = JSON.parse(storedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsedSet });
        if (parsedSet.defaultViewMode) {
          setViewMode(parsedSet.defaultViewMode);
        }
      }
    } catch (e) {
      console.warn('Error reading static localStorage items', e);
    }

    // 2. Hydrate state from server APIs
    async function fetchServerState() {
      // This device's session token, read up front so the very first listings fetch
      // can already be authenticated — otherwise every listing's `isOwnPost` flag would
      // come back false on load and "My Posts" would flash empty until a later refetch.
      let storedToken: string | null = null;
      try {
        storedToken = localStorage.getItem('occa_auth_token');
      } catch {}
      const authedFetch = (url: string) =>
        fetch(url, storedToken ? { headers: { Authorization: `Bearer ${storedToken}` } } : undefined);

      // Listings are the shared, server-persisted source of truth (Turso-backed),
      // so this is what makes posts created by ANY user actually visible to everyone
      // else — not just the browser that created them. Fetched with this device's auth
      // (if any) so each listing's `isOwnPost` flag reflects the signed-in account.
      try {
        const listingsRes = await authedFetch('/api/listings');
        const listingsData = await listingsRes.json();
        if (listingsData.success && Array.isArray(listingsData.listings)) {
          const occaListings = listingsData.listings.filter((l: Listing) => (l.companyName || '').trim().toLowerCase() === 'occa');
          if (occaListings.length > 0) {
            setListings(occaListings);
            localStorage.setItem('occa_listings', JSON.stringify(occaListings));
          } else {
            setListings(INITIAL_LISTINGS);
            localStorage.setItem('occa_listings', JSON.stringify(INITIAL_LISTINGS));
          }
        }
      } catch (e) {
        console.warn('Failed to fetch listings from server on startup:', e);
      }

      // Everything below is this device's private account data. Only fetch it
      // if this device actually has a session token from a real login/register
      // on THIS device — otherwise we'd have no way to know whose data to ask
      // for, and previously this endpoint just returned whatever the server
      // process last remembered globally, which is what caused every device to
      // land in the same account.
      if (!storedToken) {
        return;
      }

      try {
        const profileRes = await authedFetch('/api/profile');
        const profileData = await profileRes.json();
        if (profileData.success && profileData.profile) {
          setProfile(profileData.profile);
          setIsVerified(!!profileData.profile?.isBusinessAccount);
          localStorage.setItem('occa_profile', JSON.stringify(profileData.profile));
        } else {
          // Token is invalid/expired — clear it so the user is sent back to sign-in
          // instead of getting stuck on a blank/errored state.
          localStorage.removeItem('occa_auth_token');
          setAuthToken(null);
        }
      } catch (e) {
        console.warn('Failed to fetch profile from server on startup:', e);
      }

      try {
        const savedRes = await authedFetch('/api/saved');
        const savedData = await savedRes.json();
        if (savedData.success && Array.isArray(savedData.savedPostIds)) {
          setSavedPostIds(savedData.savedPostIds);
          localStorage.setItem('occa_saved_posts', JSON.stringify(savedData.savedPostIds));
        }
      } catch (e) {
        console.warn('Failed to fetch saved posts from server on startup:', e);
      }

      try {
        // Scoped to this device's own account (see /api/clients on the server) — each
        // account has its own client-connections list now, not one shared globally.
        const clientsRes = await authedFetch('/api/clients');
        const clientsData = await clientsRes.json();
        if (clientsData.success && Array.isArray(clientsData.clients)) {
          setClients(clientsData.clients);
          localStorage.setItem('occa_clients', JSON.stringify(clientsData.clients));
        }
      } catch (e) {
        console.warn('Failed to fetch clients from server on startup:', e);
      }

      try {
        const settingsRes = await authedFetch('/api/settings');
        const settingsData = await settingsRes.json();
        if (settingsData.success && settingsData.settings) {
          setSettings((prev) => {
            const merged = { ...DEFAULT_SETTINGS, ...prev, ...settingsData.settings };
            localStorage.setItem('occa_settings', JSON.stringify(merged));
            return merged;
          });
          if (settingsData.settings.defaultViewMode) {
            setViewMode(settingsData.settings.defaultViewMode);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch settings from server on startup:', e);
      }
    }

    fetchServerState();
  }, []);

  // Permanently records every currently-shown post's like count (organic-growth engine's
  // live number + real manual likes) to the database — see src/services/likesSyncService.ts
  // and POST /api/listings/sync-likes. A ref (rather than `listings` itself) is what the
  // interval reads, so this doesn't need to tear down/reschedule every time listings change.
  const listingsForLikesSyncRef = React.useRef<Listing[]>(listings);
  useEffect(() => {
    listingsForLikesSyncRef.current = listings;
  }, [listings]);

  useEffect(() => {
    const LIKES_SYNC_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes while the app is open
    const runSync = () => {
      if (listingsForLikesSyncRef.current.length > 0) {
        syncLikesToServer(listingsForLikesSyncRef.current);
      }
    };
    // First sync shortly after launch (once the initial /api/listings fetch has had time to
    // land), then on a steady interval for as long as the app stays open.
    const initialTimer = setTimeout(runSync, 15000);
    const intervalId = setInterval(runSync, LIKES_SYNC_INTERVAL_MS);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalId);
    };
  }, []);

  // Keeps the Messages chat list (and its unread badge in HeaderNav) fresh. Refetched
  // right away whenever this device has a session token, then on a steady poll for as
  // long as the app stays open — the app has no websocket server, so polling is what
  // keeps a chat list feeling live across tabs.
  const fetchConversations = React.useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!authToken) return;
      if (!opts.silent) setIsLoadingConversations(true);
      try {
        const res = await authFetch('/api/conversations');
        const data = await res.json();
        if (data.success && Array.isArray(data.conversations)) {
          setConversations(data.conversations);
        }
      } catch (e) {
        console.warn('Failed to fetch conversations:', e);
      } finally {
        if (!opts.silent) setIsLoadingConversations(false);
      }
    },
    [authToken]
  );

  useEffect(() => {
    if (!authToken) {
      setConversations([]);
      return;
    }
    fetchConversations();

    // Paused while the app is backgrounded (mobile home button, switching tabs) so an
    // idle session doesn't keep polling in the background — resumes with an immediate
    // refresh the moment it's foregrounded again, same pattern as ConversationPage's
    // message polling.
    const CONVERSATIONS_POLL_INTERVAL_MS = 15000;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => fetchConversations({ silent: true }), CONVERSATIONS_POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchConversations({ silent: true });
        startPolling();
      }
    };

    if (!document.hidden) startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authToken, fetchConversations]);

  // Shows a transient toast notification. This is the ONLY way errors from
  // Turso / ImgBB / posting API calls reach the user, so it
  // must actually render — components already call onShowToast with real
  // error text (see PostFormSheet), this just needs to display it.
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    if (!msg) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 4000);
  };

  // Saved toggle
  const handleToggleSave = async (listingId: string) => {
    let updated: string[];
    if (savedPostIds.includes(listingId)) {
      updated = savedPostIds.filter((id) => id !== listingId);
    } else {
      updated = [...savedPostIds, listingId];
    }
    setSavedPostIds(updated);
    localStorage.setItem('occa_saved_posts', JSON.stringify(updated));

    try {
      const res = await authFetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.listings)) {
        const occaListings = data.listings.filter((l: Listing) => (l.companyName || '').trim().toLowerCase() === 'occa');
        if (occaListings.length > 0) {
          setListings(occaListings);
          localStorage.setItem('occa_listings', JSON.stringify(occaListings));
        }
      }
    } catch (e) {}
  };

  const handleClearAllSaved = async () => {
    if (window.confirm('Are you sure you want to clear all liked listings?')) {
      setSavedPostIds([]);
      localStorage.setItem('occa_saved_posts', JSON.stringify([]));

      try {
        await authFetch('/api/saved', { method: 'DELETE' });
      } catch (e) {}
    }
  };

  // Client connection toggle
  const handleToggleClient = async (companyName: string) => {
    let updated: string[];
    if (clients.includes(companyName)) {
      updated = clients.filter((c) => c !== companyName);
    } else {
      updated = [...clients, companyName];
    }
    setClients(updated);
    localStorage.setItem('occa_clients', JSON.stringify(updated));

    try {
      await authFetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName }),
      });
    } catch (e) {
      console.warn('Failed to sync client to server:', e);
    }
  };

  const handleClearAllClients = async () => {
    if (window.confirm('Are you sure you want to disconnect all corporate clients?')) {
      setClients([]);
      localStorage.setItem('occa_clients', JSON.stringify([]));

      try {
        await authFetch('/api/clients', { method: 'DELETE' });
      } catch (e) {
        console.warn('Failed to clear clients on server:', e);
      }
    }
  };

  // Share
  const handleShare = (listing: Listing) => {
    const shareText = `${listing.title} — ${listing.companyName}`;
    const url = listing.externalLink || window.location.href;

    if (navigator.share) {
      navigator.share({ title: listing.title, text: shareText, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${shareText}\n${url}`).catch(() => {
        showToast('Sharing is not supported on this browser.');
      });
    } else {
      showToast('Sharing is not supported on this browser.');
    }
  };

  // Opens a WhatsApp conversation directly with the listing's poster, using
  // the phone number they registered against that listing/business.
  const handleWhatsAppContact = (listing: Listing) => {
    const rawPhone = listing.posterWhatsapp;
    if (!rawPhone) {
      showToast(`${listing.companyName} hasn't listed a WhatsApp number yet.`);
      return;
    }
    const digits = rawPhone.replace(/[^\d]/g, '');
    if (!digits) {
      showToast(`${listing.companyName} hasn't listed a valid WhatsApp number.`);
      return;
    }
    const prefilledText = `Hi ${listing.companyName}, I saw your listing "${listing.title}" on OCCA and I'm interested.`;
    const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(prefilledText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Opens the buyer's Gmail compose window addressed to the listing's poster.
  const handleEmailContact = (listing: Listing) => {
    const email = listing.posterEmail;
    if (!email) {
      showToast(`${listing.companyName} hasn't listed an email address yet.`);
      return;
    }
    const subject = `Enquiry: ${listing.title}`;
    const body = `Hi ${listing.companyName}, I saw your listing "${listing.title}" on OCCA and I'm interested.`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  };

  // Opens the buyer's SMS/messages app with the poster's number pre-filled.
  const handleDirectMessageContact = (listing: Listing) => {
    const rawPhone = listing.posterWhatsapp;
    if (!rawPhone) {
      showToast(`${listing.companyName} hasn't listed a phone number yet.`);
      return;
    }
    const digits = rawPhone.replace(/[^\d+]/g, '');
    if (!digits) {
      showToast(`${listing.companyName} hasn't listed a valid phone number.`);
      return;
    }
    const prefilledText = `Hi ${listing.companyName}, I saw your listing "${listing.title}" on OCCA and I'm interested.`;
    window.location.href = `sms:${digits}?&body=${encodeURIComponent(prefilledText)}`;
  };

  // Secondary contact chooser — WhatsApp/Email/DM, surfaced directly on listings (via a
  // small "•••" next to Message) as well as from inside an open conversation, for any
  // poster who has ALSO enabled one of those optional channels. In-app messaging itself
  // no longer routes through this: see handleInboxContact below.
  const handleShowOtherContactOptions = (listing: Listing) => {
    const availableMethods = getAvailableExternalContactMethods(listing);

    if (availableMethods.length === 0) {
      showToast(`${listing.companyName} hasn't set up any other contact details.`);
      return;
    }

    setContactOptionsMethods(availableMethods);
    setContactOptionsListing(listing);
  };

  // Merges an updated conversation (from ConversationPage, after loading/sending
  // messages) back into the chat list — keeps unread counts and last-message previews
  // in sync without waiting for the next poll.
  const handleConversationUpdate = (updated: Conversation) => {
    setConversations((prev) => {
      const exists = prev.some((c) => c.id === updated.id);
      const merged = exists ? prev.map((c) => (c.id === updated.id ? updated : c)) : [updated, ...prev];
      return [...merged].sort(
        (a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime()
      );
    });
    setOpenConversation((prev) => (prev && prev.id === updated.id ? updated : prev));
  };

  // Starts (or resumes) an in-app conversation with a listing's poster and opens it —
  // this is now the platform's primary, default way to reach a poster. WhatsApp/Email/SMS
  // remain available as secondary channels via handleShowOtherContactOptions above.
  const startConversationForListing = async (listing: Listing) => {
    try {
      const res = await authFetch('/api/conversations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.conversation) {
        throw new Error(data.error || 'Could not start a conversation.');
      }
      handleConversationUpdate(data.conversation);
      // Close any overlay/sheet that might be open over the main view before jumping
      // to Messages, so the conversation isn't hidden behind a stale detail sheet.
      setSelectedDetailListing(null);
      setViewingCompanyListing(null);
      setCompanySubPage(null);
      setOpenConversation(data.conversation);
      setActiveTab('messages');
    } catch (e: any) {
      showToast(e.message || 'Could not start a conversation. Please check your connection and try again.');
    }
  };

  // "Message" button entry point on a post (still wired up via the onInboxContact prop
  // threaded through ListingCard/DetailSheet/CompanyProfilePage) — opens in-app
  // messaging directly, since that's now the platform's primary means of communication
  // and works for every account without the poster needing to set up WhatsApp/email first.
  const handleInboxContact = (listing: Listing) => {
    if (listing.isOwnPost) {
      showToast("This is your own listing — replies from buyers show up in Messages.");
      setActiveTab('messages');
      return;
    }
    startConversationForListing(listing);
  };

  // Opens a listing referenced from inside a conversation thread ("View Listing" chip).
  const handleOpenListingFromConversation = (listing: Listing) => {
    setOpenConversation(null);
    setSelectedDetailListing(listing);
  };

  // Open New Post Form (check verification)
  const handleOpenNewPost = () => {
    if (!isVerified || !profile) {
      setIsProfileUpgradeOpen(true);
      showToast('Please complete your verified corporate profile to publish listings.');
    } else {
      setIsPostFormOpen(true);
    }
  };

  // Create Listing via API
  const handleCreateListing = async (newListingData: Omit<Listing, 'id' | 'createdAt'>) => {
    const tempId = `occ-custom-${Date.now()}`;
    const newListing: Listing = {
      ...newListingData,
      id: tempId,
      createdAt: new Date().toISOString(),
      // Optimistically mark as our own post so it shows up in "My Posts" immediately;
      // the server assigns the real posterPhone and echoes back an authoritative
      // isOwnPost once the request completes below.
      isOwnPost: true,
    };

    // Optimistic UI update
    const updatedListings = [newListing, ...listings];
    setListings(updatedListings);
    localStorage.setItem('occa_listings', JSON.stringify(updatedListings));

    try {
      const res = await authFetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newListing),
      });
      const data = await res.json().catch(() => ({ success: false, error: `Server returned status ${res.status}` }));
      if (!res.ok || !data.success || !data.listing) {
        throw new Error(data.error || 'Failed to publish listing.');
      }
      setListings((prev) => {
        const next = prev.map((l) => (l.id === tempId ? data.listing : l));
        localStorage.setItem('occa_listings', JSON.stringify(next));
        return next;
      });
    } catch (e: any) {
      console.error('Error persisting listing to server API:', e);
      // Roll back the optimistic listing so the UI doesn't show a "published" post
      // that never actually made it to the server.
      setListings((prev) => {
        const rolledBack = prev.filter((l) => l.id !== tempId);
        localStorage.setItem('occa_listings', JSON.stringify(rolledBack));
        return rolledBack;
      });
      showToast(`Failed to publish listing: ${e.message || 'Please check your connection and try again.'}`);
      throw e;
    }
  };

  // Delete Listing Handler
  const handleDeleteListing = async (listingId: string) => {
    setListings((prev) => {
      const next = prev.filter((l) => l.id !== listingId);
      localStorage.setItem('occa_listings', JSON.stringify(next));
      return next;
    });

    try {
      await authFetch(`/api/listings/${listingId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Error deleting listing:', err);
    }
  };

  // Boost Listing Handler
  const handleBoostListing = async (listingId: string, boostPackage: string, days: number) => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    setListings((prev) =>
      prev.map((l) =>
        l.id === listingId
          ? {
              ...l,
              isBoosted: true,
              boostPackage,
              boostedUntil: expiryDate.toISOString(),
            }
          : l
      )
    );

    try {
      const res = await authFetch(`/api/listings/${listingId}/boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boostPackage, days }),
      });
      const data = await res.json();
      if (data.success && data.listing) {
        setListings((prev) =>
          prev.map((l) => (l.id === listingId ? data.listing : l))
        );
      }
    } catch (err) {
      console.error('Error boosting listing:', err);
    }
  };

  // Save Profile via API (used at sign-in, for basic profile edits, and business upgrade saves).
  // `newToken` is only passed the moment AuthGate hands back a fresh session token
  // (on register/login/password-reset) — it's what ties this device to its own account.
  const handleSaveProfile = async (newProfile: UserProfile, newToken?: string) => {
    setProfile(newProfile);
    setIsVerified(!!newProfile.isBusinessAccount);
    localStorage.setItem('occa_profile', JSON.stringify(newProfile));
    localStorage.setItem('occa_company_name', newProfile.companyName || '');

    let tokenToUse = authToken;
    if (newToken) {
      tokenToUse = newToken;
      setAuthToken(newToken);
      try {
        localStorage.setItem('occa_auth_token', newToken);
      } catch {}

      // A fresh login/register on this device — replace ANY data left over from a
      // previously signed-in account on this same browser (saved posts, client
      // connections, and each listing's isOwnPost flag) with this account's own data,
      // rather than leaving stale state around until some later screen happens to
      // refetch it. This is what keeps two different accounts on one device from ever
      // showing each other's activity.
      const freshAuthedFetch = (url: string) =>
        fetch(url, { headers: { Authorization: `Bearer ${newToken}` } });

      try {
        const listingsRes = await freshAuthedFetch('/api/listings');
        const listingsData = await listingsRes.json();
        if (listingsData.success && Array.isArray(listingsData.listings)) {
          const occaListings = listingsData.listings.filter((l: Listing) => (l.companyName || '').trim().toLowerCase() === 'occa');
          if (occaListings.length > 0) {
            setListings(occaListings);
            localStorage.setItem('occa_listings', JSON.stringify(occaListings));
          } else {
            setListings(INITIAL_LISTINGS);
            localStorage.setItem('occa_listings', JSON.stringify(INITIAL_LISTINGS));
          }
        }
      } catch (e) {
        console.warn('Failed to refresh listings after sign-in:', e);
      }

      try {
        const savedRes = await freshAuthedFetch('/api/saved');
        const savedData = await savedRes.json();
        setSavedPostIds(Array.isArray(savedData.savedPostIds) ? savedData.savedPostIds : []);
        localStorage.setItem('occa_saved_posts', JSON.stringify(savedData.savedPostIds || []));
      } catch (e) {
        console.warn('Failed to refresh saved posts after sign-in:', e);
      }

      try {
        const clientsRes = await freshAuthedFetch('/api/clients');
        const clientsData = await clientsRes.json();
        setClients(Array.isArray(clientsData.clients) ? clientsData.clients : []);
        localStorage.setItem('occa_clients', JSON.stringify(clientsData.clients || []));
      } catch (e) {
        console.warn('Failed to refresh clients after sign-in:', e);
      }

      try {
        const settingsRes = await freshAuthedFetch('/api/settings');
        const settingsData = await settingsRes.json();
        if (settingsData.success && settingsData.settings) {
          const merged = { ...DEFAULT_SETTINGS, ...settingsData.settings };
          setSettings(merged);
          localStorage.setItem('occa_settings', JSON.stringify(merged));
          if (merged.defaultViewMode) setViewMode(merged.defaultViewMode);
        }
      } catch (e) {
        console.warn('Failed to refresh settings after sign-in:', e);
      }
    }

    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tokenToUse ? { Authorization: `Bearer ${tokenToUse}` } : {}),
        },
        body: JSON.stringify(newProfile),
      });
    } catch (e) {}
  };

  // Update Settings via API
  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    if (newSettings.defaultViewMode) {
      setViewMode(newSettings.defaultViewMode);
    }
    localStorage.setItem('occa_settings', JSON.stringify(updated));

    try {
      await authFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (e) {}
  };

  // Exit App
  const handleExitApp = async () => {
    try {
      if ((window as any).ReactNativeWebView?.postMessage) {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify({ action: 'exit' }));
      }
    } catch (e) {}

    try {
      await authFetch('/api/profile/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Backend logout sync warning:', err);
    }

    // Clear all profile + session + account-scoped data — this is what actually signs
    // THIS device out. Previously only the profile/token were cleared, so saved posts,
    // client connections, and (in-memory) which listings were "mine" could linger and
    // then get shown under the NEXT account that signs in on this device, until some
    // later screen happened to refetch them. Clearing everything here closes that gap.
    localStorage.removeItem('occa_profile');
    localStorage.removeItem('occa_company_name');
    localStorage.removeItem('occa_auth_token');
    localStorage.removeItem('occa_saved_posts');
    localStorage.removeItem('occa_clients');

    setAuthToken(null);
    setProfile(null);
    setIsVerified(false);
    setSavedPostIds([]);
    setClients([]);
    // Conversations are per-account, same reason as saved posts/clients above — otherwise
    // the next account signed in on this device would briefly see the previous account's chats.
    setConversations([]);
    setOpenConversation(null);
    // Listings themselves are public/shared, so they're kept — just strip the
    // per-viewer isOwnPost flag so nothing still reads as "my posts" while signed out.
    setListings((prev) => prev.map((l) => ({ ...l, isOwnPost: false })));
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (!profile) {
    return (
      <AuthGate
        onSignInComplete={handleSaveProfile}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-800 dark:text-neutral-100 font-sans antialiased selection:bg-indigo-600 selection:text-white transition-colors duration-200">
      {/* Top Header Navigation */}
      <HeaderNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setViewingCompanyListing(null);
          setCompanySubPage(null);
          if (tab !== 'messages') setOpenConversation(null);
          setActiveTab(tab);
        }}
        messagesUnreadCount={totalUnreadMessages}
        darkTheme={settings.darkTheme}
      />

      {/* Main Page View Routing */}
      <main className="min-h-[calc(100vh-64px)]">
        {viewingCompanyListing ? (
          companySubPage === 'posts' ? (
            <CompanyPostsPage
              companyName={viewingCompanyListing.companyName}
              listings={listings}
              currentListingId={viewingCompanyListing.id}
              onOpenDetail={setSelectedDetailListing}
              onBack={() => setCompanySubPage(null)}
            />
          ) : companySubPage === 'reviews' ? (
            <CompanyReviewsPage
              companyName={viewingCompanyListing.companyName}
              profile={profile}
              authFetch={authFetch}
              onShowToast={showToast}
              onBack={() => setCompanySubPage(null)}
            />
          ) : (
            <CompanyProfilePage
              listing={viewingCompanyListing}
              listings={listings}
              clients={clients}
              onToggleClient={handleToggleClient}
              onInboxContact={handleInboxContact}
              onShowOtherContactOptions={handleShowOtherContactOptions}
              onOpenDetail={setSelectedDetailListing}
              onBack={() => setViewingCompanyListing(null)}
              profile={profile}
              authFetch={authFetch}
              onShowToast={showToast}
              onViewAllPosts={() => setCompanySubPage('posts')}
              onViewAllReviews={() => setCompanySubPage('reviews')}
            />
          )
        ) : (
          <>
            {activeTab === 'home' && (
              <HomePage
                listings={listings}
                savedPostIds={savedPostIds}
                myPostIds={myPostIds}
                activeCategory={activeCategory}
                viewMode={viewMode}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onSelectCategory={setActiveCategory}
                onToggleViewMode={() => setViewMode((v) => (v === 'cards' ? 'table' : 'cards'))}
                onOpenDetail={setSelectedDetailListing}
                onOpenAuthorProfile={openCompanyProfile}
                onToggleSave={handleToggleSave}
                onShare={handleShare}
                onInboxContact={handleInboxContact}
                onShowOtherContactOptions={handleShowOtherContactOptions}
                onOpenNewPost={handleOpenNewPost}
                      />
            )}

            {activeTab === 'search' && (
              <SearchPage
                listings={listings}
                savedPostIds={savedPostIds}
                myPostIds={myPostIds}
                autoRotateCarousel={settings.autoRotateCarousel}
                onOpenDetail={setSelectedDetailListing}
                onOpenAuthorProfile={openCompanyProfile}
                onToggleSave={handleToggleSave}
                onShare={handleShare}
                onInboxContact={handleInboxContact}
                onShowOtherContactOptions={handleShowOtherContactOptions}
              />
            )}

            {activeTab === 'messages' && (
              openConversation ? (
                <ConversationPage
                  conversation={openConversation}
                  listings={listings}
                  authFetch={authFetch}
                  onBack={() => {
                    setOpenConversation(null);
                    fetchConversations({ silent: true });
                  }}
                  onShowToast={showToast}
                  onConversationUpdate={handleConversationUpdate}
                  onOpenListing={handleOpenListingFromConversation}
                  onShowOtherContactOptions={handleShowOtherContactOptions}
                />
              ) : (
                <MessagesPage
                  conversations={conversations}
                  isLoading={isLoadingConversations}
                  onOpenConversation={setOpenConversation}
                />
              )
            )}

            {false && activeTab === 'myposts' && (
              <MyPostsPage
                listings={listings}
                myPostIds={myPostIds}
                profile={profile}
                isVerified={isVerified}
                onOpenDetail={setSelectedDetailListing}
                onOpenNewPost={handleOpenNewPost}
                onDeleteListing={handleDeleteListing}
                onBoostListing={handleBoostListing}
                onShare={handleShare}
                onOpenUpgradeProfile={() => setIsProfileUpgradeOpen(true)}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPage
                profile={profile}
                isVerified={isVerified}
                settings={settings}
                savedCount={savedPostIds.length}
                onUpdateSettings={handleUpdateSettings}
                onOpenEditProfile={() => setIsProfileEditOpen(true)}
                onOpenUpgradeProfile={() => setIsProfileUpgradeOpen(true)}
                onOpenCorporateConsole={() => setIsCorporateConsoleOpen(true)}
                onClearSavedPosts={handleClearAllSaved}
                onShowToast={showToast}
                onExitApp={handleExitApp}
                onNavigateMyPosts={() => setActiveTab('myposts')}
              />
            )}
          </>
        )}
      </main>



      {/* Sheet & Modal Popups */}
      <DetailSheet
        listing={selectedDetailListing}
        isSaved={selectedDetailListing ? savedPostIds.includes(selectedDetailListing.id) : false}
        onClose={() => setSelectedDetailListing(null)}
        onToggleSave={handleToggleSave}
        onShare={handleShare}
        onInboxContact={handleInboxContact}
        onShowOtherContactOptions={handleShowOtherContactOptions}
        onOpenAuthorProfile={(listing) => {
          setSelectedDetailListing(null);
          openCompanyProfile(listing);
        }}
      />

      <PostFormSheet
        isOpen={isPostFormOpen}
        profile={profile}
        onClose={() => setIsPostFormOpen(false)}
        onSubmitListing={handleCreateListing}
        onShowToast={showToast}
      />

      <ProfileEditSheet
        isOpen={isProfileEditOpen}
        existingProfile={profile}
        onClose={() => setIsProfileEditOpen(false)}
        onSaveProfile={handleSaveProfile}
        onShowToast={showToast}
      />

      <ProfileUpgradeSheet
        isOpen={isProfileUpgradeOpen}
        existingProfile={profile}
        onClose={() => setIsProfileUpgradeOpen(false)}
        onSaveProfile={handleSaveProfile}
        onShowToast={showToast}
      />

      <CorporateConsoleSheet
        isOpen={isCorporateConsoleOpen}
        existingProfile={profile}
        isVerified={isVerified}
        onClose={() => setIsCorporateConsoleOpen(false)}
        onSaveProfile={handleSaveProfile}
        onShowToast={showToast}
        onOpenUpgradeProfile={() => setIsProfileUpgradeOpen(true)}
      />

      <ContactOptionsSheet
        listing={contactOptionsListing}
        methods={contactOptionsMethods}
        onClose={() => setContactOptionsListing(null)}
        onSelectWhatsApp={handleWhatsAppContact}
        onSelectEmail={handleEmailContact}
        onSelectDirectMessage={handleDirectMessageContact}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] max-w-[90vw] px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-700 shadow-2xl text-xs font-semibold text-white text-center"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
