import { json, ok, withCors, error, validateTimestamp, isInt, toISO, dbAll, dbFirst, dbRun, mapHeadache, mapEvent, HttpError } from "./utils";
import type { EventItem, Headache } from "../src/types";

type Handler = (
  request: Request,
  env: Env,
  match: URLPatternResult
) => Response | Promise<Response>;

async function readJson<T = any>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

const routes: { pattern: URLPattern; methods: string[]; handler: Handler }[] = [
  // Health check
  {
    pattern: new URLPattern({ pathname: "/api/health" }),
    methods: ["GET"],
    handler: async () => ok(),
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
    handler: async (request, env) => {
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
    },
  },
  // Headache item
  {
    pattern: new URLPattern({ pathname: "/api/headaches/:id" }),
    methods: ["GET", "PATCH", "DELETE"],
    handler: async (request, env, match) => {
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
    },
  },
  // Event collection
  {
    pattern: new URLPattern({ pathname: "/api/events" }),
    methods: ["GET", "POST"],
    handler: async (request, env) => {
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
    },
  },
  // Event item
  {
    pattern: new URLPattern({ pathname: "/api/events/:id" }),
    methods: ["GET", "PATCH", "DELETE"],
    handler: async (request, env, match) => {
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
    },
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
