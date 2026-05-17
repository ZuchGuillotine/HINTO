# HINTO Local Development

This document covers the current restart-era local development path for the shared backend, web shell, and SwiftUI app.

## Current Local Slice

Working local slice in this repo:

- `services/api`: profile, friends feed, situationship, voting, moderation, AI, email auth, and custom-provider routes
- `apps/web`: dependency-light JS shell for onboarding, profile, friends feed, situationship management, and voting smoke flows
- `apps/ios`: SwiftUI shell with local API base URL support, local development sign-in, sign-in/sign-up split, friends feed, profile editing, situationship wiring, voting, and staged provider auth

Still staged:

- provider app approval and portal callback registration for Snapchat, TikTok, and Meta
- Meta/Facebook backend provider routes
- deeper AI coach UI wiring beyond the current API route tests

## Local Ports

Defaults used by the current repo:

- API: `http://127.0.0.1:3000`
- Web: `http://127.0.0.1:3001`

For a physical iPhone, `127.0.0.1` points at the phone, not the Mac. Start the
API on all interfaces and point the Xcode scheme at the Mac's LAN IP:

```bash
npm run api:start:device
```

Then set the Xcode scheme environment variable:

```text
HINTO_API_BASE_URL=http://<your-mac-lan-ip>:3000
```

The iPhone and Mac must be on the same network.

## Environment

The API now loads the repo-root `.env` automatically when present.

Important environment variables for the current slice:

- `SUPABASE_URL` or `PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` or `PUBLIC_SUPABASE_ANON_KEY`
- `API_HOST`
- `API_PORT`
- `API_CORS_ALLOW_ORIGIN`
- `ENABLE_DEVELOPMENT_AUTH`
- `DISABLE_EMAIL_OTP_DELIVERY`
- `AUTH_STATE_SECRET`

If `API_CORS_ALLOW_ORIGIN` is unset, the API defaults to `*` outside production.

Development auth is fail-closed by default. Set `ENABLE_DEVELOPMENT_AUTH=true`
only for local testing when you need `/v1/dev/session`, `dev-session:*` bearer
tokens, or the local email OTP bypass.

`DISABLE_EMAIL_OTP_DELIVERY` defaults to `false`. To test local email auth
without SMTP, set both:

```text
ENABLE_DEVELOPMENT_AUTH=true
DISABLE_EMAIL_OTP_DELIVERY=true
```

In that mode `/v1/auth/email/otp` returns a development code and
`/v1/auth/email/verify` creates or loads an intent-aware development session.
Do not enable these values on a shared staging API.

For local Snapchat/TikTok provider testing, set `AUTH_STATE_SECRET` and provider
secrets. The API accepts these local aliases from the current `.env` shape:

- `SNAPCHAT_CLIENT_CONFIDENTIAL` or `SNAPCHAT_CLIENT_ID_PUBLIC`
- `SNAPCHAT_CLIENT_SECRET`
- `TIKTOK_CLIENT_ID_PUBLIC`
- `TIKTOK_CLIENT_SECRET`
- `META_APP_ID`
- `META_CLIENT_SECRET`

Outside production, Snapchat and TikTok callbacks default to:

- `http://localhost:3000/v1/auth/providers/snapchat/callback`
- `http://localhost:3000/v1/auth/providers/tiktok/callback`

Those callback URLs still need to be registered in the provider portals before
the browser/OAuth leg can complete.

Current remote Supabase status:

- migrations `001` through `011` are recorded in the remote migration table
- service-role PostgREST reads work against the expected product tables
- direct DB host resolution is unreliable from this machine; DB admin scripts should use the transaction pooler URL, not `SUPABASE_CONNECTION_STRING`
- the currently working pooler env var is named `SUPABQSE_TRANSACTION_POOLER`; keep that typo in mind until it is intentionally normalized
- API runtime code currently uses Supabase URL/key values, not the direct DB connection string

Production infrastructure direction:

- Supabase remains a transition/local verification surface, not the production platform target.
- Production should use AWS RDS PostgreSQL through `DATABASE_URL`.
- Production deployment guidance lives in [`docs/AWS_Infrastructure_Plan.md`](/Users/benjamincox/Downloads/HINTO/docs/AWS_Infrastructure_Plan.md).
- The first RDS/platform identity migration lives in [`db/migrations/001_platform_identity.sql`](/Users/benjamincox/Downloads/HINTO/db/migrations/001_platform_identity.sql).

## Start The API

Install JS dependencies if they are not present:

```bash
npm install
```

Build and run the API:

```bash
npm start
```

`npm start` is the restart-era API startup command. It no longer starts Expo.

For physical-device testing from Xcode, run:

```bash
npm run api:start:device
```

The API writes JSON logs to stdout. A successful startup prints a
`server_started` record, and every request prints a `request_completed` record
with `requestId`, path, method, status code, and duration.

## Start The Web Shell

The web shell does not need a framework-specific install beyond the repo dependencies.

Run:

```bash
npm run web
```

Then open:

```text
http://127.0.0.1:3001
```

Use the `Use Local API` button to create or refresh the shared development profile through `POST /v1/dev/session`. This requires `ENABLE_DEVELOPMENT_AUTH=true`.

## Generate The iOS Project With Tuist

This repo now includes:

- `Project.swift`
- `Workspace.swift`
- `Tuist/Config.swift`

Generate the Xcode project:

```bash
npm run ios
```

The Swift client reads `HINTO_API_BASE_URL` from the Xcode scheme environment
when present. If unset, debug builds fall back to `http://127.0.0.1:3000`; set
the scheme variable to your Mac LAN IP for physical-device testing.

## Run The SwiftUI App

After `tuist generate`, open the generated workspace or project in Xcode and run the `HINTO` app target.

In debug builds:

- `Use Local API` creates a real local development session through the API
- `Preview Mode` preserves the old fully local mock path when the API is unavailable

## Verification Targets

The current verification goal is:

1. API starts with local `.env`
2. web shell loads at `127.0.0.1:3001`
3. `Use Local API` works in web and SwiftUI
4. profile edit persists
5. situationship create/edit/delete/reorder persists

Voting backend routes now exist in `services/api`, and the current web/SwiftUI shells now hit them for session creation, vote submission, session listing, and results. Browser and simulator verification are still follow-up work.

## Legacy Expo Commands

The legacy Expo/React Native app is still in the repo for reference, but it is
not the default startup path. Use explicit legacy commands only when inspecting
that app:

```bash
npm run legacy:expo:start
npm run legacy:expo:ios
npm run legacy:expo:web
```
