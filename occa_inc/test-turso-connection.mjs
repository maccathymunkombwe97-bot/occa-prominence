// Quick standalone connectivity test for Turso.
// Run with: node --env-file=.env test-turso-connection.mjs
// (needs: npm install @libsql/client)
//
// Reads credentials only from the environment — no hardcoded fallback
// secrets in this file (the old Supabase version had one; don't repeat that).

import { createClient } from "@libsql/client";

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  console.error("❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in your environment.");
  console.error("   Run with: node --env-file=.env test-turso-connection.mjs");
  process.exit(1);
}

const turso = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

async function main() {
  console.log("Connecting to:", TURSO_DATABASE_URL);
  try {
    await turso.executeMultiple(
      "create table if not exists listings (id text primary key, data text not null, updated_at text);"
    );
    const { rows } = await turso.execute("select id from listings limit 1");
    console.log("✅ Connected! Sample rows:", rows);
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  }
}

main();
