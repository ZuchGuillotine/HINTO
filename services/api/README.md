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

## Environment Contract

Supported environment variables:

- `API_HOST`
- `API_PORT`
- `API_LOG_LEVEL`
- `API_NAME`
- `NODE_ENV`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `AUTH_STATE_SECRET`
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
