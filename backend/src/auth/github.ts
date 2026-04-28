export function getGitHubAuthURL(codeChallenge: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: process.env.GITHUB_CALLBACK_URL!,
    scope: "read:user user:email",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    client_secret: process.env.GITHUB_CLIENT_SECRET!,
    code,
    redirect_uri: process.env.GITHUB_CALLBACK_URL!,
    code_verifier: codeVerifier,
  });

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const data = await res.json() as any;
  if (data.error) throw new Error(data.error_description || data.error);
  return data.access_token;
}

export async function getGitHubUser(accessToken: string): Promise<any> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Insighta-Labs-Plus",
    },
  });
  return res.json();
}

export async function getGitHubEmails(accessToken: string): Promise<any[]> {
  const res = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Insighta-Labs-Plus",
    },
  });
  return res.json() as any;
}
