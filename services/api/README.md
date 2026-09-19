# HINTO API

This directory contains the restart-era backend for the shared HINTO web and SwiftUI clients.

Current scope:

- versioned HTTP surface rooted at `/v1`
- environment/config loading
- structured JSON logging
- request ID assignment and propagation
- stable application error shape
- health route
- email OTP and refresh auth helpers
- custom provider auth start/callback helpers for TikTok and Snapchat
- `GET /v1/me` and `PATCH /v1/me`
- situationship CRUD and reorder routes
- voting session create/expire/public-view routes
- public vote submission and owner-facing results routes

Still out of scope:

- AI routes and prompt orchestration
- report/block moderation routes
- fully automated migration verification and DB-backed integration tests

Current provider-auth status:

- Apple and Meta/Facebook are still expected to use Supabase-managed auth where practical
- TikTok custom backend OAuth is wired and bootstraps a normal Supabase session after callback success
- Snapchat custom backend OAuth start/callback routing is scaffolded, but canonical-session completion still needs the provider external ID handshake finalized

## API Style

The scaffold assumes:

- explicit HTTP JSON endpoints
- OpenAPI-friendly request and response shapes
- business logic organized behind route handlers and services

This intentionally avoids:

- tRPC as the contract foundation
- direct reuse of Amplify GraphQL models
- client-specific branching

## Route Layout

- `GET /health`
- `GET /v1/health`
- `GET /v1`
- `GET /v1/me`
- `PATCH /v1/me`
- `POST /v1/dev/session`
- `POST /v1/auth/email/otp`
- `POST /v1/auth/email/verify`
- `POST /v1/auth/refresh`
- `POST /v1/auth/providers/:provider/start`
- `GET /v1/auth/providers/:provider/callback`
- `GET /v1/me/situationships`
- `POST /v1/me/situationships`
- `PATCH /v1/me/situationships/:id`
- `DELETE /v1/me/situationships/:id`
- `PUT /v1/me/situationships/order`
- `POST /v1/me/voting-sessions`
- `POST /v1/me/voting-sessions/:id/expire`
- `GET /v1/me/voting-sessions/:id/results`
- `GET /v1/voting-sessions/:inviteCode`
- `POST /v1/voting-sessions/:inviteCode/votes`
- `POST /v1/auth/apple` (Apple identity token exchange)
- `DELETE /v1/me` (account deletion; cascades to all owned rows)
- `POST /v1/reports`
- `GET|POST /v1/me/blocks`, `DELETE /v1/me/blocks/:profileId`
- `GET|POST /v1/me/ai/conversations`
- `GET|POST /v1/me/ai/conversations/:id/messages`
- `POST /v1/dev/session` (only when `API_ENABLE_DEV_AUTH=true`)

## Environment Contract

See `/.env.example` for the full annotated list. The server refuses to start
when `SUPABASE_URL`, `SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` is
missing, when `API_ENABLE_DEV_AUTH` is set with `NODE_ENV=production`, or when
production CORS is a wildcard.

- `API_HOST` (default `127.0.0.1`, `0.0.0.0` in production)
- `API_PORT` or `PORT`
- `API_LOG_LEVEL`
- `API_NAME`
- `API_CORS_ALLOW_ORIGIN` (comma separated exact origins)
- `API_ENABLE_DEV_AUTH` (local development only)
- `NODE_ENV`
- `PUBLIC_WEB_BASE_URL`, `PUBLIC_API_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`, `OPENAI_MODEL`, `AI_DAILY_MESSAGE_LIMIT_FREE`, `AI_DAILY_MESSAGE_LIMIT_PREMIUM`
- `AUTH_STATE_SECRET`
- `AUTH_ALLOWED_REDIRECT_URIS` (required for Snapchat/TikTok flows)
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`
- `TIKTOK_SCOPES`
- `SNAPCHAT_CLIENT_ID`
- `SNAPCHAT_CLIENT_SECRET`
- `SNAPCHAT_REDIRECT_URI`
- `SNAPCHAT_SCOPES`

The current routes use the Supabase values for auth, profile, situationship, and voting access.

## Error Envelope

Errors use a machine-readable JSON envelope:

```json
{
  "error": {
    "code": "internal_error",
    "message": "Unexpected server error",
    "requestId": "..."
  }
}
```

Successful health-style responses currently use:

```json
{
  "data": {
    "...": "..."
  },
  "meta": {
    "requestId": "..."
  }
}
```

## Logging

All logs are JSON and include:

- timestamp
- level
- service name
- request ID when available

## Local Use

Build:

```bash
npm run api:build
```

Run:

```bash
npm run api:start
```

Dev watch:

```bash
npm run api:watch
```

## Supabase Client Rules

- `getServiceClient` is a pinned service-role client for data access and `auth.admin.*`.
- `getAuthClient` returns a fresh anon client per call and is the only client that may run `verifyOtp`, `refreshSession`, `signInWithOtp`, or `signInWithIdToken`. Running those on the service client stores a user session that then leaks into every later query.

## Deployment

- Container: `docker build -f services/api/Dockerfile -t hinto-api .` from the repo root. The image runs `node services/api/dist/server.js` as a non-root user and exposes `/health`.
- Any PaaS that sets `PORT` works unchanged. Set `NODE_ENV=production`, the three Supabase variables, `API_CORS_ALLOW_ORIGIN`, and `PUBLIC_WEB_BASE_URL`.
- CI: `.github/workflows/ci.yml` builds, lints, tests, and builds the image on every push and pull request.
- Database: apply `supabase/migrations/*.sql` in order. `012_launch_hardening.sql` is required by the reorder route and by the RLS fixes; it is idempotent.
