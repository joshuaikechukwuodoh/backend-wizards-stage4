import { parseQuery } from "../utils/parser";
import { getProfiles } from "./profiles";
import type { Context } from "hono";
import type { HonoEnv } from "../types";

export async function searchProfiles(c: Context<HonoEnv>) {
  try {
    const q = c.req.query("q");

    if (!q || q.trim() === "") {
      return c.json(
        { status: "error", message: "Missing or empty parameter" },
        { status: 400 }
      );
    }

    const filters = parseQuery(q);

    if (Object.keys(filters).length === 0) {
      return c.json(
        { status: "error", message: "Unable to interpret query" },
        { status: 400 }
      );
    }

    // Pass the parsed filters directly to getProfiles
    return getProfiles(c, filters);
  } catch (error: any) {
    console.error("Error in searchProfiles:", error);
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