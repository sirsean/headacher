-- 0002_dual_auth.sql
-- Introduce multi-identity auth model and migrate existing data
-- Strategy:
-- - Create new canonical users table (users_v2) with string id PK (text), created_at, optional profile fields
-- - Create identities table (provider, identifier) -> users_v2(id)
-- - Migrate existing users(address) into users_v2(id=address) and identities(provider=SIWE, identifier=address)
-- - Recreate headaches/events tables so their user_id FK references users_v2(id)
-- - Keep nonces table as-is (address-based) for SIWE flow
-- - Leave legacy users table in place for reference (optional)

PRAGMA foreign_keys = OFF;

-- 1) Canonical users table (string id)
CREATE TABLE IF NOT EXISTS users_v2 (
  id TEXT PRIMARY KEY,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  display_name TEXT,
  email TEXT
);

-- 2) Identities table
CREATE TABLE IF NOT EXISTS identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- e.g., 'SIWE', 'GOOGLE'
  identifier TEXT NOT NULL, -- EVM address (checksum) for SIWE; Firebase UID for GOOGLE
  email TEXT,
  display_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, identifier),
  FOREIGN KEY(user_id) REFERENCES users_v2(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_identities_user_id ON identities(user_id);
CREATE INDEX IF NOT EXISTS idx_identities_provider ON identities(provider);

-- 3) Seed users_v2 from legacy users table (if present)
--    Legacy users schema: users(address TEXT PRIMARY KEY, created_at TEXT DEFAULT CURRENT_TIMESTAMP)
INSERT OR IGNORE INTO users_v2 (id, created_at)
SELECT address, COALESCE(created_at, CURRENT_TIMESTAMP)
FROM users;

-- 4) Create SIWE identities for all legacy users
INSERT OR IGNORE INTO identities (user_id, provider, identifier, created_at)
SELECT address, 'SIWE', address, COALESCE(created_at, CURRENT_TIMESTAMP)
FROM users;

-- 5) Rebuild headaches table with FK to users_v2(id)
CREATE TABLE IF NOT EXISTS headaches_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  severity INTEGER NOT NULL CHECK (severity BETWEEN 0 AND 10),
  aura INTEGER NOT NULL CHECK (aura IN (0,1)),
  user_id TEXT,
  FOREIGN KEY(user_id) REFERENCES users_v2(id) ON DELETE CASCADE
);
INSERT INTO headaches_new (id, timestamp, severity, aura, user_id)
SELECT id, timestamp, severity, aura, user_id FROM headaches;
DROP TABLE headaches;
ALTER TABLE headaches_new RENAME TO headaches;
CREATE INDEX IF NOT EXISTS idx_headaches_timestamp ON headaches(timestamp);
CREATE INDEX IF NOT EXISTS idx_headaches_severity ON headaches(severity);
CREATE INDEX IF NOT EXISTS idx_headaches_user_id ON headaches(user_id);

-- 6) Rebuild events table with FK to users_v2(id)
CREATE TABLE IF NOT EXISTS events_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  event_type TEXT NOT NULL,
  value TEXT NOT NULL,
  user_id TEXT,
  FOREIGN KEY(user_id) REFERENCES users_v2(id) ON DELETE CASCADE
);
INSERT INTO events_new (id, timestamp, event_type, value, user_id)
SELECT id, timestamp, event_type, value, user_id FROM events;
DROP TABLE events;
ALTER TABLE events_new RENAME TO events;
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);

PRAGMA foreign_keys = ON;