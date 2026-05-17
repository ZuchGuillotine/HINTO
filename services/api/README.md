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
- `GET /v1/me/feed`
- situationship CRUD and reorder routes
- voting session create/expire/public-view routes
- public vote submission and owner-facing results routes
- report/block moderation routes
- AI conversation/message routes backed by `@hinto/prompts`
- container build support for the AWS ECS Express Mode production path

Still out of scope:

- fully automated migration verification and DB-backed integration tests
- full replacement of Supabase data/session calls with the RDS-backed repository layer

Current provider-auth status:

- Production direction is platform-owned auth backed by RDS/Postgres, not Supabase Auth or Cognito
- Apple, Meta/Facebook, TikTok, and Snapchat should all be backend-owned provider flows
- Existing Supabase-backed route code remains a transition implementation until the RDS repository/session layer replaces it

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
- `GET /v1/me/feed`
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
- `GET /v1/me/blocks`
- `POST /v1/me/blocks`
- `DELETE /v1/me/blocks/:blockedProfileId`
- `POST /v1/reports`
- `GET /v1/me/conversations`
- `POST /v1/me/conversations`
- `GET /v1/me/conversations/:id`
- `DELETE /v1/me/conversations/:id`
- `POST /v1/me/conversations/:id/messages`

## Environment Contract

Supported environment variables:

- `API_HOST`
- `API_PORT`
- `API_LOG_LEVEL`
- `API_NAME`
- `NODE_ENV`
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENABLE_DEVELOPMENT_AUTH`
- `AWS_REGION`
- `S3_MEDIA_BUCKET`
- `S3_WEB_BUCKET`
- `CLOUDFRONT_MEDIA_DOMAIN`
- `SES_FROM_EMAIL`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `JWT_ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_PEPPER`
- `OPENAI_API_KEY`
- `DISABLE_EMAIL_OTP_DELIVERY`
- `AUTH_STATE_SECRET`
- `APPLE_CLIENT_ID` defaults to `app.hnnt` for the native iOS app
- `APPLE_TEAM_ID` defaults to `432862NB9P`
- `APPLE_KEY_ID` defaults to `U5L7DR4AND`
- `APPLE_PRIVATE_KEY` or `APPLE_PRIVATE_KEY_FILE`; local development defaults to `AuthKey_U5L7DR4AND.p8` when present
- `META_CLIENT_ID`
- `META_APP_ID`
- `META_CLIENT_SECRET`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_ID_PUBLIC`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`
- `TIKTOK_SCOPES`
- `SNAPCHAT_CLIENT_ID`
- `SNAPCHAT_CLIENT_CONFIDENTIAL`
- `SNAPCHAT_CLIENT_ID_PUBLIC`
- `SNAPCHAT_CLIENT_SECRET`
- `SNAPCHAT_REDIRECT_URI`
- `SNAPCHAT_SCOPES`

The current routes still use the Supabase values for transition-era auth, profile,
situationship, voting, moderation, and AI conversation persistence. Production
deployment should use `DATABASE_URL` and the RDS-backed repository/session layer
once that replacement work lands.

For local development, `ENABLE_DEVELOPMENT_AUTH` defaults to `false` and
`DISABLE_EMAIL_OTP_DELIVERY` defaults to `false`. Set both to `true` only for a
private local API when you want `/v1/dev/session`, `dev-session:*` bearer tokens,
or the local email OTP bypass. Shared staging should leave the development auth
gate disabled.

Custom provider auth requires `AUTH_STATE_SECRET`. Outside production, Snapchat
and TikTok redirect URIs default to localhost callbacks when the explicit env
vars are absent, but the same URIs must still be registered in the provider
developer portals before OAuth can complete.

The AWS production target uses RDS PostgreSQL through `DATABASE_URL`. Supabase
connection settings are retained for local/prototype compatibility until the
RDS-backed data layer fully replaces them.

## Container Use

Build from the repo root:

```bash
docker build -t hinto-api:local .
```

Run locally:

```bash
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e API_HOST=0.0.0.0 \
  -e API_PORT=3000 \
  hinto-api:local
```

Production deployment guidance lives in
[`docs/AWS_Infrastructure_Plan.md`](/Users/benjamincox/Downloads/HINTO/docs/AWS_Infrastructure_Plan.md)
and [`infra/aws/README.md`](/Users/benjamincox/Downloads/HINTO/infra/aws/README.md).

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
npm start
```

`npm start` runs the restart-era API. It does not start Expo.

Run for physical iPhone testing from Xcode:

```bash
npm run api:start:device
```

This binds the API to `0.0.0.0` and enables debug-level logging. Set the Xcode
scheme environment variable `HINTO_API_BASE_URL` to
`http://<your-mac-lan-ip>:3000`.

Dev watch:

```bash
npm run dev
```
