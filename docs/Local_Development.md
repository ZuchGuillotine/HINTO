# HINTO Local Development

This document covers the current restart-era local development path for the shared backend, web shell, and SwiftUI app.

## Current Local Slice

Working local slice in this repo:

- `services/api`: profile, friends feed submissions/votes, situationship, media upload/storage, voting, moderation, AI, email/password auth, Apple native auth, and custom-provider routes
- `apps/web`: dependency-light JS shell for onboarding, profile, friends feed, situationship management, and voting smoke flows
- `apps/ios`: SwiftUI shell with local API base URL support, local development sign-in, email/password sign-in/sign-up, friends feed submission composer, profile editing, situationship wiring, image uploads, voting, and staged provider auth

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

- `DATABASE_URL`
- `API_HOST`
- `API_PORT`
- `API_CORS_ALLOW_ORIGIN`
- `ENABLE_DEVELOPMENT_AUTH`
- `DISABLE_EMAIL_OTP_DELIVERY`
- `AUTH_STATE_SECRET`
- `S3_MEDIA_BUCKET`
- `CLOUDFRONT_MEDIA_DOMAIN`
- `AWS_REGION`
- `SUPABASE_URL` or `PUBLIC_SUPABASE_URL` for transition fallback routes
- `SUPABASE_SERVICE_ROLE_KEY` for transition fallback routes
- `SUPABASE_ANON_KEY` or `PUBLIC_SUPABASE_ANON_KEY` for transition fallback routes

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

Current AWS/RDS status:

- production-oriented migrations live in [`db/migrations`](/Users/benjamincox/Downloads/HINTO/db/migrations)
- migrations `001` through `005` cover platform identity, product core, email/password auth, media assets, and friends feed submissions/votes
- local device testing can point `DATABASE_URL` at the RDS endpoint through the SSM tunnel on `127.0.0.1:15432`
- product routes should prefer the RDS repository path whenever `DATABASE_URL` is configured

Production infrastructure direction:

- Supabase remains a transition/local verification surface, not the production platform target.
- Production should use AWS RDS PostgreSQL through `DATABASE_URL`.
- Production deployment guidance lives in [`docs/AWS_Infrastructure_Plan.md`](/Users/benjamincox/Downloads/HINTO/docs/AWS_Infrastructure_Plan.md).
- RDS migrations currently include:
  - [`001_platform_identity.sql`](/Users/benjamincox/Downloads/HINTO/db/migrations/001_platform_identity.sql)
  - [`002_hinto_product_core.sql`](/Users/benjamincox/Downloads/HINTO/db/migrations/002_hinto_product_core.sql)
  - [`003_email_password_auth.sql`](/Users/benjamincox/Downloads/HINTO/db/migrations/003_email_password_auth.sql)
  - [`004_media_assets.sql`](/Users/benjamincox/Downloads/HINTO/db/migrations/004_media_assets.sql)
  - [`005_feed_submissions.sql`](/Users/benjamincox/Downloads/HINTO/db/migrations/005_feed_submissions.sql)

## Media And Feed Submission Path

Local image uploads use JSON-wrapped base64 bodies with a 5 MB raw image limit.
The API stores media in S3 when `S3_MEDIA_BUCKET` is set, using
`CLOUDFRONT_MEDIA_DOMAIN` for public URLs when present. Without an S3 bucket,
development uploads are written under `.hinto-media/` and served through
`GET /media-local/...`.

Current upload routes:

- `POST /v1/me/avatar`
- `POST /v1/me/situationships/:id/image`
- `POST /v1/me/feed/submissions/:id/image`

The friends feed is now explicit RDS-backed submission data, not a read-only
projection of friends' active situationships. The iOS Friends tab creates a feed
submission by selecting one of the user's existing situationships, adding text,
an image, or both, and choosing a voting window. The create route returns the
submission row, and the optional image upload updates the same submission with a
media asset URL.

Current feed routes:

- `GET /v1/me/feed`
- `POST /v1/me/feed/submissions`
- `POST /v1/me/feed/submissions/:id/image`
- `POST /v1/me/feed/submissions/:id/votes`

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
4. profile edit and avatar upload persist
5. situationship create/edit/delete/reorder and image upload persist
6. Friends `+` creates a feed submission from an existing situationship
7. optional feed submission image upload persists and appears in `GET /v1/me/feed`
8. feed voting persists and updates vote counts

Voting backend routes now exist in `services/api`, and the current web/SwiftUI shells now hit them for session creation, vote submission, session listing, and results. Friends feed submission voting is a separate authenticated feed route under `/v1/me/feed/submissions/:id/votes`.

## Legacy Expo Commands

The legacy Expo/React Native app is quarantined under `legacy/hnnt-app` for
salvage reference only. It is not part of the active lint target or default
startup path. Use explicit legacy commands only when inspecting that app:

```bash
npm run legacy:expo:start
npm run legacy:expo:ios
npm run legacy:expo:web
```
