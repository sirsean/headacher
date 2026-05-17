const HEALTH_BASE = "https://health.googleapis.com/v4";

export interface ParsedHrvDay {
  civil_date: string;
  daily_rmssd_ms: number | null;
  deep_rmssd_ms: number | null;
}

function formatGoogleDate(d: unknown): string | null {
  if (!d || typeof d !== "object") return null;
  const o = d as { year?: unknown; month?: unknown; day?: unknown };
  const y = Number(o.year);
  const m = Number(o.month);
  const day = Number(o.day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toMillisMaybe(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    if (/^\d+$/.test(v)) return Number(v);
    if (v.endsWith("s") && /^\d+(\.\d+)?s$/.test(v)) {
      const sec = Number(v.slice(0, -1));
      return Number.isFinite(sec) ? Math.round(sec * 1000) : null;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "object") {
    const o = v as { seconds?: unknown; nanos?: unknown; millis?: unknown };
    if (o.millis != null) return toMillisMaybe(o.millis);
    const sec = o.seconds != null ? Number(o.seconds) : NaN;
    const nano = o.nanos != null ? Number(o.nanos) : 0;
    if (Number.isFinite(sec)) return Math.round(sec * 1000 + nano / 1e6);
  }
  return null;
}

function pickRmssdMs(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const ms = toMillisMaybe(obj[k]);
    if (ms != null && ms > 0) return ms;
  }
  return null;
}

export function parseDailyHrvDataPoints(body: unknown): ParsedHrvDay[] {
  const root = body as { dataPoints?: unknown[] };
  const out: ParsedHrvDay[] = [];
  for (const dp of root.dataPoints ?? []) {
    if (!dp || typeof dp !== "object") continue;
    const p = dp as { dailyHeartRateVariability?: Record<string, unknown> };
    const h = p.dailyHeartRateVariability;
    if (!h) continue;
    const civil = formatGoogleDate(h.date);
    if (!civil) continue;
    const daily = pickRmssdMs(h, [
      "averageHeartRateVariabilityMilliseconds",
      "dailyRmssd",
      "dailyRmssdMillis",
      "allNightRmssd",
      "combinedSleepRmssd",
      "rmssdMillis",
      "rmssd",
    ]);
    const deep = pickRmssdMs(h, [
      "deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds",
      "deepRmssd",
      "deepSleepRmssd",
      "deepSleepRmssdMillis",
    ]);
    out.push({
      civil_date: civil,
      daily_rmssd_ms: daily,
      deep_rmssd_ms: deep,
    });
  }
  return out;
}

function healthRequestHeaders(accessToken: string, quotaProjectId: string): HeadersInit {
  return {
    authorization: `Bearer ${accessToken}`,
    accept: "application/json",
    "x-goog-user-project": quotaProjectId,
  };
}

export async function listDailyHeartRateVariabilityPage(
  accessToken: string,
  quotaProjectId: string,
  filter: string,
  pageToken?: string,
): Promise<{ items: ParsedHrvDay[]; nextPageToken?: string }> {
  const parentPath = `${HEALTH_BASE}/users/me/dataTypes/daily-heart-rate-variability/dataPoints`;
  const u = new URL(parentPath);
  u.searchParams.set("filter", filter);
  if (pageToken) u.searchParams.set("pageToken", pageToken);
  const res = await fetch(u.toString(), {
    headers: healthRequestHeaders(accessToken, quotaProjectId),
  });
  const json = (await res.json()) as unknown;
  if (!res.ok) {
    const err = json as { error?: { message?: string } };
    throw new Error(err.error?.message || `health_api_${res.status}`);
  }
  return { items: parseDailyHrvDataPoints(json), nextPageToken: (json as { nextPageToken?: string }).nextPageToken };
}

/** snake_case data type prefix in filter expressions (see Google Health data-types doc). */
export function buildDailyHrvDateFilter(startYmdInclusive: string, endYmdExclusive: string): string {
  return `daily_heart_rate_variability.date >= "${startYmdInclusive}" AND daily_heart_rate_variability.date < "${endYmdExclusive}"`;
}

/** When parent URL is already `.../daily-heart-rate-variability/dataPoints`, some responses reject a typed filter prefix. */
export function buildDailyHrvDateFilterScoped(startYmdInclusive: string, endYmdExclusive: string): string {
  return `date >= "${startYmdInclusive}" AND date < "${endYmdExclusive}"`;
}

function isInvalidDataPointFilterError(message: string): boolean {
  return /INVALID_DATA_POINT_FILTER/i.test(message);
}

export async function listDailyHeartRateVariabilityRange(
  accessToken: string,
  quotaProjectId: string,
  startYmdInclusive: string,
  endYmdExclusive: string,
): Promise<ParsedHrvDay[]> {
  const filters = [
    buildDailyHrvDateFilter(startYmdInclusive, endYmdExclusive),
    buildDailyHrvDateFilterScoped(startYmdInclusive, endYmdExclusive),
  ];

  let lastError: Error | null = null;
  for (const filter of filters) {
    try {
      return await listDailyHeartRateVariabilityWithFilter(
        accessToken,
        quotaProjectId,
        filter,
      );
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      lastError = err;
      if (!isInvalidDataPointFilterError(err.message)) throw err;
      console.warn("google_health_hrv_filter_retry", { filter, message: err.message });
    }
  }
  throw lastError ?? new Error("health_api_filter_failed");
}

async function listDailyHeartRateVariabilityWithFilter(
  accessToken: string,
  quotaProjectId: string,
  filter: string,
): Promise<ParsedHrvDay[]> {
  const all: ParsedHrvDay[] = [];
  let pageToken: string | undefined;
  do {
    const { items, nextPageToken } = await listDailyHeartRateVariabilityPage(
      accessToken,
      quotaProjectId,
      filter,
      pageToken,
    );
    all.push(...items);
    pageToken = nextPageToken;
    if (all.length > 5000) break;
  } while (pageToken);
  return all;
}

export function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysUtcYmd(ymd: string, deltaDays: number): string {
  const [y, m, da] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, da + deltaDays));
  return utcYmd(dt);
}
