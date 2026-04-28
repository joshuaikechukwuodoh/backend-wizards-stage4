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
import type { HonoEnv } from "./types";

const app = new Hono<HonoEnv>();

// Global middleware
app.use("*", cors({
  origin: "*",
  allowHeaders: ["Authorization", "Content-Type", "X-CSRF-Token"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));
app.use("*", loggerMiddleware);
app.use("*", rateLimitMiddleware(100, 60_000));

// Ignore favicon and logo requests to keep logs clean
app.get("/favicon.ico", (c) => c.body(null, 204));
app.get("/favicon.png", (c) => c.body(null, 204));
app.get("/logo.png", (c) => c.body(null, 204));

// Root
app.get("/", (c) => c.json({
  status: "success",
  message: "Insighta Labs+ API",
  version: "1.0.0",
  docs: {
    auth: "/api/v1/auth/github",
    profiles: "/api/v1/profiles",
    search: "/api/v1/profiles/search",
    export: "/api/v1/profiles/export (admin only)",
  },
}));

// ── Auth routes (public) ──────────────────────────────────────────────────────
app.route("/api/v1/auth", authRouter);

// ── v1 Protected profile routes ───────────────────────────────────────────────
app.use("/api/v1/profiles", authMiddleware);
app.use("/api/v1/profiles/*", authMiddleware);
app.get("/api/v1/profiles", (c) => getProfiles(c));
app.get("/api/v1/profiles/search", (c) => searchProfiles(c));
app.get("/api/v1/profiles/export", requireRole("admin"), (c) => exportProfiles(c));

// ── Backward-compat Stage 2 routes (unprotected) ─────────────────────────────
app.get("/api/profiles", (c) => getProfiles(c));
app.get("/api/profiles/search", (c) => searchProfiles(c));

// ── Export for Bun ────────────────────────────────────────────────────────────
export default {
  port: 3000,
  fetch: app.fetch,
};

// ── Export for Vercel (Node.js) ───────────────────────────────────────────────
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
