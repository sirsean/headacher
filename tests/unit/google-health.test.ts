import { describe, it, expect } from "vitest";
import {
  buildDailyHrvDateFilter,
  buildDailyHrvDateFilterScoped,
  parseDailyHrvDataPoints,
} from "../../worker/services/google-health-api";
import { parseIdTokenEmail } from "../../worker/services/google-health-oauth";
import { encryptSecret, decryptSecret } from "../../worker/services/token-crypto";

describe("buildDailyHrvDateFilter", () => {
  it("uses snake_case data type prefix per Google Health filter rules", () => {
    const f = buildDailyHrvDateFilter("2024-06-01", "2024-07-01");
    expect(f).toContain("daily_heart_rate_variability.date");
    expect(f).not.toContain("dailyHeartRateVariability");
  });

  it("scoped variant omits data type prefix for parent-scoped list URLs", () => {
    const f = buildDailyHrvDateFilterScoped("2024-06-01", "2024-07-01");
    expect(f).toBe('date >= "2024-06-01" AND date < "2024-07-01"');
  });
});

describe("parseDailyHrvDataPoints", () => {
  it("parses Google Health API dailyHeartRateVariability (plain number ms fields)", () => {
    const body = {
      dataPoints: [
        {
          dailyHeartRateVariability: {
            date: { year: 2024, month: 6, day: 15 },
            averageHeartRateVariabilityMilliseconds: 45,
            deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds: 38,
          },
        },
      ],
    };
    const rows = parseDailyHrvDataPoints(body);
    expect(rows).toHaveLength(1);
    expect(rows[0].civil_date).toBe("2024-06-15");
    expect(rows[0].daily_rmssd_ms).toBe(45);
    expect(rows[0].deep_rmssd_ms).toBe(38);
  });

  it("parses legacy duration-shaped dailyRmssd fields", () => {
    const body = {
      dataPoints: [
        {
          dailyHeartRateVariability: {
            date: { year: 2024, month: 6, day: 15 },
            dailyRmssd: { millis: "45" },
            deepRmssd: { millis: "38" },
          },
        },
      ],
    };
    const rows = parseDailyHrvDataPoints(body);
    expect(rows[0].daily_rmssd_ms).toBe(45);
    expect(rows[0].deep_rmssd_ms).toBe(38);
  });

  it("parses seconds-based duration", () => {
    const body = {
      dataPoints: [
        {
          dailyHeartRateVariability: {
            date: { year: 2024, month: 1, day: 2 },
            dailyRmssd: { seconds: "0", nanos: 55000000 },
          },
        },
      ],
    };
    const rows = parseDailyHrvDataPoints(body);
    expect(rows[0].daily_rmssd_ms).toBe(55);
  });
});

describe("parseIdTokenEmail", () => {
  it("returns null for invalid input", () => {
    expect(parseIdTokenEmail(undefined)).toBeNull();
    expect(parseIdTokenEmail("x")).toBeNull();
  });

  it("decodes email from unsigned id_token payload", () => {
    const payload = btoa(JSON.stringify({ email: "a@b.com", email_verified: true }));
    const idToken = `x.${payload}.z`;
    const r = parseIdTokenEmail(idToken);
    expect(r?.email).toBe("a@b.com");
    expect(r?.emailVerified).toBe(true);
  });
});

describe("token-crypto", () => {
  it("round-trips refresh token material", async () => {
    const env = { JWT_SECRET_KEY: "test-secret-key-for-unit-tests-only" };
    const plain = "1//0refresh-token-example";
    const enc = await encryptSecret(plain, env);
    expect(enc).not.toContain(plain);
    const out = await decryptSecret(enc, env);
    expect(out).toBe(plain);
  });
});
