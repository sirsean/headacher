# DUAL_AUTH.md

This document explains how dual authentication (SIWE and Firebase Authentication with Google) is implemented.

High-level
- Users have a single canonical user_id (users_v2.id) used as the subject in the app JWT.
- One user can have multiple linked identities in the identities table.
- You can sign in with either SIWE (wallet) or Google (via Firebase). Once signed in, you can link the other identity on the Settings page.

Data model
- users_v2(id TEXT PRIMARY KEY, created_at, display_name, email)
- identities(id INTEGER PK, user_id TEXT, provider TEXT, identifier TEXT, email, display_name, created_at)
  - provider ∈ { SIWE, GOOGLE } (more providers can be added later)
  - identifier is the unique identifier for the provider (EVM address for SIWE, Firebase UID for Google)
  - UNIQUE(provider, identifier) ensures an identity can belong to only one account
- Legacy tables users and nonces remain (users for reference; nonces used by SIWE flow)

JWTs
- Subject (sub) is the canonical user_id.
- Additional claims may include siwe_address, firebase_uid, email, auth_provider for convenience.
- Tokens are long-lived (default 365 days).

Endpoints
- GET /api/auth/nonce?address=0x...  (SIWE)
- POST /api/auth/verify  (SIWE): { message, signature } -> { token }
- POST /api/auth/google/verify (Google): { idToken } -> { token }
- GET /api/auth/identities (Auth): -> { identities: [{ provider, identifier, email, display_name, created_at }] }
- POST /api/auth/link/siwe (Auth): { message, signature } -> { success }
- POST /api/auth/link/google (Auth): { idToken } -> { success }
- POST /api/auth/logout: { success }

Client setup (Firebase)
1) Create a Firebase project in the console.
2) Enable Google as a sign-in provider.
3) Create a Web app and copy the config values.
4) Add the config to .env (Vite):
   - VITE_FIREBASE_API_KEY
   - VITE_FIREBASE_AUTH_DOMAIN
   - VITE_FIREBASE_PROJECT_ID
   - VITE_FIREBASE_APP_ID
5) In production, set FIREBASE_PROJECT_ID (Workers var) so the Worker can validate tokens.

Linking rules
- Identities cannot be unlinked (to avoid lockouts and complexity).
- Attempting to link an identity that belongs to a different user returns 409 with a clear error message.

Migration
- migrations/0002_dual_auth.sql introduces users_v2 and identities, and rewires FKs for headaches/events.
- Existing SIWE users are migrated by copying users.address -> users_v2.id and identities(provider=SIWE, identifier=address).
- Data backup/export should be done before running the migration.
