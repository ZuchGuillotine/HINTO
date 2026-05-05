# HINTO Local Development

This document covers the current restart-era local development path for the shared backend, web shell, and SwiftUI app.

## Current Local Slice

Working local slice in this repo:

- `services/api`: profile and situationship routes, `.env` loading, local CORS, development session bootstrap
- `apps/web`: dependency-light JS shell for onboarding, profile, and situationship management
- `apps/ios`: SwiftUI shell with local API base URL support, local development sign-in, profile editing, and situationship wiring

Still staged:

- real provider auth flows beyond the local development bootstrap
- deeper voting navigation polish, browser/simulator verification, and AI flows

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
- `DISABLE_EMAIL_OTP_DELIVERY`

If `API_CORS_ALLOW_ORIGIN` is unset, the API defaults to `*` outside production.

`DISABLE_EMAIL_OTP_DELIVERY` defaults to enabled outside production. Local email
sign-in does not call Supabase SMTP; it creates or loads a confirmed development
session for the entered email. Set `DISABLE_EMAIL_OTP_DELIVERY=false` when
testing the real Supabase email OTP flow.

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

Use the `Use Local API` button to create or refresh the shared development profile through `POST /v1/dev/session`.

## Generate The iOS Project With Tuist

This repo now includes:

- `Project.swift`
- `Workspace.swift`
- `Tuist/Config.swift`

Generate the Xcode project:

```bash
npm run ios
```

The generated app target reads its default backend base URL from the `HINTOAPIBaseURL` Info.plist key.

Override the API base URL at runtime from Xcode by setting the `HINTO_API_BASE_URL` environment variable for the scheme if needed.

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
