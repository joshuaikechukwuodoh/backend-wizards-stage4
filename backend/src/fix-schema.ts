import { db, client } from "./db";
import { sql } from "drizzle-orm";

async function fixSchema() {
  try {
    console.log("Fixing schema: making sample_size nullable...");
    await db.execute(sql`ALTER TABLE profiles ALTER COLUMN sample_size DROP NOT NULL`);
    console.log("Done! sample_size is now nullable.");
  } catch (error: any) {
    if (error.message?.includes("does not exist")) {
      console.log("sample_size column doesn't exist — no fix needed.");
    } else {
      console.error("Error:", error.message);
    }
  } finally {
    await client.end();
  }
}

fixSchema();
