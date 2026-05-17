import { SignJWT, jwtVerify } from "jose";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

/** Scopes we request at authorize time (space-separated for OAuth). */
export const GOOGLE_HEALTH_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "openid",
  "email",
].join(" ");

/** Required on the access token for daily-heart-rate-variability list calls. */
export const REQUIRED_HRV_API_SCOPE =
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly";

export function parseScopeString(scope: string | undefined): string[] {
  return (scope ?? "").split(/\s+/).filter(Boolean);
}

export function missingHrvApiScopes(grantedScopes: string[]): string[] {
  if (grantedScopes.includes(REQUIRED_HRV_API_SCOPE)) return [];
  return [REQUIRED_HRV_API_SCOPE];
}

export type GoogleTokenInfo = {
  scope?: string;
  expires_in?: string;
  email?: string;
  error?: string;
  error_description?: string;
};

/** Introspect an access token (useful when debugging scope errors in dev). */
export async function fetchGoogleTokenInfo(accessToken: string): Promise<GoogleTokenInfo> {
  const u = new URL("https://oauth2.googleapis.com/tokeninfo");
  u.searchParams.set("access_token", accessToken);
  const res = await fetch(u.toString());
  return (await res.json()) as GoogleTokenInfo;
}

type TokenEndpointResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  /** Space-separated list of scopes granted to this access token. */
  scope?: string;
  error?: string;
  error_description?: string;
};

export interface GoogleOauthEnv {
  JWT_SECRET_KEY: string;
  GOOGLE_HEALTH_PROJECT_ID: string;
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;
  GOOGLE_OAUTH_REDIRECT_URI: string;
}

function randomUrlSafeString(byteLen: number): string {
  const a = new Uint8Array(byteLen);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomUrlSafeString(32);
  const challenge = await sha256Base64Url(verifier);
  return { verifier, challenge };
}

export async function signOAuthState(env: GoogleOauthEnv, userId: string, codeVerifier: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.JWT_SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return await new SignJWT({ cv: codeVerifier })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(key);
}

export async function verifyOAuthState(
  env: GoogleOauthEnv,
  state: string,
): Promise<{ userId: string; codeVerifier: string }> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.JWT_SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const { payload } = await jwtVerify(state, key);
  const userId = typeof payload.sub === "string" ? payload.sub : "";
  const cv = typeof payload.cv === "string" ? payload.cv : "";
  if (!userId || !cv) throw new Error("Invalid state");
  return { userId, codeVerifier: cv };
}

export function buildAuthorizeUrl(
  env: GoogleOauthEnv,
  state: string,
  codeChallenge: string,
): { authorizeUrl: string } {
  const u = new URL(GOOGLE_AUTH);
  u.searchParams.set("client_id", env.GOOGLE_OAUTH_CLIENT_ID);
  u.searchParams.set("redirect_uri", env.GOOGLE_OAUTH_REDIRECT_URI);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", GOOGLE_HEALTH_SCOPES);
  u.searchParams.set("state", state);
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("code_challenge", codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return { authorizeUrl: u.toString() };
}

export async function exchangeAuthorizationCode(
  env: GoogleOauthEnv,
  code: string,
  codeVerifier: string,
): Promise<TokenEndpointResponse> {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as TokenEndpointResponse;
  if (!res.ok) {
    throw new Error(json.error_description || json.error || `token_exchange_failed_${res.status}`);
  }
  return json;
}

export async function refreshAccessToken(env: GoogleOauthEnv, refreshToken: string): Promise<TokenEndpointResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as TokenEndpointResponse;
  if (!res.ok) {
    throw new Error(json.error_description || json.error || `token_refresh_failed_${res.status}`);
  }
  return json;
}

export function parseIdTokenEmail(idToken: string | undefined): { email: string; emailVerified: boolean } | null {
  if (!idToken || typeof idToken !== "string") return null;
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  try {
    const pad = parts[1].length % 4 === 0 ? "" : "=".repeat(4 - (parts[1].length % 4));
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/") + pad;
    const json = JSON.parse(atob(b64)) as { email?: string; email_verified?: boolean };
    if (typeof json.email !== "string" || !json.email) return null;
    return { email: json.email, emailVerified: Boolean(json.email_verified) };
  } catch {
    return null;
  }
}
