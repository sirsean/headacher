-- Google Health OAuth tokens (refresh only; encrypted at application layer)
CREATE TABLE IF NOT EXISTS google_health_oauth (
  user_id TEXT PRIMARY KEY,
  refresh_token_ciphertext TEXT NOT NULL,
  google_email TEXT NOT NULL,
  scope TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_sync_at TEXT,
  last_error TEXT,
  FOREIGN KEY (user_id) REFERENCES users_v2(id) ON DELETE CASCADE
);

-- Daily HRV (RMSSD in ms) keyed by API civil date (YYYY-MM-DD)
CREATE TABLE IF NOT EXISTS hrv_daily (
  user_id TEXT NOT NULL,
  civil_date TEXT NOT NULL,
  daily_rmssd_ms REAL,
  deep_rmssd_ms REAL,
  source_updated_at TEXT,
  PRIMARY KEY (user_id, civil_date),
  FOREIGN KEY (user_id) REFERENCES users_v2(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hrv_daily_user_civil ON hrv_daily(user_id, civil_date);
