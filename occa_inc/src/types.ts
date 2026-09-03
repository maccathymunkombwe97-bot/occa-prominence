export type ListingCategory = 
  | 'products'
  | 'services'
  | 'partnerships'
  | 'tenders'
  | 'acquisitions'
  | 'ventures';

export interface VerificationDoc {
  name: string;
  url: string;
}

/** The communication channels a business can offer buyers on a listing's "Inbox" button. */
export type ContactMethod = 'whatsapp' | 'email' | 'dm';

export interface Listing {
  id: string;
  title: string;
  companyName: string;
  companyId?: string;
  companySector?: string;
  category: ListingCategory;
  description: string;
  requirements?: string;
  town?: string;
  country?: string;
  compensation?: string;
  type?: string;
  externalLink?: string;
  images: string[];
  posterName?: string;
  posterEmail?: string;
  posterWhatsapp?: string;
  posterBusinessDetails?: string;
  posterProfilePic?: string;
  posterBackgroundUrl?: string;
  posterVerificationDocs?: VerificationDoc[];
  posterVerified?: boolean;
  /**
   * Server-side only — the phone key of the account that created this listing, used to
   * verify that edit/delete/boost requests and "My Posts" actually come from the real
   * owner. This must NEVER be sent to the client; the server strips it before every API
   * response (see toPublicListing in server.ts), same pattern as Review.authorPhone.
   */
  posterPhone?: string;
  /**
   * True when the current viewer's authenticated account created this listing. Only
   * meaningful on responses to authenticated requests — a convenience UI hint (drives
   * "My Posts") only; the server enforces actual edit/delete/boost permission
   * independently by matching posterPhone.
   */
  isOwnPost?: boolean;
  /**
   * Which communication channels the poster has enabled for the "Inbox" button on this
   * listing. Chosen by the post owner at publish time. If unset (older listings), defaults
   * to WhatsApp only, preserving prior behavior. If exactly one enabled method has usable
   * contact info, the Inbox button goes straight there; if more than one, the user is asked
   * to choose.
   */
  contactMethods?: ContactMethod[];
  createdAt: string;
  isBoosted?: boolean;
  boostPackage?: string;
  boostedUntil?: string;
  /**
   * Real, human-driven likes accrued from the actual Like/Save button (the only persisted
   * like counter). The number shown in the UI is this PLUS a deterministic simulated
   * "organic" component computed on the fly by src/utils/organicGrowth.ts — see that file
   * for details. Do not write simulated numbers into this field.
   */
  manualLikes?: number;
  /** @deprecated Legacy combined counter from before the organic growth engine existed.
   * Kept only so older synced/imported records aren't treated as having zero likes; new code
   * should read/write `manualLikes` instead. */
  likesCount?: number;
  /**
   * Permanent record of the highest total (organic + manual) like count that has ever been
   * shown for this post, written to the database by POST /api/listings/sync-likes. The
   * organic engine in organicGrowth.ts still computes the live, time-driven number the UI
   * shows moment-to-moment, but every value it ever displays gets synced here so nothing is
   * lost — this field only ever moves up, never down, and acts as a floor under the live
   * number (see getTotalPostLikes) so a recorded count survives redeploys, cold starts, or
   * future changes to the growth formula.
   */
  syncedLikes?: number;
}

export interface Review {
  id: string;
  /** Matches Listing.companyName — reviews are keyed by company name, same as
   * client connections and organic growth stats elsewhere in this app. */
  companyName: string;
  /**
   * Server-side only — the reviewer's account phone key, used to verify that an
   * edit/delete request actually comes from whoever wrote the review. This must
   * NEVER be sent to the client; the server strips it before every API response.
   */
  authorPhone?: string;
  authorName: string;
  authorProfilePic?: string;
  /** Whole-star rating, 1–5. */
  rating: number;
  text?: string;
  createdAt: string;
  updatedAt?: string;
  /**
   * True when the current viewer wrote this review. Only meaningful on responses
   * to authenticated requests — a convenience UI hint only; the server enforces
   * actual edit/delete permission independently by matching authorPhone.
   */
  isOwn?: boolean;
}

export interface UserProfile {
  // Basic profile — required of every user at account creation
  name: string;
  bio?: string;
  profilePicUrl?: string;

  // Business / Posting upgrade — only required to unlock posting
  isBusinessAccount?: boolean;
  companyName?: string;
  businessType?: string;
  email?: string;
  whatsapp?: string;
  businessDetails?: string;
  businessLogoUrl?: string;
  businessBackgroundUrl?: string;
  verificationDocs?: VerificationDoc[];

  // Corporate Console — Account Boost (applies elevated reach to every listing)
  accountBoostTier?: 'basic' | 'pro' | 'max';
  accountBoostExpiresAt?: string;

  // Corporate Console — Occa Membership (verification + bundled Account Boost + perks)
  membershipTier?: 'quarterly' | '6month' | 'yearly';
  membershipExpiresAt?: string;

  updatedAt?: string;
}

export const BUSINESS_TYPES = [
  'Individual / Freelancer',
  'Sole Proprietorship',
  'Registered Company (Ltd/PLC)',
  'Cooperative / SME',
  'NGO / Non-Profit',
  'Government Institution',
  'Other',
] as const;

export type PageTab = 'home' | 'search' | 'messages' | 'myposts' | 'settings';

/** Public-facing snapshot of the other person in a conversation — never includes phone. */
export interface ConversationParticipant {
  name: string;
  profilePicUrl?: string;
  companyName?: string;
}

/**
 * A chat thread between the current account and one other account (buyer <-> poster).
 * One conversation exists per pair of accounts — it isn't re-created per listing — but it
 * remembers which listing first started it so the thread keeps that context on screen.
 * This is the primary, in-app way people communicate on Occa; WhatsApp/Email/SMS (see
 * ContactMethod) remain optional secondary channels a poster can also enable.
 */
export interface Conversation {
  id: string;
  otherParticipant: ConversationParticipant;
  listingId?: string;
  listingTitle?: string;
  lastMessageText?: string;
  lastMessageAt?: string;
  /** True when the current viewer sent the most recent message in this thread. */
  lastMessageIsMine?: boolean;
  /** Messages from the other participant sent since the viewer last opened this thread. */
  unreadCount: number;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  text: string;
  createdAt: string;
  /** True when the current viewer authored this message. */
  isMine: boolean;
  senderName: string;
  senderProfilePicUrl?: string;
}

export interface AppSettings {
  defaultViewMode: 'cards' | 'table';
  notificationsEnabled: boolean;
  dealAlertsEnabled: boolean;
  autoRotateCarousel: boolean;
  darkTheme: boolean;
  userTown: string;
  userCountry: string;
  regionFilter: 'all' | 'town' | 'country' | 'international';
  enablePersonalizedFeed: boolean;
}
