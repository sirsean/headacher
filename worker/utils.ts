import type { EventItem, Headache } from "../src/types";
import type { Context } from "hono";
import { jwtVerify } from "jose";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
  "Access-Control-Expose-Headers": "Authorization",
  "Access-Control-Max-Age": "86400",
};

export function withCors(resp: Response): Response {
  // Clone the response to safely manipulate headers
  const r = new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: new Headers(resp.headers),
  });
  for (const [k, v] of Object.entries(corsHeaders)) {
    if (!r.headers.has(k)) {
      r.headers.set(k, v);
    }
  }
  return r;
}

export function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  const resp = new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
  return withCors(resp);
}

export function error(
  status: number,
  message: string,
  details?: unknown
): Response {
  return json(
    {
      error: {
        status,
        message,
        details: details ?? null,
      },
    },
    status
  );
}

// HttpError class to allow helpers to throw structured errors that routing can catch
export class HttpError extends Error {
  status: number;
  details?: unknown;
  response: Response;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
    // Build a response using the same JSON error shape and CORS headers
    this.response = error(status, message, details);
  }
}

export function parseNumber(
  q: string | null | undefined,
  def: number,
  min?: number,
  max?: number
): number {
  if (q == null || q === "") return def;
  const n = Number(q);
  if (!Number.isFinite(n)) return def;
  if (typeof min === "number" && n < min) return min;
  if (typeof max === "number" && n > max) return max;
  return n;
}

export function parseDate(q: string | null | undefined): Date | undefined {
  if (q == null || q === "") return undefined;
  const d = new Date(q);
  return isNaN(d.getTime()) ? undefined : d;
}

export function ok(): Response {
  return json({ ok: true }, 200);
}

// Shared validation helpers
export function validateTimestamp(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const d = new Date(s);
  if (isNaN(d.getTime())) return false;
  try {
    // Round-trip to ISO-8601 canonical representation
    const iso = d.toISOString();
    const d2 = new Date(iso);
    return !isNaN(d2.getTime());
  } catch {
    return false;
  }
}

export function toISO(s: string): string {
  return new Date(s).toISOString();
}

export function isInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n);
}

// Typed row mappers
interface DbRow {
  id?: number;
  timestamp: string;
  severity?: number;
  aura?: number;
  event_type?: string;
  value?: string;
  user_id?: string;
  // Nonce table fields
  nonce?: string;
  issued_at?: string;
  address?: string;
  // Identity table fields
  provider?: string;
  identifier?: string;
  email?: string;
  display_name?: string;
  created_at?: string;
}

export function mapHeadache(row: DbRow): Headache {
  return {
    id: row.id != null ? Number(row.id) : undefined,
    timestamp: String(row.timestamp),
    severity: Number(row.severity),
    aura: Number(row.aura) as 0 | 1,
    user_id: String(row.user_id),
  };
}

export function mapEvent(row: DbRow): EventItem {
  return {
    id: row.id != null ? Number(row.id) : undefined,
    timestamp: String(row.timestamp),
    event_type: String(row.event_type),
    value: String(row.value),
    user_id: String(row.user_id),
  };
}

// SQL helpers using parameterized statements
export async function dbAll<T>(
  db: D1Database,
  sql: string,
  binds: unknown[],
  map: (row: DbRow) => T
): Promise<T[]> {
  const { results } = await db.prepare(sql).bind(...binds).all();
  const rows = (results ?? []) as unknown as DbRow[];
  return rows.map(map);
}

export async function dbFirst<T>(
  db: D1Database,
  sql: string,
  binds: unknown[],
  map: (row: DbRow) => T
): Promise<T | null> {
  const row = await db.prepare(sql).bind(...binds).first();
  return row ? map(row as unknown as DbRow) : null;
}

export async function dbRun(
  db: D1Database,
  sql: string,
  binds: unknown[]
): Promise<D1Result> {
  return db.prepare(sql).bind(...binds).run();
}

// JWT Secret Key cache
let jwtSecretKey: CryptoKey | null = null;

export async function getJwtSecretKey(env: Env): Promise<CryptoKey> {
  if (!jwtSecretKey) {
    const secretBytes = new TextEncoder().encode(env.JWT_SECRET_KEY);
    jwtSecretKey = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
  }
  return jwtSecretKey;
}

// Helper function to require authentication - works with Hono Context
// Sets 'addr' in context for downstream handlers to retrieve with c.get('addr')
export async function requireAuth<T extends { Bindings: Env; Variables: { addr: string; userId: string } }>(c: Context<T>): Promise<void> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing or invalid authorization header");
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix
  try {
    const secretKey = await getJwtSecretKey(c.env);
    const { payload } = await jwtVerify(token, secretKey);
    const userId = payload.sub as string | undefined;
    if (!userId) {
      throw new HttpError(401, "Invalid token: missing subject");
    }
    // Back-compat: allow optional addr claim for legacy flows
    const addr = (payload as any).siwe_address as string | undefined;
    c.set('userId', userId);
    if (addr) c.set('addr', addr);
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
}

// Middleware function for Hono that handles authentication
// Usage: app.use('/protected/*', requireAuthentication);
export const requireAuthentication = async (
  c: Context<{ Bindings: Env; Variables: { addr: string; userId: string } }>,
  next: () => Promise<void>
) => {
  await requireAuth(c); // sets 'userId' (and optionally 'addr') in context, throws HttpError 401 on failure
  await next();
};

