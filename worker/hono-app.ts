import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validateTimestamp, isInt, toISO, dbAll, dbFirst, dbRun, mapHeadache, mapEvent, HttpError, corsHeaders, requireAuthentication, getJwtSecretKey } from "./utils";
import { upsertUserForSiwe, upsertUserForGoogle, linkSiweToUser, linkGoogleToUser, getUserIdentities } from "./services/identity-service";
import { verifyFirebaseIdToken } from "./services/firebase-auth";
import type { EventItem, Headache } from "../src/types";
import { generateNonce, SiweMessage } from "siwe";
import { SignJWT } from "jose";

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  JWT_SECRET_KEY: string;
  FIREBASE_PROJECT_ID: string;
}

// Helper function to read JSON from request
async function readJson<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

// Note: requireAuth function is now imported from utils.ts and works with Hono Context


// Create the Hono app with proper type definition for Variables
type HonoEnv = {
  Bindings: Env;
  Variables: {
    addr: string;
    userId: string;
  };
};
const app = new Hono<HonoEnv>();

// Register global CORS middleware for all /api/* routes
app.use('/api/*', cors({
  origin: corsHeaders["Access-Control-Allow-Origin"],
  allowMethods: corsHeaders["Access-Control-Allow-Methods"].split(','),
  allowHeaders: corsHeaders["Access-Control-Allow-Headers"].split(','),
  exposeHeaders: corsHeaders["Access-Control-Expose-Headers"].split(','),
  maxAge: parseInt(corsHeaders["Access-Control-Max-Age"], 10),
}));

// Mount authentication middleware on protected routes
app.use('/api/dashboard', requireAuthentication);
app.use('/api/headaches', requireAuthentication);
app.use('/api/headaches/*', requireAuthentication);
app.use('/api/events', requireAuthentication);
app.use('/api/events/*', requireAuthentication);

// Error handler - wraps all thrown errors in existing utils.error() JSON shape, preserving HttpError logic
app.onError((err, c) => {
  console.error('Request error:', err);
  
  if (err instanceof HttpError) {
    return c.json({
      error: {
        status: err.status,
        message: err.message,
        details: err.details ?? null,
      },
    }, err.status as 400 | 401 | 403 | 404 | 422 | 500);
  }
  
  const message = err && typeof err === "object" && "message" in err ? (err as Error).message : String(err);
  return c.json({
    error: {
      status: 500,
      message: "Internal error",
      details: { message },
    },
  }, 500);
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ ok: true });
});

// Auth: Generate nonce
app.get('/api/auth/nonce', async (c) => {
  const address = c.req.query('address');
  if (!address) {
    return c.json({ error: { status: 400, message: "Missing address parameter", details: null } }, 400);
  }

  // Generate a unique nonce
  const nonce = generateNonce();
  const now = new Date().toISOString();

  // Upsert nonce into database
  await dbRun(
    c.env.DB,
    "INSERT OR REPLACE INTO nonces (address, nonce, issued_at) VALUES (?, ?, ?)",
    [address, nonce, now]
  );

  return c.json({ nonce });
});

