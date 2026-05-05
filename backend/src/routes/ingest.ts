import type { Context } from "hono";
import type { HonoEnv } from "../types";
import { db } from "../db";
import { profiles } from "../db/schema";
import { invalidateProfilesCache } from "../middleware/cache";
import { uuidv7 } from "uuidv7";

const BATCH_SIZE = 1000;

const VALID_GENDERS = new Set(["male", "female"]);
const VALID_AGE_GROUPS = new Set(["child", "teenager", "adult", "senior"]);

function deriveAgeGroup(age: number): string {
  if (age <= 12) return "child";
  if (age <= 17) return "teenager";
  if (age <= 64) return "adult";
  return "senior";
}

/**
 * Parse a single CSV line, handling double-quoted fields.
 * Returns null if the line is structurally malformed (unmatched quotes).
 */
function parseCSVLine(line: string): string[] | null {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      let field = "";
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          field += line[i++];
        }
      }
      // After closing quote, must be comma or end of line
      if (i < line.length && line[i] !== ",") return null;
      fields.push(field);
      i++; // skip comma
    } else {
      // Unquoted field
      const end = line.indexOf(",", i);
      if (end === -1) {
        fields.push(line.slice(i));
        break;
      } else {
        fields.push(line.slice(i, end));
        i = end + 1;
      }
    }
  }
  // Handle trailing comma → empty last field
  if (line.endsWith(",")) fields.push("");
  return fields;
}

type SkipReasons = Record<string, number>;

function bumpReason(reasons: SkipReasons, key: string) {
  reasons[key] = (reasons[key] ?? 0) + 1;
}

/**
 * Async generator: yields lines from a ReadableStream<Uint8Array> without
 * loading the full body into memory.
 */
async function* streamLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.length > 0) yield buffer.replace(/\r$/, "");
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        yield line.replace(/\r$/, "");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function ingestCSV(c: Context<HonoEnv>) {
  const body = c.req.raw.body;
  if (!body) {
    return c.json({ status: "error", message: "Request body is empty" }, 400);
  }

  const stats = {
    total_rows: 0,
    inserted: 0,
    skipped: 0,
    reasons: {} as SkipReasons,
  };

  let headerMap: Record<string, number> = {};
  let headerParsed = false;
  let batch: (typeof profiles.$inferInsert)[] = [];

  const flushBatch = async () => {
    if (batch.length === 0) return;
    try {
      // Use ON CONFLICT DO NOTHING for idempotency as required
      const inserted = await db
        .insert(profiles)
        .values(batch)
        .onConflictDoNothing({ target: profiles.name })
        .returning({ id: profiles.id });

      stats.inserted += inserted.length;
      const duplicates = batch.length - inserted.length;
      if (duplicates > 0) {
        stats.skipped += duplicates;
        stats.reasons.duplicate_name = (stats.reasons.duplicate_name ?? 0) + duplicates;
      }
    } catch (err) {
      console.error("Batch insert error:", err);
      stats.skipped += batch.length;
      bumpReason(stats.reasons, "insert_error");
    } finally {
      batch = [];
    }
  };

  for await (const line of streamLines(body)) {
    if (!line.trim()) continue;

    if (!headerParsed) {
      const cols = parseCSVLine(line);
      if (!cols) return c.json({ status: "error", message: "Malformed CSV header" }, 400);
      
      cols.forEach((col, idx) => {
        headerMap[col.trim().toLowerCase()] = idx;
      });
      
      if (headerMap.name === undefined) {
        return c.json({ status: "error", message: "CSV must include a 'name' column" }, 400);
      }
      headerParsed = true;
      continue;
    }

    stats.total_rows++;

    const fields = parseCSVLine(line);
    if (!fields || fields.length !== Object.keys(headerMap).length) {
      stats.skipped++;
      bumpReason(stats.reasons, "malformed_row");
      continue;
    }

    const get = (col: string) => {
      const idx = headerMap[col];
      return idx !== undefined ? fields[idx]?.trim() ?? "" : "";
    };

    const name = get("name");
    const gender = get("gender").toLowerCase();
    const ageRaw = get("age");

    // Validation
    if (!name || !gender || !ageRaw) {
      stats.skipped++;
      bumpReason(stats.reasons, "missing_fields");
      continue;
    }

    if (!VALID_GENDERS.has(gender)) {
      stats.skipped++;
      bumpReason(stats.reasons, "invalid_gender");
      continue;
    }

    const age = parseInt(ageRaw, 10);
    if (isNaN(age) || age < 0 || age > 150) {
      stats.skipped++;
      bumpReason(stats.reasons, "invalid_age");
      continue;
    }

    const gpRaw = get("gender_probability");
    const genderProbability = gpRaw ? parseFloat(gpRaw) : null;
    if (genderProbability !== null && (isNaN(genderProbability) || genderProbability < 0 || genderProbability > 1)) {
      stats.skipped++;
      bumpReason(stats.reasons, "invalid_gender_probability");
      continue;
    }

    let age_group = get("age_group").toLowerCase();
    if (age_group && !VALID_AGE_GROUPS.has(age_group)) {
      stats.skipped++;
      bumpReason(stats.reasons, "invalid_age_group");
      continue;
    }
    if (!age_group) age_group = deriveAgeGroup(age);

    const country_id = get("country_id").toUpperCase() || null;
    if (country_id && country_id.length !== 2) {
      stats.skipped++;
      bumpReason(stats.reasons, "invalid_country_id");
      continue;
    }

    const cpRaw = get("country_probability");
    const country_probability = cpRaw ? parseFloat(cpRaw) : null;
    if (country_probability !== null && (isNaN(country_probability) || country_probability < 0 || country_probability > 1)) {
      stats.skipped++;
      bumpReason(stats.reasons, "invalid_country_probability");
      continue;
    }

    batch.push({
      id: uuidv7(),
      name,
      gender,
      gender_probability: genderProbability,
      age,
      age_group,
      country_id,
      country_name: get("country_name") || null,
      country_probability,
    });

    if (batch.length >= BATCH_SIZE) {
      await flushBatch();
    }
  }

  await flushBatch();
  invalidateProfilesCache();

  return c.json({
    status: "success",
    total_rows: stats.total_rows,
    inserted: stats.inserted,
    skipped: stats.skipped,
    reasons: stats.reasons,
  });
}
