import type { Context, Next } from "hono";
import type { HonoEnv } from "../types";

export function requireRole(...roles: string[]) {
  return async (c: Context<HonoEnv>, next: Next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }
    if (!roles.includes(user.role)) {
      return c.json(
        { status: "error", message: `Forbidden: requires role ${roles.join(" or ")}` },
        { status: 403 }
      );
    }
    await next();
  };
}
