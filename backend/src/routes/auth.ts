import { Hono, type Context } from "hono";
import { setCookie } from "hono/cookie";
import type { HonoEnv } from "../types";
import { generateCodeVerifier, generateCodeChallenge } from "../auth/pkce";
import { getGitHubAuthURL, exchangeCodeForToken, getGitHubUser, getGitHubEmails } from "../auth/github";
import { signAccessToken, verifyToken } from "../auth/jwt";
import { db } from "../db";
import { users, sessions } from "../db/schema";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

// Temporary in-memory state store (verifier keyed by random state)
const stateStore = new Map<string, { verifier: string; redirectTo: string; createdAt: number }>();

// Clean up states older than 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of stateStore.entries()) {
    if (now - val.createdAt > 10 * 60 * 1000) stateStore.delete(key);
  }
}, 5 * 60 * 1000);

const authRouter = new Hono<HonoEnv>();

// GET /api/v1/auth/github — initiate GitHub OAuth with PKCE
authRouter.get("/github", async (c: Context<HonoEnv>) => {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateCodeVerifier(); // random state token
  const redirectTo = c.req.query("redirect_to") || "";

  stateStore.set(state, { verifier, redirectTo, createdAt: Date.now() });

  const url = getGitHubAuthURL(challenge, state);
  return c.redirect(url);
});

// GET /api/v1/auth/callback — handle GitHub OAuth callback
authRouter.get("/callback", async (c: Context<HonoEnv>) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    return c.json({ status: "error", message: `GitHub error: ${error}` }, { status: 400 });
  }

  if (!code || !state) {
    return c.json({ status: "error", message: "Missing code or state parameter" }, { status: 400 });
  }

  const stateData = stateStore.get(state);
  if (!stateData) {
    return c.json({ status: "error", message: "Invalid or expired state" }, { status: 400 });
  }
  stateStore.delete(state);

  try {
    const githubToken = await exchangeCodeForToken(code, stateData.verifier);
    const githubUser = (await getGitHubUser(githubToken)) as {
      id: number;
      login: string;
      email: string | null;
      avatar_url: string;
    };

    // Get primary email if not public
    let email = githubUser.email;
    if (!email) {
      const emails = (await getGitHubEmails(githubToken)) as any[];
      const primary = emails.find((e) => e.primary);
      email = primary?.email || null;
    }

    // Find or create user
    const existing = await db.select().from(users).where(eq(users.github_id, String(githubUser.id)));
    let user = existing[0];

    if (!user) {
      const allUsers = await db.select().from(users);
      const role = allUsers.length === 0 ? "admin" : "analyst";
      const [newUser] = await db.insert(users).values({
        id: uuidv7(),
        github_id: String(githubUser.id),
        github_username: githubUser.login,
        github_email: email,
        github_avatar: githubUser.avatar_url,
        role,
      }).returning();
      user = newUser;
    } else {
      await db.update(users).set({
        github_username: githubUser.login,
        github_email: email,
        github_avatar: githubUser.avatar_url,
      }).where(eq(users.id, user.id));
    }

    if (!user) {
      return c.json({ status: "error", message: "Authentication failed: User record missing" }, { status: 500 });
    }

    // Issue tokens
    const tokenPayload = { sub: user.id, username: user.github_username, role: user.role };
    const accessToken = await signAccessToken(tokenPayload);
    const refreshTokenStr = generateCodeVerifier(); // opaque random string

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(sessions).values({
      id: uuidv7(),
      user_id: user.id,
      refresh_token: refreshTokenStr,
      expires_at: expiresAt,
    });

    // Web portal / CLI redirect
    if (stateData.redirectTo) {
      let redirectUrl: URL;
      try {
        redirectUrl = new URL(stateData.redirectTo);
      } catch {
        // Fallback for relative paths
        const host = c.req.header("host") || "localhost:3000";
        const protocol = host.startsWith("localhost") ? "http" : "https";
        redirectUrl = new URL(stateData.redirectTo, `${protocol}://${host}`);
      }

      redirectUrl.searchParams.set("access_token", accessToken);
      redirectUrl.searchParams.set("refresh_token", refreshTokenStr);
      redirectUrl.searchParams.set("user", JSON.stringify({
        id: user.id,
        username: user.github_username,
        role: user.role
      }));

      // Still set cookies for the web portal
      setCookie(c, "access_token", accessToken, { httpOnly: true, path: "/", maxAge: 900, sameSite: "Lax" });
      setCookie(c, "refresh_token", refreshTokenStr, { httpOnly: true, path: "/", maxAge: 604800, sameSite: "Lax" });
      
      return c.redirect(redirectUrl.toString());
    }

    // CLI / API response
    return c.json({
      status: "success",
      access_token: accessToken,
      refresh_token: refreshTokenStr,
      expires_in: 900,
      token_type: "Bearer",
      user: {
        id: user.id,
        username: user.github_username,
        email: user.github_email || null,
        avatar: user.github_avatar || null,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error("OAuth callback error:", err);
    return c.json({ status: "error", message: "Authentication failed", detail: err.message }, { status: 500 });
  }
});

// POST /api/v1/auth/refresh
authRouter.post("/refresh", async (c: Context<HonoEnv>) => {
  const body = await c.req.json().catch(() => ({})) as any;
  const refreshToken = body.refresh_token;

  if (!refreshToken) {
    return c.json({ status: "error", message: "refresh_token is required" }, { status: 400 });
  }

  const sessionRows = await db.select().from(sessions).where(eq(sessions.refresh_token, refreshToken));
  const session = sessionRows[0];

  if (!session || session.expires_at < new Date()) {
    return c.json({ status: "error", message: "Invalid or expired refresh token" }, { status: 401 });
  }

  const userRows = await db.select().from(users).where(eq(users.id, session.user_id));
  const user = userRows[0];
  if (!user) return c.json({ status: "error", message: "User not found" }, { status: 401 });

  const accessToken = await signAccessToken({
    sub: user.id,
    username: user.github_username,
    role: user.role,
  });

  return c.json({ status: "success", access_token: accessToken, expires_in: 900, token_type: "Bearer" });
});

// POST /api/v1/auth/logout
authRouter.post("/logout", async (c: Context<HonoEnv>) => {
  const body = await c.req.json().catch(() => ({})) as any;
  const refreshToken = body.refresh_token;
  if (refreshToken) {
    await db.delete(sessions).where(eq(sessions.refresh_token, refreshToken));
  }
  return c.json({ status: "success", message: "Logged out successfully" });
});

// GET /api/v1/auth/me
authRouter.get("/me", async (c: Context<HonoEnv>) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyToken(authHeader.slice(7));
  if (!payload || payload.type !== "access") {
    return c.json({ status: "error", message: "Invalid or expired token" }, { status: 401 });
  }

  const userRows = await db.select().from(users).where(eq(users.id, payload.sub));
  const user = userRows[0];
  if (!user) return c.json({ status: "error", message: "User not found" }, { status: 404 });

  return c.json({
    status: "success",
    user: {
      id: user.id,
      username: user.github_username,
      email: user.github_email || null,
      avatar: user.github_avatar || null,
      role: user.role,
    },
  });
});

export default authRouter;
