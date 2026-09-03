import { createClient, type Client } from "@libsql/client";
import { Listing, UserProfile, AppSettings, Review } from "../types.js";

// Server-only record shapes for in-app messaging — these carry participant phone
// numbers, which must never reach the client. See server.ts's toPublicConversation /
// toPublicMessage for what actually gets sent back in API responses.
export interface ConversationRecord {
  id: string;
  participantPhones: [string, string];
  listingId?: string;
  listingTitle?: string;
  lastMessageText?: string;
  lastMessageAt?: string;
  lastMessageSenderPhone?: string;
  /** Per-participant "I've seen everything up to here" marker, keyed by phone. */
  lastReadAt: Record<string, string>;
  createdAt: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderPhone: string;
  text: string;
  createdAt: string;
}

let client: Client | null = null;

/**
 * Server-side Turso (libSQL) client using the auth token.
 * NEVER import this file from browser/client code — the auth token
 * grants full read/write access to the database and must stay server-only.
 */
function getTursoClient(): Client {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error(
      "Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables"
    );
  }

  client = createClient({ url, authToken });
  return client;
}

export function getTursoConfig() {
  return {
    url: process.env.TURSO_DATABASE_URL || "",
  };
}

// Same table shape supabase-schema.sql used: id/key + a JSON "data" blob
// column per table. Kept inline (rather than read from turso-schema.sql on
// disk) so it also runs correctly from a bundled serverless function.
const SCHEMA_SQL = `
create table if not exists listings (
  id text primary key,
  data text not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create table if not exists profiles (
  id text primary key,
  data text not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create table if not exists settings (
  id text primary key,
  data text not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create table if not exists saved_posts (
  listing_id text primary key,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create table if not exists client_connections (
  company_name text primary key,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create table if not exists users (
  phone text primary key,
  data text not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create table if not exists reviews (
  id text primary key,
  company_name text not null,
  data text not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists reviews_company_name_idx on reviews (company_name);
create table if not exists conversations (
  id text primary key,
  data text not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create table if not exists messages (
  id text primary key,
  conversation_id text not null,
  data text not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists messages_conversation_id_idx on messages (conversation_id);
`;

/**
 * Creates all required tables if they do not exist. Unlike Supabase (whose
 * JS client can't run arbitrary DDL), libSQL can run CREATE TABLE directly —
 * so this actually provisions the schema instead of just checking for it.
 */
export async function initTursoTables(): Promise<boolean> {
  try {
    const turso = getTursoClient();
    await turso.executeMultiple(SCHEMA_SQL);
    console.log("[Turso] Connected and tables verified/created!");
    return true;
  } catch (err: any) {
    console.error("[Turso] Error initializing tables:", err.message || err);
    return false;
  }
}

/**
 * Fetch all listings from Turso
 */
export async function fetchListingsFromTurso(): Promise<Listing[]> {
  try {
    const turso = getTursoClient();
    const { rows } = await turso.execute(
      "select data from listings order by updated_at desc"
    );
    return rows.map((row: any) => JSON.parse(row.data as string) as Listing);
  } catch (err: any) {
    console.warn("[Turso] Failed to fetch listings:", err.message || err);
  }
  return [];
}

/**
 * Save or replace a single listing in Turso
 */
export async function saveListingToTurso(listing: Listing): Promise<boolean> {
  try {
    const turso = getTursoClient();
    await turso.execute({
      sql: "insert into listings (id, data, updated_at) values (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) on conflict(id) do update set data = excluded.data, updated_at = excluded.updated_at",
      args: [listing.id, JSON.stringify(listing)],
    });
    console.log(`[Turso] Saved listing '${listing.id}' successfully!`);
    return true;
  } catch (err: any) {
    console.error(`[Turso] Error saving listing ${listing.id}:`, err.message || err);
    return false;
  }
}

/**
 * Save multiple listings to Turso
 */
export async function saveAllListingsToTurso(listings: Listing[]): Promise<boolean> {
  try {
    if (listings.length === 0) return true;
    const turso = getTursoClient();
    await turso.batch(
      listings.map((listing) => ({
        sql: "insert into listings (id, data, updated_at) values (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) on conflict(id) do update set data = excluded.data, updated_at = excluded.updated_at",
        args: [listing.id, JSON.stringify(listing)],
      })),
      "write"
    );
    return true;
  } catch (err: any) {
    console.error("[Turso] Error saving batch listings:", err.message || err);
    return false;
  }
}

