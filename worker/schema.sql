-- worker/schema.sql
-- Schema for Headacher MVP (Cloudflare D1 / SQLite)
-- IDs are simple autoincrementing integers for ease of use.

PRAGMA foreign_keys = ON;

-- Table: headaches
CREATE TABLE IF NOT EXISTS headaches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL, -- ISO-8601 UTC (e.g., 2025-08-10T03:00:00Z)
  severity INTEGER NOT NULL CHECK (severity BETWEEN 0 AND 10),
  aura INTEGER NOT NULL CHECK (aura IN (0,1)),
  user_id TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(address) ON DELETE CASCADE
);

-- Indexes for headaches
CREATE INDEX IF NOT EXISTS idx_headaches_timestamp ON headaches(timestamp);
CREATE INDEX IF NOT EXISTS idx_headaches_severity ON headaches(severity);
CREATE INDEX IF NOT EXISTS idx_headaches_user_id ON headaches(user_id);

-- Table: events (global timeline items)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL, -- ISO-8601 UTC
  event_type TEXT NOT NULL, -- free-form text
  value TEXT NOT NULL, -- free-form text
  user_id TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(address) ON DELETE CASCADE
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);

-- Table: settings (simple key/value)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL
);

-- Index to accelerate lookups by key (redundant with UNIQUE but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Table: users (EVM addresses for auth)
CREATE TABLE IF NOT EXISTS users (
  address TEXT PRIMARY KEY, -- EVM address (checksum)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Table: nonces (for auth challenges)
CREATE TABLE IF NOT EXISTS nonces (
  address TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  issued_at TEXT DEFAULT CURRENT_TIMESTAMP
);
