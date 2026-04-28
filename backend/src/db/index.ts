import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Disable prefetch as it is not supported for "Transaction" pool mode 
export const client = postgres(connectionString, { 
  prepare: false,
  ssl: 'require',
  max: 1 // Recommended for serverless to prevent connection exhaustion
});
export const db = drizzle(client);

// Self-healing: Ensure country_name column exists on startup
async function ensureSchema() {
  try {
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_name VARCHAR`);
  } catch (e) {
    console.error("Schema sync failed:", e);
  }
}
ensureSchema();