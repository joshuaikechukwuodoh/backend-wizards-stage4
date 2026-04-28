import type { Context, Next } from "hono";
import type { HonoEnv } from "../types";

export async function loggerMiddleware(c: Context<HonoEnv>, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;

  await next();

  const ms = Date.now() - start;
  const status = c.res.status;
  const user = c.get("user")?.username || "anonymous";
  console.log(`[${new Date().toISOString()}] ${method} ${path} ${status} ${ms}ms user=${user}`);
}
