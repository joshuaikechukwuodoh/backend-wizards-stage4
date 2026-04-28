import { db } from "../db";
import { profiles } from "../db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { Context } from "hono";
import type { HonoEnv } from "../types";

export async function exportProfiles(c: Context<HonoEnv>) {
  try {
    const data = await db.select().from(profiles).orderBy(profiles.name);

    const headers = [
      "id",
      "name",
      "gender",
      "gender_probability",
      "age",
      "age_group",
      "country_id",
      "country_name",
      "country_probability",
      "created_at",
    ];

    const escape = (val: any) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    const rows = data.map((p) =>
      [
        escape(p.id),
        escape(p.name),
        escape(p.gender),
        escape(p.gender_probability),
        escape(p.age),
        escape(p.age_group),
        escape(p.country_id),
        escape(p.country_name),
        escape(p.country_probability),
        escape(p.created_at?.toISOString()),
      ].join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const filename = `insighta-profiles-${new Date().toISOString().split("T")[0]}.csv`;

    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    return c.body(csv);
  } catch (error: any) {
    console.error("Export error:", error);
    return c.json({ status: "error", message: "Export failed" }, { status: 500 });
  }
}
