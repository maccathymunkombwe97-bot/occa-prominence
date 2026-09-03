-- Run this once against your Turso database:
--   turso db shell occaprominence-occaprominence < turso-schema.sql
-- or paste it into the Turso web console's SQL editor.
--
-- Mirrors the same table structure supabase-schema.sql used (id/key + a
-- JSON "data" blob column) so the swap from Supabase to Turso is a drop-in
-- replacement with no changes to how the app reads/writes each record.

create table if not exists listings (
  id text primary key,
  data text not null,             -- JSON-encoded Listing
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists profiles (
  id text primary key,
  data text not null,             -- JSON-encoded UserProfile
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists settings (
  id text primary key,
  data text not null,             -- JSON-encoded AppSettings
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
  data text not null,             -- JSON-encoded account record (hashed creds + embedded profile)
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Company reviews & ratings. `data` also carries the reviewer's account phone
-- (server-only field, never sent to clients) so edit/delete requests can be
-- verified against whoever authored the review.
create table if not exists reviews (
  id text primary key,
  company_name text not null,
  data text not null,             -- JSON-encoded Review
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create index if not exists reviews_company_name_idx on reviews (company_name);

-- In-app messaging — the platform's primary means of communication between buyers and
-- posters. One conversation per pair of accounts (not per listing); `data` carries both
-- participants' phones (server-only, never sent to clients) plus the listing that first
-- started the thread, for context.
create table if not exists conversations (
  id text primary key,
  data text not null,             -- JSON-encoded conversation record
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Individual messages within a conversation. `data` carries the sender's phone
-- (server-only) plus the message text/timestamp.
create table if not exists messages (
  id text primary key,
  conversation_id text not null,
  data text not null,             -- JSON-encoded message record
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create index if not exists messages_conversation_id_idx on messages (conversation_id);

-- No RLS equivalent needed: Turso access is gated entirely by the auth token
-- your server holds (TURSO_AUTH_TOKEN), same trust boundary the
-- SUPABASE_SECRET_KEY provided before.
