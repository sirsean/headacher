// worker/services/firebase-auth.ts
// Firebase ID token verification for Cloudflare Workers without Admin SDK
// References:
// - Verify ID tokens: https://firebase.google.com/docs/auth/admin/verify-id-tokens
// - JWKS: https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com
// We validate using jose and the Workers Web Crypto; we cache keys for performance.

import { jwtVerify, importX509, JWTPayload } from "jose";
import { HttpError } from "../utils";

const GOOGLE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedCerts: { keys: Record<string, CryptoKey>; expiresAt: number } | null = null;

async function fetchGoogleCerts(): Promise<Record<string, CryptoKey>> {
  const now = Date.now();
  if (cachedCerts && now < cachedCerts.expiresAt) {
    return cachedCerts.keys;
  }

  const res = await fetch(GOOGLE_CERTS_URL, { method: "GET" });
  if (!res.ok) throw new Error(`Failed to fetch Google certs: ${res.status}`);
  const json = await res.json() as Record<string, string>;

  const keys: Record<string, CryptoKey> = {};
  for (const [kid, pem] of Object.entries(json)) {
    // Convert PEM to CryptoKey (RSA)
    const key = await importX509(pem, "RS256");
    keys[kid] = key;
  }

  // Cache for 1 hour by default (Google sets Cache-Control headers; we pick a safe TTL)
  cachedCerts = { keys, expiresAt: now + 55 * 60 * 1000 };
  return keys;
}

export interface FirebaseUserInfo {
  uid: string;
  email?: string;
  name?: string;
}

export async function verifyFirebaseIdToken(idToken: string, projectId: string): Promise<FirebaseUserInfo> {
  // 1) Decode header to get kid
  const headerSeg = idToken.split(".")[0];
  if (!headerSeg) throw new HttpError(401, "Invalid Firebase ID token");
  const header = JSON.parse(atob(headerSeg)) as { kid?: string };
  const kid = header.kid;
  if (!kid) throw new HttpError(401, "Firebase token missing key id");

  // 2) Get certs and pick key by kid
  const keys = await fetchGoogleCerts();
  const key = keys[kid];
  if (!key) throw new HttpError(401, "Unknown Firebase token key id");

  // 3) Verify
  let payload: JWTPayload;
  try {
    const verifyRes = await jwtVerify(idToken, key, {
      algorithms: ["RS256"],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    payload = verifyRes.payload;
  } catch (e) {
    throw new HttpError(401, "Invalid Firebase ID token");
  }

  const uid = String(payload.sub || "");
  if (!uid) throw new HttpError(401, "Firebase token missing subject");

  const email = (payload as any).email as string | undefined;
  const name = (payload as any).name as string | undefined;

  return { uid, email, name };
}