/**
 * Delete a listing from Turso
 */
export async function deleteListingFromTurso(id: string): Promise<boolean> {
  try {
    const turso = getTursoClient();
    await turso.execute({ sql: "delete from listings where id = ?", args: [id] });
    console.log(`[Turso] Deleted listing '${id}' successfully!`);
    return true;
  } catch (err: any) {
    console.error(`[Turso] Error deleting listing ${id}:`, err.message || err);
    return false;
  }
}

/**
 * Fetch profile from Turso
 */
export async function fetchProfileFromTurso(): Promise<UserProfile | null> {
  try {
    const turso = getTursoClient();
    const { rows } = await turso.execute({
      sql: "select data from profiles where id = ?",
      args: ["main"],
    });
    return rows[0] ? (JSON.parse(rows[0].data as string) as UserProfile) : null;
  } catch (err: any) {
    console.warn("[Turso] Failed to fetch profile:", err.message || err);
  }
  return null;
}

/**
 * Save profile to Turso
 */
export async function saveProfileToTurso(profile: UserProfile): Promise<boolean> {
  try {
    const turso = getTursoClient();
    await turso.execute({
      sql: "insert into profiles (id, data, updated_at) values ('main', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) on conflict(id) do update set data = excluded.data, updated_at = excluded.updated_at",
      args: [JSON.stringify(profile)],
    });
    console.log("[Turso] Saved profile successfully!");
    return true;
  } catch (err: any) {
    console.error("[Turso] Error saving profile:", err.message || err);
    return false;
  }
}

/**
 * Fetch settings from Turso
 */
export async function fetchSettingsFromTurso(): Promise<AppSettings | null> {
  try {
    const turso = getTursoClient();
    const { rows } = await turso.execute({
      sql: "select data from settings where id = ?",
      args: ["main"],
    });
    return rows[0] ? (JSON.parse(rows[0].data as string) as AppSettings) : null;
  } catch (err: any) {
    console.warn("[Turso] Failed to fetch settings:", err.message || err);
  }
  return null;
}

/**
 * Save settings to Turso
 */
export async function saveSettingsToTurso(settings: AppSettings): Promise<boolean> {
  try {
    const turso = getTursoClient();
    await turso.execute({
      sql: "insert into settings (id, data, updated_at) values ('main', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) on conflict(id) do update set data = excluded.data, updated_at = excluded.updated_at",
      args: [JSON.stringify(settings)],
    });
    console.log("[Turso] Saved settings successfully!");
    return true;
  } catch (err: any) {
    console.error("[Turso] Error saving settings:", err.message || err);
    return false;
  }
}

/**
 * Fetch saved posts from Turso
 */
export async function fetchSavedPostsFromTurso(): Promise<string[]> {
  try {
    const turso = getTursoClient();
    const { rows } = await turso.execute("select listing_id from saved_posts");
    return rows.map((row: any) => row.listing_id as string);
  } catch (err: any) {
    console.warn("[Turso] Failed to fetch saved posts:", err.message || err);
  }
  return [];
}

/**
 * Save saved posts to Turso (full replace)
 */
export async function saveSavedPostsToTurso(savedIds: string[]): Promise<boolean> {
  try {
    const turso = getTursoClient();
    const statements = [{ sql: "delete from saved_posts", args: [] }];
    for (const id of savedIds) {
      statements.push({ sql: "insert into saved_posts (listing_id) values (?)", args: [id] });
    }
    await turso.batch(statements, "write");
    console.log("[Turso] Saved saved posts successfully!");
    return true;
  } catch (err: any) {
    console.error("[Turso] Error saving saved posts:", err.message || err);
    return false;
  }
}

/**
 * Fetch client connections from Turso
 */
export async function fetchClientsFromTurso(): Promise<string[]> {
  try {
    const turso = getTursoClient();
    const { rows } = await turso.execute("select company_name from client_connections");
    return rows.map((row: any) => row.company_name as string);
  } catch (err: any) {
    console.warn("[Turso] Failed to fetch clients:", err.message || err);
  }
  return [];
}

/**
 * Save client connections to Turso (full replace)
 */
