// worker/services/identity-service.ts
// Identity and account management for multi-provider auth
// Schema assumptions (from migrations/0002_dual_auth.sql):
// - users_v2(id TEXT PRIMARY KEY, created_at TEXT, display_name TEXT, email TEXT)
// - identities(id INTEGER PK, user_id TEXT, provider TEXT, identifier TEXT, email TEXT, display_name TEXT)

import { dbFirst, dbRun, HttpError } from "../utils";

export type Provider = "SIWE" | "GOOGLE";

export interface IdentityRow {
  id: number;
  user_id: string;
  provider: Provider;
  identifier: string;
  email?: string | null;
  display_name?: string | null;
  created_at?: string | null;
}

export interface IdentityPublic {
  provider: Provider;
  identifier: string;
  email?: string | null;
  display_name?: string | null;
  created_at?: string | null;
}

async function getIdentity(db: D1Database, provider: Provider, identifier: string): Promise<IdentityRow | null> {
  return dbFirst<IdentityRow>(
    db,
    "SELECT id, user_id, provider, identifier, email, display_name, created_at FROM identities WHERE provider = ? AND identifier = ?",
    [provider, identifier],
    (row) => ({
      id: Number(row.id),
      user_id: String(row.user_id),
      provider: String(row.provider) as Provider,
      identifier: String(row.identifier),
      email: (row as any).email ?? null,
      display_name: (row as any).display_name ?? null,
      created_at: (row as any).created_at ?? null,
    })
  );
}

async function ensureUser(db: D1Database, userId?: string, profile?: { email?: string | null; display_name?: string | null }): Promise<string> {
  if (userId) {
    // Ensure exists
    const found = await dbFirst<{ id: string }>(db, "SELECT id FROM users_v2 WHERE id = ?", [userId], (r) => ({ id: String((r as any).id) }));
    if (!found) {
      // Create explicit user id record
      await dbRun(db, "INSERT INTO users_v2 (id, email, display_name) VALUES (?, ?, ?)", [userId, profile?.email ?? null, profile?.display_name ?? null]);
    }
    return userId;
  }
  // Create new user id (random UUID)
  const id = crypto.randomUUID();
  await dbRun(db, "INSERT INTO users_v2 (id, email, display_name) VALUES (?, ?, ?)", [id, profile?.email ?? null, profile?.display_name ?? null]);
  return id;
}

export async function upsertUserForSiwe(db: D1Database, address: string): Promise<string> {
  // Legacy import path: users.address seeded into users_v2.id already via migration
  // Ensure users_v2 exists for this address id
  await ensureUser(db, address);
  // Ensure identity exists
  const existing = await getIdentity(db, "SIWE", address);
  if (!existing) {
    await dbRun(db, "INSERT INTO identities (user_id, provider, identifier) VALUES (?, ?, ?)", [address, "SIWE", address]);
  }
  return address; // userId equals address for SIWE users seeded
}

export async function upsertUserForGoogle(db: D1Database, uid: string, email?: string | null, displayName?: string | null): Promise<string> {
  const existing = await getIdentity(db, "GOOGLE", uid);
  if (existing) return existing.user_id;
  // Create a new user id
  const userId = await ensureUser(db, undefined, { email: email ?? null, display_name: displayName ?? null });
  await dbRun(db, "INSERT INTO identities (user_id, provider, identifier, email, display_name) VALUES (?, ?, ?, ?, ?)", [userId, "GOOGLE", uid, email ?? null, displayName ?? null]);
  return userId;
}

export async function linkSiweToUser(db: D1Database, userId: string, address: string): Promise<void> {
  const existing = await getIdentity(db, "SIWE", address);
  if (existing) {
    if (existing.user_id !== userId) throw new HttpError(409, "This wallet address is already linked to another account");
    return; // already linked
  }
  await dbRun(db, "INSERT INTO identities (user_id, provider, identifier) VALUES (?, 'SIWE', ?)", [userId, address]);
}

export async function linkGoogleToUser(db: D1Database, userId: string, uid: string, email?: string | null, displayName?: string | null): Promise<void> {
  const existing = await getIdentity(db, "GOOGLE", uid);
  if (existing) {
    if (existing.user_id !== userId) throw new HttpError(409, "This Google account is already linked to another account");
    return; // already linked
  }
  await dbRun(db, "INSERT INTO identities (user_id, provider, identifier, email, display_name) VALUES (?, 'GOOGLE', ?, ?, ?)", [userId, uid, email ?? null, displayName ?? null]);
}

export async function getUserIdentities(db: D1Database, userId: string): Promise<IdentityPublic[]> {
  const sql = "SELECT provider, identifier, email, display_name, created_at FROM identities WHERE user_id = ? ORDER BY created_at";
  const list = await (await db.prepare(sql).bind(userId).all()).results as any[] | undefined;
  const rows = list ?? [];
  return rows.map((r) => ({
    provider: String(r.provider) as Provider,
    identifier: String(r.identifier),
    email: (r as any).email ?? null,
    display_name: (r as any).display_name ?? null,
    created_at: (r as any).created_at ?? null,
  }));
}
