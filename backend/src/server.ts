import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";
import { getProfiles } from "./routes/profiles";
import { searchProfiles } from "./routes/search";
import { exportProfiles } from "./routes/export";
import authRouter from "./routes/auth";
import { authMiddleware } from "./middleware/auth";
import { requireRole } from "./middleware/rbac";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { loggerMiddleware } from "./middleware/logger";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";
import type { HonoEnv } from "./types";

const app = new Hono<HonoEnv>();

// 1. Global middleware
app.use("*", cors({
  origin: "*",
  allowHeaders: ["Authorization", "Content-Type", "X-CSRF-Token"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));
app.use("*", loggerMiddleware);

// 2. Rate limiting - apply to auth first
app.use("/auth/*", rateLimitMiddleware(20, 60_000));
app.use("/api/v1/auth/*", rateLimitMiddleware(10, 60_000));
app.use("/api/*", rateLimitMiddleware(100, 60_000));

// 3. Static/Public routes
app.get("/favicon.ico", (c) => c.body(null, 204));
app.get("/", (c) => c.json({
  status: "success",
  message: "Insighta Labs+ API",
  version: "1.0.0"
}));

// 4. Auth routes (unprotected)
app.route("/auth", authRouter);
app.route("/api/v1/auth", authRouter);

// 5. Protected API routes
// Ensure all /api and /api/v1/profiles are protected
app.use("/api/*", async (c, next) => {
  // Skip auth for public auth routes if they are under /api
  if (c.req.path.includes("/auth/")) return await next();
  return authMiddleware(c, next);
});

// Explicitly handle all methods for /api/profiles to ensure 401 is returned if unauth
// (middleware handles auth, these handlers just provide the successful response if auth passes)
app.get("/api/profiles", (c) => getProfiles(c));
app.all("/api/profiles", (c) => {
  if (c.req.method === "GET") return getProfiles(c);
  return c.json({ status: "error", message: "Method not allowed" }, 405);
});

// User Management
app.get("/api/users/me", async (c) => {
  const user = c.get("user");
  const userRows = await db.select().from(users).where(eq(users.id, user.sub));
  const userData = userRows[0];
  if (!userData) return c.json({ status: "error", message: "User not found" }, 404);

  return c.json({
    status: "success",
    user: {
      id: userData.id,
      username: userData.github_username,
      email: userData.github_email || null,
      avatar: userData.github_avatar || null,
      role: userData.role,
    },
  });
});

// Profiles
app.get("/api/v1/profiles", (c) => getProfiles(c));
app.get("/api/v1/profiles/search", (c) => searchProfiles(c));
app.get("/api/v1/profiles/export", requireRole("admin"), (c) => exportProfiles(c));

// Backward-compat Stage 2 routes
app.get("/api/profiles/search", (c) => searchProfiles(c));

// Export for Bun
export default {
  port: 3000,
  fetch: app.fetch,
};

// Export for Vercel (Node.js)
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