// Auth: Verify SIWE signature
app.post('/api/auth/verify', async (c) => {
  const body = await readJson<{ message: string; signature: string }>(c.req.raw);
  if (!body || !body.message || !body.signature) {
    return c.json({ error: { status: 400, message: "Missing message or signature", details: null } }, 400);
  }

  try {
    // Parse and validate the SIWE message from prepared string
    const siweMessage = new SiweMessage(body.message);
    const address = siweMessage.address;

    // Fetch stored nonce for this address
    const storedNonce = await dbFirst<{ nonce: string; issued_at: string }>(
      c.env.DB,
      "SELECT nonce, issued_at FROM nonces WHERE address = ? ORDER BY issued_at DESC",
      [address],
      (row) => ({ nonce: row.nonce || '', issued_at: row.issued_at || '' })
    );

    if (!storedNonce) {
      return c.json({ error: { status: 401, message: "No nonce found for this address", details: null } }, 401);
    }

    // Check if nonce matches
    if (siweMessage.nonce !== storedNonce.nonce) {
      return c.json({ error: { status: 401, message: "Invalid nonce", details: null } }, 401);
    }

    // Check if nonce is expired (5 minutes)
    const issuedTime = new Date(storedNonce.issued_at).getTime();
    const now = new Date().getTime();
    const fiveMinutes = 5 * 60 * 1000;
    if (now - issuedTime > fiveMinutes) {
      return c.json({ error: { status: 401, message: "Nonce expired", details: null } }, 401);
    }

    // Verify the signature
    const verification = await siweMessage.verify({ signature: body.signature });
    if (!verification.success) {
      return c.json({ error: { status: 401, message: "Invalid signature", details: null } }, 401);
    }

    // Ensure identity and get canonical userId
    const userId = await upsertUserForSiwe(c.env.DB, address);

    // Delete the used nonce
    await dbRun(
      c.env.DB,
      "DELETE FROM nonces WHERE address = ?",
      [address]
    );

    // Issue long-lived JWT token (1 year), subject = userId
    const secretKey = await getJwtSecretKey(c.env);
    const jwt = await new SignJWT({ sub: userId, siwe_address: address, auth_provider: 'SIWE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('365d')
      .sign(secretKey);

    return c.json({ token: jwt });
  } catch (err) {
    console.error("SIWE verification error:", err);
    return c.json({ error: { status: 401, message: "Authentication failed", details: null } }, 401);
  }
});

// Auth: Google verify (Firebase)
app.post('/api/auth/google/verify', async (c) => {
  try {
    const body = await readJson<{ idToken: string; projectId?: string }>(c.req.raw);
    if (!body || !body.idToken) {
      return c.json({ error: { status: 400, message: "Missing idToken", details: null } }, 400);
    }
    const projectId = body.projectId || c.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
      return c.json({ error: { status: 500, message: "Server missing FIREBASE_PROJECT_ID", details: null } }, 500);
    }

    const info = await verifyFirebaseIdToken(body.idToken, projectId);
    const userId = await upsertUserForGoogle(c.env.DB, info.uid, info.email, info.name);

    const secretKey = await getJwtSecretKey(c.env);
    const jwt = await new SignJWT({ sub: userId, firebase_uid: info.uid, email: info.email, auth_provider: 'GOOGLE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('365d')
      .sign(secretKey);

    return c.json({ token: jwt });
  } catch (err) {
    console.error('Google verify error', err);
    return c.json({ error: { status: 401, message: 'Google authentication failed', details: null } }, 401);
  }
});

// Auth: Identities for current user
app.get('/api/auth/identities', requireAuthentication, async (c) => {
  const userId = c.get('userId');
  const list = await getUserIdentities(c.env.DB, userId);
  return c.json({ identities: list });
});

// Auth: Link SIWE to current user
app.post('/api/auth/link/siwe', requireAuthentication, async (c) => {
  const userId = c.get('userId');
  const body = await readJson<{ message: string; signature: string }>(c.req.raw);
  if (!body || !body.message || !body.signature) {
    return c.json({ error: { status: 400, message: "Missing message or signature", details: null } }, 400);
  }

  // Verify SIWE again to prove wallet control
  try {
    const siweMessage = new SiweMessage(body.message);
    const address = siweMessage.address;

    // Fetch stored nonce for this address
    const storedNonce = await dbFirst<{ nonce: string; issued_at: string }>(
      c.env.DB,
      "SELECT nonce, issued_at FROM nonces WHERE address = ? ORDER BY issued_at DESC",
      [address],
      (row) => ({ nonce: row.nonce || '', issued_at: row.issued_at || '' })
    );

    if (!storedNonce) {
      return c.json({ error: { status: 401, message: "No nonce found for this address", details: null } }, 401);
    }

    if (siweMessage.nonce !== storedNonce.nonce) {
      return c.json({ error: { status: 401, message: "Invalid nonce", details: null } }, 401);
    }

    const issuedTime = new Date(storedNonce.issued_at).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    if (now - issuedTime > fiveMinutes) {
      return c.json({ error: { status: 401, message: "Nonce expired", details: null } }, 401);
    }

    const verification = await siweMessage.verify({ signature: body.signature });
    if (!verification.success) {
      return c.json({ error: { status: 401, message: "Invalid signature", details: null } }, 401);
    }

    // Link identity
    await linkSiweToUser(c.env.DB, userId, siweMessage.address);

    // Delete the used nonce
    await dbRun(c.env.DB, "DELETE FROM nonces WHERE address = ?", [address]);

    return c.json({ success: true });
  } catch (err) {
    console.error('SIWE link error', err);
    if (err instanceof HttpError) return c.json({ error: { status: err.status, message: err.message, details: err.details ?? null } }, err.status as 400|401|403|404|409|422|500);
    return c.json({ error: { status: 401, message: 'Linking failed', details: null } }, 401);
  }
});

// Auth: Link Google to current user
app.post('/api/auth/link/google', requireAuthentication, async (c) => {
  const userId = c.get('userId');
  const body = await readJson<{ idToken: string; projectId?: string }>(c.req.raw);
  if (!body || !body.idToken) {
    return c.json({ error: { status: 400, message: "Missing idToken", details: null } }, 400);
  }
  const projectId = body.projectId || c.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    return c.json({ error: { status: 500, message: "Server missing FIREBASE_PROJECT_ID", details: null } }, 500);
  }
  try {
    const info = await verifyFirebaseIdToken(body.idToken, projectId);
    await linkGoogleToUser(c.env.DB, userId, info.uid, info.email, info.name);
    return c.json({ success: true });
  } catch (err) {
    console.error('Google link error', err);
    if (err instanceof HttpError) return c.json({ error: { status: err.status, message: err.message, details: err.details ?? null } }, err.status as 400|401|403|404|409|422|500);
    return c.json({ error: { status: 401, message: 'Linking failed', details: null } }, 401);
  }
});

// Auth: Logout (client-side only - just return success)
app.post('/api/auth/logout', (c) => {
  return c.json({ success: true, message: "Logged out successfully" });
});

// Dashboard data
app.get('/api/dashboard', async (c) => {
  const userId = c.get('userId');
  const daysParam = c.req.query('days');
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

  // Query for daily headache summary with user scoping
  const dailyStatsSQL = `
    SELECT 
      timestamp,
      severity,
      aura
    FROM headaches 
    WHERE timestamp >= ? AND timestamp <= ? AND user_id = ?
    ORDER BY timestamp
  `;

  // Query for events in the same period with user scoping
  const eventsSQL = `
    SELECT 
      event_type,
      value,
      timestamp
    FROM events 
    WHERE timestamp >= ? AND timestamp <= ? AND user_id = ?
    ORDER BY timestamp
  `;

  interface DashboardRow {
    timestamp: string;
    severity?: number;
    aura?: number;
    event_type?: string;
    value?: string;
  }

  const [headaches, events] = await Promise.all([
    dbAll<DashboardRow>(c.env.DB, dailyStatsSQL, [startISO, endISO, userId], (row) => ({
      timestamp: row.timestamp,
      severity: row.severity,
      aura: row.aura
    })),
    dbAll<DashboardRow>(c.env.DB, eventsSQL, [startISO, endISO, userId], (row) => ({
      event_type: row.event_type,
      value: row.value,
      timestamp: row.timestamp
    }))
  ]);

  return c.json({ 
    days_requested: days,
    start_date: startISO.split('T')[0],
    end_date: endISO.split('T')[0],
    headaches,
    events
  });
});

// Headache collection - GET and POST
app.get('/api/headaches', async (c) => {
  const userId = c.get('userId');
  
  // Query params
  const limitParam = c.req.query('limit');
  const offsetParam = c.req.query('offset');
  const since = c.req.query('since');
  const until = c.req.query('until');
  const severityMin = c.req.query('severity_min');
  const severityMax = c.req.query('severity_max');

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
  const binds: unknown[] = [];

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

  // Add user scoping
  where.push("user_id = ?");
  binds.push(userId);

  const whereClause = `WHERE ${where.join(" AND ")}`;
  const sql = `SELECT * FROM headaches ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
  binds.push(limit, offset);

  const items = await dbAll<Headache>(c.env.DB, sql, binds, mapHeadache);
  return c.json({ items });
});

app.post('/api/headaches', async (c) => {
  const userId = c.get('userId');
  const body = await readJson<{ severity?: number; aura?: number }>(c.req.raw);
  if (!body) {
    return c.json({ error: { status: 400, message: "Invalid JSON body", details: null } }, 400);
  }

  const { severity, aura } = body ?? {};
  const validationErrors: Record<string, string> = {};
  if (!isInt(severity) || severity < 0 || severity > 10)
    validationErrors.severity = "severity must be an integer between 0 and 10";
  if (!isInt(aura) || (aura !== 0 && aura !== 1))
    validationErrors.aura = "aura must be 0 or 1";

  if (Object.keys(validationErrors).length) {
    return c.json({ error: { status: 422, message: "Validation failed", details: validationErrors } }, 422);
  }

  const iso = new Date().toISOString();
  const res = await dbRun(
    c.env.DB,
    "INSERT INTO headaches (timestamp, severity, aura, user_id) VALUES (?, ?, ?, ?)",
    [iso, severity, aura, userId]
  );
  const id = res.meta.last_row_id;
  const item = await dbFirst<Headache>(c.env.DB, "SELECT * FROM headaches WHERE id = ? AND user_id = ?", [id, userId], mapHeadache);
  
  c.header('Location', `/api/headaches/${id}`);
  return c.json(item, 201);
});

// Headache item - GET, PATCH, DELETE
app.get('/api/headaches/:id', async (c) => {
  const userId = c.get('userId');
  const idStr = c.req.param('id');
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return c.json({ error: { status: 400, message: "Invalid id", details: null } }, 400);
  }

  const row = await dbFirst<Headache>(c.env.DB, "SELECT * FROM headaches WHERE id = ? AND user_id = ?", [id, userId], mapHeadache);
  if (!row) {
    return c.json({ error: { status: 404, message: "Not found", details: null } }, 404);
  }
  return c.json(row);
});

app.patch('/api/headaches/:id', async (c) => {
  const userId = c.get('userId');
  const idStr = c.req.param('id');
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return c.json({ error: { status: 400, message: "Invalid id", details: null } }, 400);
  }

  const body = await readJson<{ timestamp?: string; severity?: number; aura?: number }>(c.req.raw);
  if (!body) {
    return c.json({ error: { status: 400, message: "Invalid JSON body", details: null } }, 400);
  }

  const fields: string[] = [];
  const binds: unknown[] = [];
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

  if (Object.keys(errors).length) {
    return c.json({ error: { status: 422, message: "Validation failed", details: errors } }, 422);
  }
  if (fields.length === 0) {
    return c.json({ error: { status: 400, message: "No valid fields to update", details: null } }, 400);
  }

  const sql = `UPDATE headaches SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`;
  binds.push(id, userId);
  const result = await dbRun(c.env.DB, sql, binds);
  if (result.meta.changes === 0) {
    return c.json({ error: { status: 404, message: "Not found", details: null } }, 404);
  }
  const row = await dbFirst<Headache>(c.env.DB, "SELECT * FROM headaches WHERE id = ? AND user_id = ?", [id, userId], mapHeadache);
  return c.json(row);
});

app.delete('/api/headaches/:id', async (c) => {
  const userId = c.get('userId');
  const idStr = c.req.param('id');
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return c.json({ error: { status: 400, message: "Invalid id", details: null } }, 400);
  }

  const del = await dbRun(c.env.DB, "DELETE FROM headaches WHERE id = ? AND user_id = ?", [id, userId]);
  if (del.meta.changes === 0) {
    return c.json({ error: { status: 404, message: "Not found", details: null } }, 404);
  }
  return c.body(null, 204);
});

// Event types (must come before /api/events/:id to avoid route conflict)
app.get('/api/events/types', async (c) => {
  const userId = c.get('userId');
  const types = await dbAll<{ event_type: string }>(
    c.env.DB,
    "SELECT DISTINCT event_type FROM events WHERE user_id = ? ORDER BY event_type",
    [userId],
    (row) => ({ event_type: row.event_type || '' })
  );
  
  return c.json({ types: types.map(t => t.event_type) });
});

// Event collection - GET and POST
app.get('/api/events', async (c) => {
  const userId = c.get('userId');
  
  // Query params
  const limitParam = c.req.query('limit');
  const offsetParam = c.req.query('offset');
  const since = c.req.query('since');
  const until = c.req.query('until');
  const typeParam = c.req.query('type'); // maps to event_type

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
  const binds: unknown[] = [];

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

  // Add user scoping
  where.push("user_id = ?");
  binds.push(userId);

  const whereClause = `WHERE ${where.join(" AND ")}`;
  const sql = `SELECT * FROM events ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
  binds.push(limit, offset);

  const items = await dbAll<EventItem>(c.env.DB, sql, binds, mapEvent);
  return c.json({ items });
});

app.post('/api/events', async (c) => {
  const userId = c.get('userId');
  const body = await readJson<{ event_type?: string; value?: string }>(c.req.raw);
  if (!body) {
    return c.json({ error: { status: 400, message: "Invalid JSON body", details: null } }, 400);
  }

  const { event_type, value } = body ?? {};
  const validationErrors: Record<string, string> = {};
  if (typeof event_type !== "string" || event_type.trim().length === 0)
    validationErrors.event_type = "event_type must be a non-empty string";
  if (typeof value !== "string") validationErrors.value = "value must be a string";

  if (Object.keys(validationErrors).length) {
    return c.json({ error: { status: 422, message: "Validation failed", details: validationErrors } }, 422);
  }

  const iso = new Date().toISOString();
  const res = await dbRun(
    c.env.DB,
    "INSERT INTO events (timestamp, event_type, value, user_id) VALUES (?, ?, ?, ?)",
    [iso, event_type, value, userId]
  );
  const id = res.meta.last_row_id;
  const item = await dbFirst<EventItem>(c.env.DB, "SELECT * FROM events WHERE id = ? AND user_id = ?", [id, userId], mapEvent);
  
  c.header('Location', `/api/events/${id}`);
  return c.json(item, 201);
});

// Event item - GET, PATCH, DELETE
app.get('/api/events/:id', async (c) => {
  const userId = c.get('userId');
  const idStr = c.req.param('id');
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return c.json({ error: { status: 400, message: "Invalid id", details: null } }, 400);
  }

  const row = await dbFirst<EventItem>(c.env.DB, "SELECT * FROM events WHERE id = ? AND user_id = ?", [id, userId], mapEvent);
  if (!row) {
    return c.json({ error: { status: 404, message: "Not found", details: null } }, 404);
  }
  return c.json(row);
});

app.patch('/api/events/:id', async (c) => {
  const userId = c.get('userId');
  const idStr = c.req.param('id');
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return c.json({ error: { status: 400, message: "Invalid id", details: null } }, 400);
  }

  const body = await readJson<{ timestamp?: string; event_type?: string; value?: string }>(c.req.raw);
  if (!body) {
    return c.json({ error: { status: 400, message: "Invalid JSON body", details: null } }, 400);
  }

  const fields: string[] = [];
  const binds: unknown[] = [];
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

  if (Object.keys(errors).length) {
    return c.json({ error: { status: 422, message: "Validation failed", details: errors } }, 422);
  }
  if (fields.length === 0) {
    return c.json({ error: { status: 400, message: "No valid fields to update", details: null } }, 400);
  }

  const sql = `UPDATE events SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`;
  binds.push(id, userId);
  const result = await dbRun(c.env.DB, sql, binds);
  if (result.meta.changes === 0) {
    return c.json({ error: { status: 404, message: "Not found", details: null } }, 404);
  }
  const row = await dbFirst<EventItem>(c.env.DB, "SELECT * FROM events WHERE id = ? AND user_id = ?", [id, userId], mapEvent);
  return c.json(row);
});

