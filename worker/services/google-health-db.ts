import { dbAll, dbFirst, dbRun } from "../utils";

export interface GoogleHealthOauthRow {
  user_id: string;
  refresh_token_ciphertext: string;
  google_email: string;
  scope: string;
  last_sync_at: string | null;
  last_error: string | null;
}

export async function getGoogleIdentityEmail(db: D1Database, userId: string): Promise<string | null> {
  const row = await dbFirst<{ email: string | null }>(
    db,
    "SELECT email FROM identities WHERE user_id = ? AND provider = 'GOOGLE' ORDER BY id LIMIT 1",
    [userId],
    (r) => ({ email: typeof r.email === "string" ? r.email : null }),
  );
  return row?.email ?? null;
}

export async function hasGoogleIdentity(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS k FROM identities WHERE user_id = ? AND provider = 'GOOGLE' LIMIT 1")
    .bind(userId)
    .first<{ k: number }>();
  return row != null;
}

export async function getGoogleHealthStatus(
  db: D1Database,
  userId: string,
): Promise<{ connected: boolean; lastSyncAt: string | null; lastError: string | null }> {
  const row = await dbFirst<{ user_id: string; last_sync_at: string | null; last_error: string | null }>(
    db,
    "SELECT user_id, last_sync_at, last_error FROM google_health_oauth WHERE user_id = ?",
    [userId],
    (r) => ({
      user_id: String(r.user_id),
      last_sync_at: typeof r.last_sync_at === "string" ? r.last_sync_at : null,
      last_error: typeof r.last_error === "string" ? r.last_error : null,
    }),
  );
  if (!row) return { connected: false, lastSyncAt: null, lastError: null };
  return { connected: true, lastSyncAt: row.last_sync_at, lastError: row.last_error };
}

export async function upsertGoogleHealthOauth(
  db: D1Database,
  userId: string,
  refreshCiphertext: string,
  googleEmail: string,
  scope: string,
): Promise<void> {
  const now = new Date().toISOString();
  await dbRun(
    db,
    `INSERT INTO google_health_oauth (user_id, refresh_token_ciphertext, google_email, scope, created_at, updated_at, last_error)
     VALUES (?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(user_id) DO UPDATE SET
       refresh_token_ciphertext = excluded.refresh_token_ciphertext,
       google_email = excluded.google_email,
       scope = excluded.scope,
       updated_at = excluded.updated_at,
       last_error = NULL`,
    [userId, refreshCiphertext, googleEmail, scope, now, now],
  );
}

export async function updateGoogleHealthSyncMeta(
  db: D1Database,
  userId: string,
  lastSyncAt: string | null,
  lastError: string | null,
): Promise<void> {
  await dbRun(db, "UPDATE google_health_oauth SET last_sync_at = ?, last_error = ?, updated_at = ? WHERE user_id = ?", [
    lastSyncAt,
    lastError,
    new Date().toISOString(),
    userId,
  ]);
}

export async function listGoogleHealthUsersForSync(db: D1Database, limit: number): Promise<GoogleHealthOauthRow[]> {
  return dbAll<GoogleHealthOauthRow>(
    db,
    "SELECT user_id, refresh_token_ciphertext, google_email, scope, last_sync_at, last_error FROM google_health_oauth ORDER BY (last_sync_at IS NULL) DESC, last_sync_at ASC LIMIT ?",
    [limit],
    (r) => ({
      user_id: String(r.user_id),
      refresh_token_ciphertext: String(r.refresh_token_ciphertext),
      google_email: String(r.google_email),
      scope: String(r.scope),
      last_sync_at: typeof r.last_sync_at === "string" ? r.last_sync_at : null,
      last_error: typeof r.last_error === "string" ? r.last_error : null,
    }),
  );
}

export async function upsertHrvDaily(
  db: D1Database,
  userId: string,
  civilDate: string,
  dailyRmssdMs: number | null,
  deepRmssdMs: number | null,
  sourceUpdatedAt: string,
): Promise<void> {
  await dbRun(
    db,
    `INSERT INTO hrv_daily (user_id, civil_date, daily_rmssd_ms, deep_rmssd_ms, source_updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, civil_date) DO UPDATE SET
       daily_rmssd_ms = COALESCE(excluded.daily_rmssd_ms, hrv_daily.daily_rmssd_ms),
       deep_rmssd_ms = COALESCE(excluded.deep_rmssd_ms, hrv_daily.deep_rmssd_ms),
       source_updated_at = excluded.source_updated_at`,
    [userId, civilDate, dailyRmssdMs, deepRmssdMs, sourceUpdatedAt],
  );
}

export interface HrvDailyRow {
  civil_date: string;
  daily_rmssd_ms: number | null;
  deep_rmssd_ms: number | null;
}

export interface ListHrvDailyOptions {
  order?: "asc" | "desc";
  limit?: number;
}

function mapHrvDailyRow(r: Record<string, unknown>): HrvDailyRow {
  return {
    civil_date: String(r.civil_date),
    daily_rmssd_ms: r.daily_rmssd_ms == null ? null : Number(r.daily_rmssd_ms),
    deep_rmssd_ms: r.deep_rmssd_ms == null ? null : Number(r.deep_rmssd_ms),
  };
}

export async function listHrvDailyForUser(
  db: D1Database,
  userId: string,
  startYmd: string | null,
  endYmd: string | null,
  options: ListHrvDailyOptions = {},
): Promise<HrvDailyRow[]> {
  const order = options.order === "desc" ? "DESC" : "ASC";
  const limit =
    options.limit != null && Number.isFinite(options.limit)
      ? Math.max(1, Math.min(500, Math.trunc(options.limit)))
      : null;

  if (startYmd && endYmd) {
    const sql =
      limit != null
        ? `SELECT civil_date, daily_rmssd_ms, deep_rmssd_ms FROM hrv_daily WHERE user_id = ? AND civil_date >= ? AND civil_date <= ? ORDER BY civil_date ${order} LIMIT ?`
        : `SELECT civil_date, daily_rmssd_ms, deep_rmssd_ms FROM hrv_daily WHERE user_id = ? AND civil_date >= ? AND civil_date <= ? ORDER BY civil_date ${order}`;
    const binds =
      limit != null
        ? [userId, startYmd, endYmd, limit]
        : [userId, startYmd, endYmd];
    return dbAll<HrvDailyRow>(db, sql, binds, mapHrvDailyRow);
  }

  const sql =
    limit != null
      ? `SELECT civil_date, daily_rmssd_ms, deep_rmssd_ms FROM hrv_daily WHERE user_id = ? ORDER BY civil_date ${order} LIMIT ?`
      : `SELECT civil_date, daily_rmssd_ms, deep_rmssd_ms FROM hrv_daily WHERE user_id = ? ORDER BY civil_date ${order}`;
  const binds = limit != null ? [userId, limit] : [userId];
  return dbAll<HrvDailyRow>(db, sql, binds, mapHrvDailyRow);
}
