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
    const filterKeys = ["gender", "age_group", "country_id", "min_age", "max_age", "min_gender_probability", "min_country_probability", "sort_by", "order", "page", "limit"];
    for (const k of filterKeys) {
      if (q[k] !== undefined && q[k] !== "") filterParams[k] = q[k];
    }
    const normalized = normalizeFilters(filterParams);
    const cacheKey = filtersToCacheKey("profiles", normalized);

    const cached = getCached(cacheKey);
    if (cached) return c.json(cached);

    // Build WHERE conditions
    let conditions = [];
    if (normalized.gender) conditions.push(eq(profiles.gender, String(normalized.gender)));
    if (normalized.age_group) conditions.push(eq(profiles.age_group, String(normalized.age_group)));
    if (normalized.country_id) conditions.push(eq(profiles.country_id, String(normalized.country_id).toUpperCase()));
    if (normalized.min_age) conditions.push(gte(profiles.age, Number(normalized.min_age)));
    if (normalized.max_age) conditions.push(lte(profiles.age, Number(normalized.max_age)));
    if (normalized.min_gender_probability) conditions.push(gte(profiles.gender_probability, Number(normalized.min_gender_probability)));
    if (normalized.min_country_probability) conditions.push(gte(profiles.country_probability, Number(normalized.min_country_probability)));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const sortBy = String(normalized.sort_by || "created_at");
    const order = String(normalized.order || "desc") === "asc" ? asc : desc;
    const columnMap: Record<string, any> = {
      age: profiles.age,
      created_at: profiles.created_at,
      gender_probability: profiles.gender_probability,
      country_probability: profiles.country_probability,
    };
    const orderBy = columnMap[sortBy] || profiles.created_at;

    let page = Number(normalized.page || 1);
    if (page < 1) page = 1;
    let limit = Math.min(Number(normalized.limit || 10), 50);
    if (limit < 1) limit = 10;
    const offset = (page - 1) * limit;

    const [data, totalResult] = await Promise.all([
      db.select().from(profiles).where(whereClause).orderBy(order(orderBy)).limit(limit).offset(offset),
      db.select({ count: sql<string>`count(*)` }).from(profiles).where(whereClause),
    ]);

    const totalCount = Number(totalResult[0]?.count ?? 0);
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

    setCached(cacheKey, response);
    return c.json(response);
  } catch (error: any) {
    console.error("Error fetching profiles:", error);
    return c.json(
      { status: "error", message: "Internal server error", error: process.env.NODE_ENV === "development" ? error.message : undefined },
      { status: 500 }
    );
  }
}
