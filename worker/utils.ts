import type { EventItem, Headache } from "../src/types";

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
export function mapHeadache(row: any): Headache {
  return {
    id: row.id != null ? Number(row.id) : undefined,
    timestamp: String(row.timestamp),
    severity: Number(row.severity),
    aura: Number(row.aura) as 0 | 1,
  };
}

export function mapEvent(row: any): EventItem {
  return {
    id: row.id != null ? Number(row.id) : undefined,
    timestamp: String(row.timestamp),
    event_type: String(row.event_type),
    value: String(row.value),
  };
}

// SQL helpers using parameterized statements
export async function dbAll<T>(
  db: D1Database,
  sql: string,
  binds: any[],
  map: (row: any) => T
): Promise<T[]> {
  const { results } = await db.prepare(sql).bind(...binds).all();
  const rows = (results ?? []) as any[];
  return rows.map(map);
}

export async function dbFirst<T>(
  db: D1Database,
  sql: string,
  binds: any[],
  map: (row: any) => T
): Promise<T | null> {
  const row = await db.prepare(sql).bind(...binds).first();
  return row ? map(row) : null;
}

export async function dbRun(
  db: D1Database,
  sql: string,
  binds: any[]
): Promise<D1Result> {
  return db.prepare(sql).bind(...binds).run();
}

