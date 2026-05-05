import { db } from "../db";
import { profiles } from "../db/schema";
import { eq, and, gte, lte, asc, desc, sql } from "drizzle-orm";
import type { Context } from "hono";
import type { HonoEnv } from "../types";
import { getCached, setCached } from "../middleware/cache";
import { filtersToCacheKey, normalizeFilters } from "../utils/parser";

export async function getProfiles(c: Context<HonoEnv>, filters?: Record<string, unknown>) {
  try {
    const q: Record<string, unknown> = { ...c.req.query(), ...filters };

    // Validate numeric params
    const numericParams = ["min_age", "max_age", "min_gender_probability", "min_country_probability", "page", "limit"];
    for (const param of numericParams) {
      if (q[param] !== undefined && q[param] !== "" && isNaN(Number(q[param]))) {
        return c.json({ status: "error", message: "Invalid query parameters" }, { status: 400 });
      }
    }

    const validSortBy = ["age", "created_at", "gender_probability"];
    if (q.sort_by && !validSortBy.includes(String(q.sort_by))) {
      return c.json({ status: "error", message: "Invalid query parameters" }, { status: 400 });
    }

    if (q.order && !["asc", "desc"].includes(String(q.order).toLowerCase())) {
      return c.json({ status: "error", message: "Invalid query parameters" }, { status: 400 });
    }

    // Normalise filter params and build cache key
    const filterParams: Record<string, unknown> = {};
    const filterKeys = ["gender", "age_group", "country_id", "min_age", "max_age", "min_gender_probability", "min_country_probability"];
    const sortKeys = ["sort_by", "order", "page", "limit"];
    
    for (const k of filterKeys) {
      if (q[k] !== undefined && q[k] !== "") filterParams[k] = q[k];
    }
    
    const normalizedFilters = normalizeFilters(filterParams);
    
    // Cache key for the data (includes sort/pagination)
    const dataParams = { ...normalizedFilters };
    for (const k of sortKeys) {
      if (q[k] !== undefined && q[k] !== "") dataParams[k] = q[k];
    }
    const dataCacheKey = filtersToCacheKey("profiles:data", dataParams);

    // Cache key for the total count (only filters matter)
    const countCacheKey = filtersToCacheKey("profiles:count", normalizedFilters);

    const cachedData = getCached(dataCacheKey);
    if (cachedData) return c.json(cachedData);

    // Build WHERE conditions
    let conditions = [];
    if (normalizedFilters.gender) conditions.push(eq(profiles.gender, String(normalizedFilters.gender)));
    if (normalizedFilters.age_group) conditions.push(eq(profiles.age_group, String(normalizedFilters.age_group)));
    if (normalizedFilters.country_id) conditions.push(eq(profiles.country_id, String(normalizedFilters.country_id).toUpperCase()));
    if (normalizedFilters.min_age) conditions.push(gte(profiles.age, Number(normalizedFilters.min_age)));
    if (normalizedFilters.max_age) conditions.push(lte(profiles.age, Number(normalizedFilters.max_age)));
    if (normalizedFilters.min_gender_probability) conditions.push(gte(profiles.gender_probability, Number(normalizedFilters.min_gender_probability)));
    if (normalizedFilters.min_country_probability) conditions.push(gte(profiles.country_probability, Number(normalizedFilters.min_country_probability)));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const sortBy = String(q.sort_by || "created_at");
    const order = String(q.order || "desc") === "asc" ? asc : desc;
    const columnMap: Record<string, any> = {
      age: profiles.age,
      created_at: profiles.created_at,
      gender_probability: profiles.gender_probability,
      country_probability: profiles.country_probability,
    };
    const orderBy = columnMap[sortBy] || profiles.created_at;

    let page = Number(q.page || 1);
    if (page < 1) page = 1;
    let limit = Math.min(Number(q.limit || 10), 50);
    if (limit < 1) limit = 10;
    const offset = (page - 1) * limit;

    // Execute data query and count query (potentially cached)
    const [data, totalCount] = await Promise.all([
      db.select().from(profiles).where(whereClause).orderBy(order(orderBy)).limit(limit).offset(offset),
      (async () => {
        const cachedCount = getCached(countCacheKey);
        if (cachedCount !== null) return Number(cachedCount);
        
        const countResult = await db.select({ count: sql<string>`count(*)` }).from(profiles).where(whereClause);
        const count = Number(countResult[0]?.count ?? 0);
        setCached(countCacheKey, count);
        return count;
      })()
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    const response = {
      status: "success",
      metadata: {
        page,
        limit,
        total_count: totalCount,
        total_pages: totalPages,
        has_more: page < totalPages,
      },
      data,
    };

    setCached(dataCacheKey, response);
    return c.json(response);
  } catch (error: any) {
    console.error("Error fetching profiles:", error);
    return c.json(
      { status: "error", message: "Internal server error", error: process.env.NODE_ENV === "development" ? error.message : undefined },
      { status: 500 }
    );
  }
}
