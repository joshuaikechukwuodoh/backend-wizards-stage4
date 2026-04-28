import { db, client } from "./db";
import { profiles } from "./db/schema";
import { uuidv7 } from "uuidv7";
import fs from "fs";
import path from "path";

async function seed() {
  try {
    const dataPath = path.join(process.cwd(), "src", "data.json");
    const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

    console.log(`Starting seed with ${data.length} profiles...`);
    
    // Chunk the data to avoid "too many parameters" error if the dataset is huge
    const chunkSize = 100;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      
      const values = chunk.map((p: any) => ({
        id: uuidv7(),
        name: p.name,
        gender: p.gender,
        gender_probability: Number(p.gender_probability),
        age: p.age,
        age_group: p.age_group,
        country_id: p.country_id,
        country_name: p.country_name,
        country_probability: Number(p.country_probability),
        created_at: new Date()
      }));

      await db.insert(profiles).values(values).onConflictDoNothing();
      console.log(`Inserted chunk ${i / chunkSize + 1}`);
    }

    console.log("Seeding complete!");
  } catch (error) {
    console.error("Seeding error:", error);
  } finally {
    await client.end();
  }
}

seed();