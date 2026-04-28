import { db, client } from "./db";
import { profiles } from "./db/schema";
import { sql } from "drizzle-orm";

async function check() {
  try {
    const colRes = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles'`);
    console.log("Columns:", colRes.map(r => r.column_name));

    const countRes = await db.select({ count: sql<string>`count(*)` }).from(profiles);
    console.log("Profile Count:", countRes[0]?.count ?? 0);
  } catch (error) {
    console.error("Error checking:", error);
  } finally {
    await client.end();
  }
}

check();
