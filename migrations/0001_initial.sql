-- 0001_initial.sql
-- Initial schema for Headacher (Cloudflare D1 / SQLite)
-- Uses INTEGER PRIMARY KEY AUTOINCREMENT IDs as requested.
PRAGMA foreign_keys = ON;

-- Table: headaches
CREATE TABLE IF NOT EXISTS headaches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL, -- ISO-8601 UTC (e.g., 2025-08-10T03:00:00Z)
  severity INTEGER NOT NULL CHECK (severity BETWEEN 0 AND 10),
  aura INTEGER NOT NULL CHECK (aura IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_headaches_timestamp ON headaches(timestamp);
CREATE INDEX IF NOT EXISTS idx_headaches_severity ON headaches(severity);

-- Table: events
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL, -- ISO-8601 UTC
  event_type TEXT NOT NULL, -- free-form text
  value TEXT NOT NULL -- free-form text
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

-- Table: settings
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

