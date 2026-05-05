import { parseQuery, normalizeFilters, filtersToCacheKey } from "../utils/parser";
import { getProfiles } from "./profiles";
import { getCached, setCached } from "../middleware/cache";
import type { Context } from "hono";
import type { HonoEnv } from "../types";

export async function searchProfiles(c: Context<HonoEnv>) {
  try {
    const q = c.req.query("q");

    if (!q || q.trim() === "") {
      return c.json({ status: "error", message: "Missing or empty parameter" }, { status: 400 });
    }

    const rawFilters = parseQuery(q);

    if (Object.keys(rawFilters).length === 0) {
      return c.json({ status: "error", message: "Unable to interpret query" }, { status: 400 });
    }

    // Normalise before cache lookup so semantically identical queries share one cache entry
    const normalized = normalizeFilters(rawFilters as Record<string, unknown>);

    // Include pagination params from request in the cache key
    const page = c.req.query("page") || "1";
    const limit = c.req.query("limit") || "10";
    const cacheKey = filtersToCacheKey("search", { ...normalized, page, limit });

    const cached = getCached(cacheKey);
    if (cached) return c.json(cached);

    // getProfiles handles the DB query and its own cache write under "profiles:" prefix.
    // We store under "search:" prefix separately so search and direct filter results
    // don't collide, but both benefit from caching.
    const result = await getProfiles(c, rawFilters as Record<string, unknown>);
    return result;
  } catch (error: any) {
    console.error("Error in searchProfiles:", error);
    return c.json(
      { status: "error", message: "Internal server error", error: process.env.NODE_ENV === "development" ? error.message : undefined },
      { status: 500 }
    );
  }
}
