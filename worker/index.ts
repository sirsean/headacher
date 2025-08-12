import { json, ok, withCors, error, validateTimestamp, isInt, toISO, dbAll, dbFirst, dbRun, mapHeadache, mapEvent, HttpError } from "./utils";
import type { EventItem, Headache } from "../src/types";
import { generateNonce, SiweMessage } from "siwe";
import { SignJWT, jwtVerify } from "jose";

// Convert JWT_SECRET string to CryptoKey for use with jose
let jwtSecretKey: CryptoKey | null = null;

async function getJwtSecretKey(env: Env): Promise<CryptoKey> {
	if (!jwtSecretKey) {
		const secretBytes = new TextEncoder().encode(env.JWT_SECRET);
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

type Handler = (
  request: Request,
  env: Env,
  match: URLPatternResult,
  addr?: string
) => Response | Promise<Response>;

// Higher-order handler to wrap authenticated routes
const requireAuthentication = (h: Handler): Handler => async (req, env, match) => {
  const addr = await requireAuth(req, env); // throws HttpError 401 on failure
  return h(req, env, match, addr);
};

async function readJson<T = any>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

// Helper function to require authentication
async function requireAuth(request: Request, env: Env): Promise<string> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing or invalid authorization header");
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix
  try {
    const secretKey = await getJwtSecretKey(env);
    const { payload } = await jwtVerify(token, secretKey);
    const address = payload.sub;
    if (!address) {
      throw new HttpError(401, "Invalid token: missing subject");
    }
    return address;
  } catch (err) {
    throw new HttpError(401, "Invalid or expired token");
  }
}

const routes: { pattern: URLPattern; methods: string[]; handler: Handler }[] = [
  // Health check
  {
    pattern: new URLPattern({ pathname: "/api/health" }),
    methods: ["GET"],
    handler: async () => ok(),
  },
  // Auth: Generate nonce
  {
    pattern: new URLPattern({ pathname: "/api/auth/nonce" }),
    methods: ["GET"],
    handler: async (request, env) => {
      const url = new URL(request.url);
      const address = url.searchParams.get("address");
      if (!address) {
        return error(400, "Missing address parameter");
      }

      // Generate a unique nonce
      const nonce = generateNonce();
      const now = new Date().toISOString();

      // Upsert nonce into database
      await dbRun(
        env.DB,
        "INSERT OR REPLACE INTO nonces (address, nonce, issued_at) VALUES (?, ?, ?)",
        [address, nonce, now]
      );

      return json({ nonce });
    },
  },
  // Auth: Verify SIWE signature
  {
    pattern: new URLPattern({ pathname: "/api/auth/verify" }),
    methods: ["POST"],
    handler: async (request, env) => {
      const body = await readJson<{ message: string; signature: string }>(request);
      if (!body || !body.message || !body.signature) {
        return error(400, "Missing message or signature");
      }

      try {
        // Parse and validate the SIWE message from prepared string
        const siweMessage = new SiweMessage(body.message);
        const address = siweMessage.address;

        // Fetch stored nonce for this address
        const storedNonce = await dbFirst<{ nonce: string; issued_at: string }>(
          env.DB,
          "SELECT nonce, issued_at FROM nonces WHERE address = ? ORDER BY issued_at DESC",
          [address],
          (row) => ({ nonce: row.nonce, issued_at: row.issued_at })
        );

        if (!storedNonce) {
          return error(401, "No nonce found for this address");
        }

        // Check if nonce matches
        if (siweMessage.nonce !== storedNonce.nonce) {
          return error(401, "Invalid nonce");
        }

        // Check if nonce is expired (5 minutes)
        const issuedTime = new Date(storedNonce.issued_at).getTime();
        const now = new Date().getTime();
        const fiveMinutes = 5 * 60 * 1000;
        if (now - issuedTime > fiveMinutes) {
          return error(401, "Nonce expired");
        }

        // Verify the signature
        const verification = await siweMessage.verify({ signature: body.signature });
        if (!verification.success) {
          return error(401, "Invalid signature");
        }

        // Insert address into users table if new
        await dbRun(
          env.DB,
          "INSERT OR IGNORE INTO users (address) VALUES (?)",
          [address]
        );

        // Delete the used nonce
        await dbRun(
          env.DB,
          "DELETE FROM nonces WHERE address = ?",
          [address]
        );

        // Issue JWT token
        const secretKey = await getJwtSecretKey(env);
        const jwt = await new SignJWT({ sub: address })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('7d')
          .sign(secretKey);

        return json({ token: jwt });
      } catch (err) {
        console.error("SIWE verification error:", err);
        return error(401, "Authentication failed");
      }
    },
  },
  // Auth: Logout (client-side only - just return success)
  {
    pattern: new URLPattern({ pathname: "/api/auth/logout" }),
    methods: ["POST"],
    handler: async () => {
      return json({ success: true, message: "Logged out successfully" });
    },
  },
  // Dashboard data
  {
    pattern: new URLPattern({ pathname: "/api/dashboard" }),
    methods: ["GET"],
    handler: requireAuthentication(async (request, env) => {
      const url = new URL(request.url);
      const daysParam = url.searchParams.get("days");
      let days = 30; // default to 30 days
      if (daysParam) {
        const n = Number(daysParam);
        if (Number.isFinite(n) && n > 0) days = Math.min(365, Math.max(1, Math.trunc(n)));
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);
      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();

      // Query for daily headache summary
      const dailyStatsSQL = `
        SELECT 
          timestamp,
          severity,
          aura
        FROM headaches 
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp
      `;

      // Query for events in the same period
      const eventsSQL = `
        SELECT 
          event_type,
          value,
          timestamp
        FROM events 
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp
      `;

      const [headaches, events] = await Promise.all([
        dbAll<any>(env.DB, dailyStatsSQL, [startISO, endISO], (row) => ({
          timestamp: row.timestamp,
          severity: row.severity,
          aura: row.aura
        })),
        dbAll<any>(env.DB, eventsSQL, [startISO, endISO], (row) => ({
          event_type: row.event_type,
          value: row.value,
          timestamp: row.timestamp
        }))
      ]);

      return json({ 
        days_requested: days,
        start_date: startISO.split('T')[0],
        end_date: endISO.split('T')[0],
        headaches,
        events
      });
    }),
  },
  // CORS preflight for all /api/*
  {
    pattern: new URLPattern({ pathname: "/api/*" }),
    methods: ["OPTIONS"],
    handler: async (request) => {
      const reqHeaders = request.headers.get("Access-Control-Request-Headers");
      const resp = new Response(null, {
        status: 204,
        headers: {
          Allow: "GET,POST,PATCH,DELETE,OPTIONS",
          ...(reqHeaders ? { "Access-Control-Allow-Headers": reqHeaders } : {}),
          "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        },
      });
      return withCors(resp);
    },
  },
  // Headache collection
  {
    pattern: new URLPattern({ pathname: "/api/headaches" }),
    methods: ["GET", "POST"],
    handler: requireAuthentication(async (request, env) => {
      const url = new URL(request.url);
      if (request.method === "GET") {
        // Query params
        const limitParam = url.searchParams.get("limit");
        const offsetParam = url.searchParams.get("offset");
        const since = url.searchParams.get("since");
        const until = url.searchParams.get("until");
        const severityMin = url.searchParams.get("severity_min");
        const severityMax = url.searchParams.get("severity_max");

        let limit = 50;
        if (limitParam) {
          const n = Number(limitParam);
          if (Number.isFinite(n)) limit = Math.max(1, Math.min(200, Math.trunc(n)));
        }
        let offset = 0;
        if (offsetParam) {
          const n = Number(offsetParam);
          if (Number.isFinite(n) && n >= 0) offset = Math.trunc(n);
        }

        const where: string[] = [];
        const binds: any[] = [];

        if (since && validateTimestamp(since)) {
          where.push("timestamp >= ?");
          binds.push(toISO(since));
        }
        if (until && validateTimestamp(until)) {
          where.push("timestamp <= ?");
          binds.push(toISO(until));
        }
        if (severityMin != null || severityMax != null) {
          const min = severityMin != null ? Math.max(0, Math.min(10, Math.trunc(Number(severityMin)))) : 0;
          const max = severityMax != null ? Math.max(0, Math.min(10, Math.trunc(Number(severityMax)))) : 10;
          where.push("severity BETWEEN ? AND ?");
          binds.push(min, max);
        }

        const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const sql = `SELECT * FROM headaches ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
        binds.push(limit, offset);

        const items = await dbAll<Headache>(env.DB, sql, binds, mapHeadache);
        return json({ items });
      }

      // POST - create
      const body = await readJson<any>(request);
      if (!body) return error(400, "Invalid JSON body");

      const { severity, aura } = body ?? {};
      const validationErrors: Record<string, string> = {};
      if (!isInt(severity) || severity < 0 || severity > 10)
        validationErrors.severity = "severity must be an integer between 0 and 10";
      if (!isInt(aura) || (aura !== 0 && aura !== 1))
        validationErrors.aura = "aura must be 0 or 1";

      if (Object.keys(validationErrors).length) {
        return error(422, "Validation failed", validationErrors);
      }

      const iso = new Date().toISOString();
      const res = await dbRun(
        env.DB,
        "INSERT INTO headaches (timestamp, severity, aura) VALUES (?, ?, ?)",
        [iso, severity, aura]
      );
      const id = res.meta.last_row_id;
      const item = await dbFirst<Headache>(env.DB, "SELECT * FROM headaches WHERE id = ?", [id], mapHeadache);
      return json(item, 201, { Location: `/api/headaches/${id}` });
    }),
  },
  // Headache item
  {
    pattern: new URLPattern({ pathname: "/api/headaches/:id" }),
    methods: ["GET", "PATCH", "DELETE"],
    handler: requireAuthentication(async (request, env, match) => {
      const idStr = match.pathname.groups.id;
      const id = Number(idStr);
      if (!Number.isFinite(id) || id < 1) return error(400, "Invalid id");

      if (request.method === "GET") {
        const row = await dbFirst<Headache>(env.DB, "SELECT * FROM headaches WHERE id = ?", [id], mapHeadache);
        if (!row) return error(404, "Not found");
        return json(row);
      }

      if (request.method === "PATCH") {
        const body = await readJson<any>(request);
        if (!body) return error(400, "Invalid JSON body");

        const fields: string[] = [];
        const binds: any[] = [];
        const errors: Record<string, string> = {};

        if ("timestamp" in body) {
          if (!validateTimestamp(body.timestamp)) errors.timestamp = "timestamp must be a valid ISO-8601 string";
          else {
            fields.push("timestamp = ?");
            binds.push(toISO(body.timestamp));
          }
        }
        if ("severity" in body) {
          if (!isInt(body.severity) || body.severity < 0 || body.severity > 10)
            errors.severity = "severity must be an integer between 0 and 10";
          else {
            fields.push("severity = ?");
            binds.push(Math.trunc(body.severity));
          }
        }
        if ("aura" in body) {
          if (!isInt(body.aura) || (body.aura !== 0 && body.aura !== 1)) errors.aura = "aura must be 0 or 1";
          else {
            fields.push("aura = ?");
            binds.push(body.aura);
          }
        }

        if (Object.keys(errors).length) return error(422, "Validation failed", errors);
        if (fields.length === 0) return error(400, "No valid fields to update");

        const sql = `UPDATE headaches SET ${fields.join(", ")} WHERE id = ?`;
        binds.push(id);
        const result = await dbRun(env.DB, sql, binds);
        if (result.meta.changes === 0) return error(404, "Not found");
        const row = await dbFirst<Headache>(env.DB, "SELECT * FROM headaches WHERE id = ?", [id], mapHeadache);
        return json(row);
      }

      // DELETE
      const del = await dbRun(env.DB, "DELETE FROM headaches WHERE id = ?", [id]);
      if (del.meta.changes === 0) return error(404, "Not found");
      return withCors(new Response(null, { status: 204 }));
    }),
  },
  // Event collection
  {
    pattern: new URLPattern({ pathname: "/api/events" }),
    methods: ["GET", "POST"],
    handler: requireAuthentication(async (request, env) => {
      const url = new URL(request.url);
      if (request.method === "GET") {
        // Query params
        const limitParam = url.searchParams.get("limit");
        const offsetParam = url.searchParams.get("offset");
        const since = url.searchParams.get("since");
        const until = url.searchParams.get("until");
        const typeParam = url.searchParams.get("type"); // maps to event_type

        let limit = 50;
        if (limitParam) {
          const n = Number(limitParam);
          if (Number.isFinite(n)) limit = Math.max(1, Math.min(200, Math.trunc(n)));
        }
        let offset = 0;
        if (offsetParam) {
          const n = Number(offsetParam);
          if (Number.isFinite(n) && n >= 0) offset = Math.trunc(n);
        }

        const where: string[] = [];
        const binds: any[] = [];

        if (since && validateTimestamp(since)) {
          where.push("timestamp >= ?");
          binds.push(toISO(since));
        }
        if (until && validateTimestamp(until)) {
          where.push("timestamp <= ?");
          binds.push(toISO(until));
        }
        if (typeParam) {
          where.push("event_type = ?");
          binds.push(typeParam);
        }

        const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const sql = `SELECT * FROM events ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
        binds.push(limit, offset);

        const items = await dbAll<EventItem>(env.DB, sql, binds, mapEvent);
        return json({ items });
      }

      // POST - create
      const body = await readJson<any>(request);
      if (!body) return error(400, "Invalid JSON body");

      const { event_type, value } = body ?? {};
      const validationErrors: Record<string, string> = {};
      if (typeof event_type !== "string" || event_type.trim().length === 0)
        validationErrors.event_type = "event_type must be a non-empty string";
      if (typeof value !== "string") validationErrors.value = "value must be a string";

      if (Object.keys(validationErrors).length) {
        return error(422, "Validation failed", validationErrors);
      }

      const iso = new Date().toISOString();
      const res = await dbRun(
        env.DB,
        "INSERT INTO events (timestamp, event_type, value) VALUES (?, ?, ?)",
        [iso, event_type, value]
      );
      const id = res.meta.last_row_id;
      const item = await dbFirst<EventItem>(env.DB, "SELECT * FROM events WHERE id = ?", [id], mapEvent);
      return json(item, 201, { Location: `/api/events/${id}` });
    }),
  },
  // Event item
  {
    pattern: new URLPattern({ pathname: "/api/events/:id" }),
    methods: ["GET", "PATCH", "DELETE"],
    handler: requireAuthentication(async (request, env, match) => {
      const idStr = match.pathname.groups.id;
      const id = Number(idStr);
      if (!Number.isFinite(id) || id < 1) return error(400, "Invalid id");

      if (request.method === "GET") {
        const row = await dbFirst<EventItem>(env.DB, "SELECT * FROM events WHERE id = ?", [id], mapEvent);
        if (!row) return error(404, "Not found");
        return json(row);
      }

      if (request.method === "PATCH") {
        const body = await readJson<any>(request);
        if (!body) return error(400, "Invalid JSON body");

        const fields: string[] = [];
        const binds: any[] = [];
        const errors: Record<string, string> = {};

        if ("timestamp" in body) {
          if (!validateTimestamp(body.timestamp)) errors.timestamp = "timestamp must be a valid ISO-8601 string";
          else {
            fields.push("timestamp = ?");
            binds.push(toISO(body.timestamp));
          }
        }
        if ("event_type" in body) {
          if (typeof body.event_type !== "string" || body.event_type.trim().length === 0)
            errors.event_type = "event_type must be a non-empty string";
          else {
            fields.push("event_type = ?");
            binds.push(body.event_type);
          }
        }
        if ("value" in body) {
          if (typeof body.value !== "string") errors.value = "value must be a string";
          else {
            fields.push("value = ?");
            binds.push(body.value);
          }
        }

        if (Object.keys(errors).length) return error(422, "Validation failed", errors);
        if (fields.length === 0) return error(400, "No valid fields to update");

        const sql = `UPDATE events SET ${fields.join(", ")} WHERE id = ?`;
        binds.push(id);
        const result = await dbRun(env.DB, sql, binds);
        if (result.meta.changes === 0) return error(404, "Not found");
        const row = await dbFirst<EventItem>(env.DB, "SELECT * FROM events WHERE id = ?", [id], mapEvent);
        return json(row);
      }

      // DELETE
      const del = await dbRun(env.DB, "DELETE FROM events WHERE id = ?", [id]);
      if (del.meta.changes === 0) return error(404, "Not found");
      return withCors(new Response(null, { status: 204 }));
    }),
  },
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    for (const r of routes) {
      const match = r.pattern.exec(url);
      if (!match) continue;
      if (!r.methods.includes(request.method)) continue;
      try {
        return await r.handler(request, env, match);
      } catch (e: any) {
        if (e instanceof HttpError) {
          return e.response;
        }
        const message = e && typeof e === "object" && "message" in e ? (e as Error).message : String(e);
        return error(500, "Internal error", { message });
      }
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
