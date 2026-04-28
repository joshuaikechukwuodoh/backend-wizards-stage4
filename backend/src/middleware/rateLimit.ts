import type { Context, Next } from "hono";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitRecord>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (now > val.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

export function rateLimitMiddleware(limit = 100, windowMs = 60_000) {
  return async (c: Context, next: Next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0].trim() ||
      c.req.header("cf-connecting-ip") ||
      "unknown";

    const now = Date.now();
    const record = store.get(ip);

    if (!record || now > record.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
    } else if (record.count >= limit) {
      c.header("X-RateLimit-Limit", String(limit));
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", String(Math.ceil(record.resetAt / 1000)));
      return c.json(
        { status: "error", message: "Rate limit exceeded. Try again later." },
        { status: 429 }
      );
    } else {
      record.count++;
      c.header("X-RateLimit-Limit", String(limit));
      c.header("X-RateLimit-Remaining", String(limit - record.count));
    }

    await next();
  };
}
