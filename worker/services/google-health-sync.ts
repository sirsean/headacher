import { decryptSecret, encryptSecret } from "./token-crypto";
import {
  listGoogleHealthUsersForSync,
  updateGoogleHealthSyncMeta,
  upsertHrvDaily,
} from "./google-health-db";
import { addDaysUtcYmd, listDailyHeartRateVariabilityRange, utcYmd } from "./google-health-api";
import type { GoogleOauthEnv } from "./google-health-oauth";
import {
  fetchGoogleTokenInfo,
  missingHrvApiScopes,
  parseScopeString,
  refreshAccessToken,
} from "./google-health-oauth";

export type HeadacherBindings = GoogleOauthEnv & {
  DB: D1Database;
  JWT_SECRET_KEY: string;
  GOOGLE_HEALTH_PROJECT_ID: string;
  GOOGLE_TOKEN_ENCRYPTION_KEY?: string;
};

const SYNC_WINDOW_DAYS = 40;
const MAX_USERS_PER_CRON = 40;

export async function syncGoogleHealthForUser(env: HeadacherBindings, userId: string): Promise<void> {
  const row = await env.DB.prepare(
    "SELECT refresh_token_ciphertext FROM google_health_oauth WHERE user_id = ?",
  )
    .bind(userId)
    .first<{ refresh_token_ciphertext: string }>();
  if (!row?.refresh_token_ciphertext) return;

  let refreshPlain: string;
  try {
    refreshPlain = await decryptSecret(row.refresh_token_ciphertext, env);
  } catch (e) {
    await updateGoogleHealthSyncMeta(env.DB, userId, null, `decrypt_failed: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  let accessToken: string;
  let grantedScopeStr = "";
  try {
    const tok = await refreshAccessToken(env, refreshPlain);
    if (!tok.access_token) throw new Error("missing_access_token");
    accessToken = tok.access_token;
    grantedScopeStr = tok.scope ?? "";
    if (typeof tok.refresh_token === "string" && tok.refresh_token.length > 0) {
      const enc = await encryptSecret(tok.refresh_token, env);
      await env.DB.prepare(
        "UPDATE google_health_oauth SET refresh_token_ciphertext = ?, updated_at = ? WHERE user_id = ?",
      )
        .bind(enc, new Date().toISOString(), userId)
        .run();
    }
  } catch (e) {
    await updateGoogleHealthSyncMeta(
      env.DB,
      userId,
      null,
      `refresh_failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return;
  }

  const today = utcYmd(new Date());
  const start = addDaysUtcYmd(today, -SYNC_WINDOW_DAYS);
  const endExclusive = addDaysUtcYmd(today, 2);

  try {
    const days = await listDailyHeartRateVariabilityRange(
      accessToken,
      env.GOOGLE_HEALTH_PROJECT_ID,
      start,
      endExclusive,
    );
    const nowIso = new Date().toISOString();
    for (const d of days) {
      await upsertHrvDaily(env.DB, userId, d.civil_date, d.daily_rmssd_ms, d.deep_rmssd_ms, nowIso);
    }
    await updateGoogleHealthSyncMeta(env.DB, userId, nowIso, null);
  } catch (e) {
    let detail = e instanceof Error ? e.message : String(e);
    try {
      const fromRefresh = parseScopeString(grantedScopeStr);
      const fromInfo = await fetchGoogleTokenInfo(accessToken);
      const granted = fromRefresh.length > 0 ? fromRefresh : parseScopeString(fromInfo.scope);
      const missing = missingHrvApiScopes(granted);
      console.error("google_health_fetch_failed", {
        userId,
        message: detail,
        grantedScopes: granted,
        missingScopes: missing,
        requiredScope: "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
      });
      if (missing.length > 0) {
        detail += ` | granted=[${granted.join(" ")}] | missing=[${missing.join(" ")}]`;
      } else if (granted.length > 0) {
        detail += ` | granted=[${granted.join(" ")}]`;
      }
    } catch (logErr) {
      console.error("google_health_fetch_failed_scope_probe", logErr);
    }
    await updateGoogleHealthSyncMeta(env.DB, userId, null, `fetch_failed: ${detail}`);
  }
}

export async function runScheduledGoogleHealthSync(env: Env): Promise<void> {
  if (
    !env.GOOGLE_HEALTH_PROJECT_ID ||
    !env.GOOGLE_OAUTH_CLIENT_ID ||
    !env.GOOGLE_OAUTH_CLIENT_SECRET ||
    !env.GOOGLE_OAUTH_REDIRECT_URI
  ) {
    console.warn("google_health_sync_skipped_missing_config");
    return;
  }
  const bindings = env as HeadacherBindings;
  const rows = await listGoogleHealthUsersForSync(bindings.DB, MAX_USERS_PER_CRON);
  for (const r of rows) {
    await syncGoogleHealthForUser(bindings, r.user_id);
  }
}