app.delete('/api/events/:id', async (c) => {
  const userId = c.get('userId');
  const idStr = c.req.param('id');
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return c.json({ error: { status: 400, message: "Invalid id", details: null } }, 400);
  }

  const del = await dbRun(c.env.DB, "DELETE FROM events WHERE id = ? AND user_id = ?", [id, userId]);
  if (del.meta.changes === 0) {
    return c.json({ error: { status: 404, message: "Not found", details: null } }, 404);
  }
  return c.body(null, 204);
});

// Serve static assets and SPA fallback
app.use('*', async (c, next) => {
  // Skip API routes
  if (c.req.url.includes('/api/')) {
    return next();
  }
  
  const url = new URL(c.req.url);
  const pathname = url.pathname;
  
  // For HTML requests or root path, serve index.html (SPA fallback)
  const accept = c.req.header('Accept') || '';
  if (accept.includes('text/html') || pathname === '/' || !pathname.includes('.')) {
    try {
      if (c.env.ASSETS) {
        const indexRequest = new Request(new URL('/index.html', url.origin));
        const response = await c.env.ASSETS.fetch(indexRequest);
        if (response.ok) {
          return new Response(response.body, {
            status: response.status,
            headers: response.headers
          });
        }
      }
    } catch (err) {
      console.warn('Failed to serve index.html from ASSETS:', err);
    }
    // Fallback - return a simple HTML page
    return c.html(`
<!DOCTYPE html>
<html>
<head>
  <title>Headacher</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <div id="app">Loading...</div>
  <script>console.log('Static assets not available in development');</script>
</body>
</html>
    `);
  }
  
  // For static assets, try to serve from ASSETS binding
  try {
    if (c.env.ASSETS) {
      const assetRequest = new Request(url.toString());
      const response = await c.env.ASSETS.fetch(assetRequest);
      if (response.ok) {
        // Apply cache headers for static assets
        const immutableTypes = /\.(js|css|png|svg|jpg|woff2?)$/i;
        if (immutableTypes.test(pathname)) {
          const headers = new Headers(response.headers);
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          return new Response(response.body, {
            status: response.status,
            headers
          });
        }
        return response;
      }
    }
  } catch (err) {
    console.warn('Failed to serve static asset:', pathname, err);
  }
  
  // Asset not found
  return c.notFound();
});

export default app;
