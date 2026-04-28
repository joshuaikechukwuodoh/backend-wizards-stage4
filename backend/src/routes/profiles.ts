import { db } from "../db";
import { profiles } from "../db/schema";
import { eq, and, gte, lte, asc, desc, sql } from "drizzle-orm";
import type { Context } from "hono";
import type { HonoEnv } from "../types";

export async function getProfiles(c: Context<HonoEnv>, filters?: any) {
  try {
    // Merge filters (from NLP) with query params (page, limit, etc)
    const q = { ...c.req.query(), ...filters };

    // Strict validation for numeric parameters
    const numericParams = ["min_age", "max_age", "min_gender_probability", "min_country_probability", "page", "limit"];
    for (const param of numericParams) {
      if (q[param] !== undefined && q[param] !== "" && isNaN(Number(q[param]))) {
        return c.json(
          { status: "error", message: "Invalid query parameters" },
          { status: 400 }
        );
      }
    }

    // Validate sort_by and order
    const validSortBy = ["age", "created_at", "gender_probability"];
    if (q.sort_by && !validSortBy.includes(q.sort_by)) {
      return c.json(
        { status: "error", message: "Invalid query parameters" },
        { status: 400 }
      );
    }

    if (q.order && !["asc", "desc"].includes(q.order.toLowerCase())) {
      return c.json(
        { status: "error", message: "Invalid query parameters" },
        { status: 400 }
      );
    }

    let conditions = [];

    if (q.gender) {
      conditions.push(eq(profiles.gender, q.gender));
    }

    if (q.age_group) {
      conditions.push(eq(profiles.age_group, q.age_group));
    }

    if (q.country_id) {
      conditions.push(eq(profiles.country_id, q.country_id));
    }

    if (q.min_age) {
      conditions.push(gte(profiles.age, Number(q.min_age)));
    }

    if (q.max_age) {
      conditions.push(lte(profiles.age, Number(q.max_age)));
    }

    if (q.min_gender_probability) {
      conditions.push(
        gte(profiles.gender_probability, Number(q.min_gender_probability))
      );
    }

    if (q.min_country_probability) {
      conditions.push(
        gte(profiles.country_probability, Number(q.min_country_probability))
      );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    // sorting
    const sortBy = q.sort_by || "created_at";
    const order = q.order === "asc" ? asc : desc;

    const columnMap = {
      age: profiles.age,
      created_at: profiles.created_at,
      gender_probability: profiles.gender_probability,
      country_probability: profiles.country_probability
    };

    const orderBy =
      columnMap[sortBy as keyof typeof columnMap] || profiles.created_at;

    // pagination
    let page = Number(q.page || 1);
    if (page < 1) page = 1;
    
    let limit = Number(q.limit || 10);
    if (limit < 1) limit = 10;
    limit = Math.min(limit, 50);

    const offset = (page - 1) * limit;

    const data = await db
      .select()
      .from(profiles)
      .where(whereClause)
      .orderBy(order(orderBy))
      .limit(limit)
      .offset(offset);

    // Filtered total count
    const totalResult = await db
      .select({ count: sql<string>`count(*)` })
      .from(profiles)
      .where(whereClause);
    const totalCount = Number(totalResult[0]?.count ?? 0);

    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return c.json({
      status: "success",
      metadata: {
        page: Number(page),
        limit: Number(limit),
        total_count: totalCount,
        total_pages: totalPages,
        has_more: hasMore,
      },
      data: data
    });
  } catch (error: any) {
    console.error("Error fetching profiles:", error);
    return c.json(
      {
        status: "error",
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      },
      { status: 500 }
    );
  }
}