export async function saveClientsToTurso(companies: string[]): Promise<boolean> {
  try {
    const turso = getTursoClient();
    const statements = [{ sql: "delete from client_connections", args: [] }];
    for (const company_name of companies) {
      statements.push({ sql: "insert into client_connections (company_name) values (?)", args: [company_name] });
    }
    await turso.batch(statements, "write");
    console.log("[Turso] Saved client connections successfully!");
    return true;
  } catch (err: any) {
    console.error("[Turso] Error saving client connections:", err.message || err);
    return false;
  }
}

/**
 * Fetch all registered user accounts (phone -> account record, including
 * hashed password/security answer and embedded profile) from Turso.
 * Keyed by phone so it can be merged directly into the in-memory usersStore.
 */
export async function fetchUsersFromTurso(): Promise<Record<string, any>> {
  try {
    const turso = getTursoClient();
    const { rows } = await turso.execute("select phone, data from users");
    const result: Record<string, any> = {};
    for (const row of rows as any[]) {
      result[row.phone as string] = JSON.parse(row.data as string);
    }
    return result;
  } catch (err: any) {
    console.warn("[Turso] Failed to fetch users:", err.message || err);
  }
  return {};
}

/**
 * Save or update a single user account in Turso.
 * `cleanPhone` is the digits-only key used as usersStore's dictionary key.
 */
export async function saveUserToTurso(cleanPhone: string, userRecord: any): Promise<boolean> {
  try {
    const turso = getTursoClient();
    await turso.execute({
      sql: "insert into users (phone, data, updated_at) values (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) on conflict(phone) do update set data = excluded.data, updated_at = excluded.updated_at",
      args: [cleanPhone, JSON.stringify(userRecord)],
    });
    return true;
  } catch (err: any) {
    console.error(`[Turso] Error saving user ${cleanPhone}:`, err.message || err);
    return false;
  }
}

/**
 * Save every user account in one batch (used to seed Turso from an
 * existing local users.json the first time this runs against a fresh DB).
 */
export async function saveAllUsersToTurso(usersStore: Record<string, any>): Promise<boolean> {
  try {
    const entries = Object.entries(usersStore);
    if (entries.length === 0) return true;
    const turso = getTursoClient();
    await turso.batch(
      entries.map(([phone, data]) => ({
        sql: "insert into users (phone, data, updated_at) values (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) on conflict(phone) do update set data = excluded.data, updated_at = excluded.updated_at",
        args: [phone, JSON.stringify(data)],
      })),
      "write"
    );
    return true;
  } catch (err: any) {
    console.error("[Turso] Error saving batch users:", err.message || err);
    return false;
  }
}

/**
 * Fetch all company reviews from Turso (every company — callers filter by
 * companyName themselves, same as fetchListingsFromTurso).
 */
export async function fetchReviewsFromTurso(): Promise<Review[]> {
  try {
    const turso = getTursoClient();
    const { rows } = await turso.execute(
      "select data from reviews order by updated_at desc"
    );
    return rows.map((row: any) => JSON.parse(row.data as string) as Review);
  } catch (err: any) {
    console.warn("[Turso] Failed to fetch reviews:", err.message || err);
  }
  return [];
}

/**
 * Save or replace a single review in Turso
 */
export async function saveReviewToTurso(review: Review): Promise<boolean> {
  try {
    const turso = getTursoClient();
    await turso.execute({
      sql: "insert into reviews (id, company_name, data, updated_at) values (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) on conflict(id) do update set data = excluded.data, company_name = excluded.company_name, updated_at = excluded.updated_at",
      args: [review.id, review.companyName, JSON.stringify(review)],
    });
    console.log(`[Turso] Saved review '${review.id}' successfully!`);
    return true;
  } catch (err: any) {
    console.error(`[Turso] Error saving review ${review.id}:`, err.message || err);
    return false;
  }
}

/**
 * Save multiple reviews to Turso (used to seed a fresh DB from local reviews.json)
 */
export async function saveAllReviewsToTurso(reviews: Review[]): Promise<boolean> {
  try {
    if (reviews.length === 0) return true;
    const turso = getTursoClient();
    await turso.batch(
      reviews.map((review) => ({
        sql: "insert into reviews (id, company_name, data, updated_at) values (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) on conflict(id) do update set data = excluded.data, company_name = excluded.company_name, updated_at = excluded.updated_at",
        args: [review.id, review.companyName, JSON.stringify(review)],
      })),
      "write"
    );
    return true;
  } catch (err: any) {
    console.error("[Turso] Error saving batch reviews:", err.message || err);
    return false;
  }
}

/**
 * Delete a review from Turso
 */
