import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// max:1 per serverless function — Neon's pooler multiplexes onto a real pool
export const client = postgres(connectionString, {
  prepare: false,
  ssl: "require",
  max: 1,
});
export const db = drizzle(client);

async function ensureSchema() {
  try {
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_name VARCHAR`);

    // Compound indexes for the most common filter combinations.
    // CREATE INDEX IF NOT EXISTS is idempotent — safe to run on every cold start.
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_profiles_gender_country
        ON profiles(gender, country_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_profiles_gender_age
        ON profiles(gender, age)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_profiles_country_age_group
        ON profiles(country_id, age_group)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_profiles_age
        ON profiles(age)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_profiles_age_group
        ON profiles(age_group)
    `);
  } catch (e) {
    console.error("Schema sync failed:", e);
  }
}

ensureSchema();
