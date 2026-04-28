import { verifyToken } from "../auth/jwt";
import type { Context, Next } from "hono";
import type { HonoEnv } from "../types";

export async function authMiddleware(c: Context<HonoEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ status: "error", message: "Unauthorized: missing or invalid Authorization header" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);

  if (!payload || payload.type !== "access") {
    return c.json({ status: "error", message: "Unauthorized: invalid or expired token" }, { status: 401 });
  }

  c.set("user", payload);
  await next();
}