export async function deleteReviewFromTurso(id: string): Promise<boolean> {
  try {
    const turso = getTursoClient();
    await turso.execute({ sql: "delete from reviews where id = ?", args: [id] });
    console.log(`[Turso] Deleted review '${id}' successfully!`);
    return true;
  } catch (err: any) {
    console.error(`[Turso] Error deleting review ${id}:`, err.message || err);
    return false;
  }
}

/**
 * Fetch every conversation from Turso (every account's threads — callers filter down
 * to the ones a given phone participates in themselves, same pattern as
 * fetchListingsFromTurso/fetchReviewsFromTurso).
 */
export async function fetchConversationsFromTurso(): Promise<ConversationRecord[]> {
  try {
    const turso = getTursoClient();
    const { rows } = await turso.execute(
      "select data from conversations order by updated_at desc"
    );
    return rows.map((row: any) => JSON.parse(row.data as string) as ConversationRecord);
  } catch (err: any) {
    console.warn("[Turso] Failed to fetch conversations:", err.message || err);
  }
  return [];
}

/**
 * Save or replace a single conversation in Turso
 */
export async function saveConversationToTurso(conversation: ConversationRecord): Promise<boolean> {
  try {
    const turso = getTursoClient();
    await turso.execute({
      sql: "insert into conversations (id, data, updated_at) values (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) on conflict(id) do update set data = excluded.data, updated_at = excluded.updated_at",
      args: [conversation.id, JSON.stringify(conversation)],
    });
    return true;
  } catch (err: any) {
    console.error(`[Turso] Error saving conversation ${conversation.id}:`, err.message || err);
    return false;
  }
}

/**
 * Save multiple conversations to Turso in one batch (used to seed a fresh DB).
 */
export async function saveAllConversationsToTurso(conversations: ConversationRecord[]): Promise<boolean> {
  try {
    if (conversations.length === 0) return true;
    const turso = getTursoClient();
    await turso.batch(
      conversations.map((conversation) => ({
        sql: "insert into conversations (id, data, updated_at) values (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) on conflict(id) do update set data = excluded.data, updated_at = excluded.updated_at",
        args: [conversation.id, JSON.stringify(conversation)],
      })),
      "write"
    );
    return true;
  } catch (err: any) {
    console.error("[Turso] Error saving batch conversations:", err.message || err);
    return false;
  }
}

/**
 * Fetch every message from Turso across every conversation. Messaging volume is modest
 * enough (mirrors fetchListingsFromTurso/fetchReviewsFromTurso) that the server just
 * keeps them all in memory and filters by conversationId per-request, rather than
 * paginating from the database on every read.
 */
export async function fetchMessagesFromTurso(): Promise<MessageRecord[]> {
  try {
    const turso = getTursoClient();
    const { rows } = await turso.execute(
      "select data from messages order by updated_at asc"
    );
    return rows.map((row: any) => JSON.parse(row.data as string) as MessageRecord);
  } catch (err: any) {
    console.warn("[Turso] Failed to fetch messages:", err.message || err);
  }
  return [];
}

/**
 * Save a single message to Turso
 */
export async function saveMessageToTurso(message: MessageRecord): Promise<boolean> {
  try {
    const turso = getTursoClient();
    await turso.execute({
      sql: "insert into messages (id, conversation_id, data, updated_at) values (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) on conflict(id) do update set data = excluded.data, conversation_id = excluded.conversation_id, updated_at = excluded.updated_at",
      args: [message.id, message.conversationId, JSON.stringify(message)],
    });
    return true;
  } catch (err: any) {
    console.error(`[Turso] Error saving message ${message.id}:`, err.message || err);
    return false;
  }
}

/**
 * Save multiple messages to Turso in one batch (used to seed a fresh DB).
 */
export async function saveAllMessagesToTurso(messages: MessageRecord[]): Promise<boolean> {
  try {
    if (messages.length === 0) return true;
    const turso = getTursoClient();
    await turso.batch(
      messages.map((message) => ({
        sql: "insert into messages (id, conversation_id, data, updated_at) values (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) on conflict(id) do update set data = excluded.data, conversation_id = excluded.conversation_id, updated_at = excluded.updated_at",
        args: [message.id, message.conversationId, JSON.stringify(message)],
      })),
      "write"
    );
    return true;
  } catch (err: any) {
    console.error("[Turso] Error saving batch messages:", err.message || err);
    return false;
  }
}
