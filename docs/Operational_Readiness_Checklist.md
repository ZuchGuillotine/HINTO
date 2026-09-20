# HINTO Operational Readiness Checklist

This checklist is for collaborators moving between local manual testing,
staging deployment, and distribution readiness. It reflects the current
restart-era path: native Swift iOS, static web shell, TypeScript HTTP API, AWS
RDS PostgreSQL, and S3/CloudFront media.

## A. Required For Local Testing

### API And Database

- Install dependencies from the repo root:

```bash
npm install
```

- Build the API before starting a local server:

```bash
npm run api:build
```

- For normal simulator testing, the API can run on loopback:

```bash
npm start
```

- For physical iPhone testing, the API must bind to all interfaces:

```bash
npm run api:start:device
```

- For physical iPhone testing, the Xcode scheme must set:

```text
HINTO_API_BASE_URL=http://<mac-lan-hostname-or-ip>:3000
```

Current working local value used during manual testing:

```text
HINTO_API_BASE_URL=http://Benjamins-MacBook-Pro-2.local:3000
```

Do not use `127.0.0.1` on a physical phone. On-device, `127.0.0.1` points at
the phone, not the Mac.

### RDS Access Through SSM Tunnel

Local database-backed testing uses the staging RDS database through an SSM port
forward. The current tunnel maps local `127.0.0.1:15432` to the staging RDS
Postgres endpoint from inside the VPC.

Current tunnel command:

```bash
aws ssm start-session \
  --target i-03f1f728e98dee1cd \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["hinto-staging-db.clcggkmq0zdo.us-west-2.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["15432"]}' \
  --profile HNNT \
  --region us-west-2
```

The API should use the staging `DATABASE_URL` secret with host/port rewritten to
`127.0.0.1:15432`. Example local start pattern:

```bash
DB_URL=$(aws secretsmanager get-secret-value \
  --secret-id /hinto/staging/api/DATABASE_URL \
  --query SecretString \
  --output text \
  --profile HNNT \
  --region us-west-2)

DB_URL_LOCAL=$(DB_URL="$DB_URL" node -e 'const u = new URL(process.env.DB_URL); u.hostname = "127.0.0.1"; u.port = "15432"; console.log(u.toString())')

DATABASE_URL="$DB_URL_LOCAL" \
ENABLE_DEVELOPMENT_AUTH=true \
DISABLE_EMAIL_OTP_DELIVERY=true \
API_HOST=0.0.0.0 \
API_LOG_LEVEL=debug \
node services/api/dist/server.js
```

Local screen sessions used during testing:

- `hinto-rds-tunnel` for the SSM tunnel
- `hinto-api-rds` for the API process

Check them with:

```bash
screen -ls
```

### Local Auth And Media

- Local development auth requires:

```text
ENABLE_DEVELOPMENT_AUTH=true
```

- Local no-email OTP testing additionally requires:

```text
DISABLE_EMAIL_OTP_DELIVERY=true
```

- Do not enable those two values on shared staging or production APIs.

- If `S3_MEDIA_BUCKET` is unset, uploads are stored under `.hinto-media/` and
served through:

```text
GET /media-local/...
```

- If `S3_MEDIA_BUCKET` is set, uploads go to S3 and public URLs should use
`CLOUDFRONT_MEDIA_DOMAIN` when configured.

### Local Smoke Routes

At minimum, verify:

```bash
curl -sS http://127.0.0.1:3000/health
curl -sS http://127.0.0.1:3000/v1
```

For physical phone testing, use the same host as the Xcode scheme:

```bash
curl -sS http://Benjamins-MacBook-Pro-2.local:3000/health
```

Current feed/media routes expected in `/v1` discovery:

- `POST /v1/me/avatar`
- `POST /v1/me/situationships/:id/image`
- `GET /v1/me/feed`
- `POST /v1/me/feed/submissions`
- `POST /v1/me/feed/submissions/:id/image`
- `POST /v1/me/feed/submissions/:id/votes`

## B. Required Hardening Before Distribution

### API And Database

- Apply all production migrations under `db/migrations` to the target RDS
database:
  - `001_platform_identity.sql`
  - `002_hinto_product_core.sql`
  - `003_email_password_auth.sql`
  - `004_media_assets.sql`
  - `005_feed_submissions.sql`
- Confirm the ECS task uses the production/staging `DATABASE_URL` directly, not
the local tunnel rewrite.
- Confirm `ENABLE_DEVELOPMENT_AUTH=false` or unset.
- Confirm `DISABLE_EMAIL_OTP_DELIVERY=false` or unset.
- Confirm API CORS is restricted to the intended web origin:

```text
API_CORS_ALLOW_ORIGIN=https://hnnt.app
```

- Confirm API is reachable only through HTTPS in deployed environments.
- Confirm CloudWatch logs are landing for API request logs and startup errors.
- Add alarms for repeated 5xx responses, ECS task rollback/failure, and RDS
storage/connection pressure.

### Auth

- Rotate any private keys that were ever pasted into chat or exposed outside a
secret store.
- Move the Apple `.p8` key into Secrets Manager or another approved secret
source.
- Confirm `APPLE_PRIVATE_KEY` or `APPLE_PRIVATE_KEY_FILE` exists in the deployed
runtime environment.
- Confirm Apple Sign in entitlement and bundle ID match:

```text
APPLE_CLIENT_ID=app.hnnt
APNS_BUNDLE_ID=app.hnnt
```

- Register production and staging callback URLs in Apple, Meta/Facebook,
Snapchat, and TikTok developer portals before enabling those flows publicly.
- Keep Meta/Facebook marked blocked until backend provider routes and portal
approval are complete.
- Confirm refresh-token rotation and session expiration behavior before
TestFlight distribution beyond the team.

### Media

- Configure `S3_MEDIA_BUCKET` for staging/prod.
- Configure `CLOUDFRONT_MEDIA_DOMAIN` before public distribution.
- Ensure S3 bucket public access posture matches the intended media model.
- Confirm media upload size limits are acceptable for profile, situationship,
and feed submission images.
- Confirm local `.hinto-media/` is never used in deployed environments.

### iOS

- Confirm release/TestFlight builds use:

```text
https://api.hnnt.app
```

or an intentional staging API base URL for team-only TestFlight.

- Remove any developer-only scheme variables before App Store/TestFlight builds
unless they are intentionally part of a staging build configuration.
- Verify physical-device image picker permissions and upload flow.
- Verify email/password sign-up and sign-in on a fresh install.
- Verify Apple Sign in on a physical device with the correct team/bundle
configuration.
- Verify feed submission create, image upload, and vote flow from a fresh user.
- Verify legal links, privacy policy, terms, and support/contact information are
present before public distribution.

### Web

- Confirm the static web build points at the intended API base URL.
- Confirm the web app is hosted on a non-publicly-linked subdomain or path if it
is not meant to be navigable from the landing page.
- Confirm CloudFront/S3 cache invalidation process for web releases.
- Confirm `hnnt.app` landing page does not link to the app surface until that is
intentional.

## C. Variables And API Asset Status

| Item | Local Testing Status | Staging/Production Requirement | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Required for RDS-backed routes; use SSM tunnel rewrite to `127.0.0.1:15432` | Store as `/hinto/staging/api/DATABASE_URL` and production equivalent | Do not commit raw database URLs |
| `API_HOST` | `0.0.0.0` for physical-device testing | `0.0.0.0` in container | Loopback-only server will not be reachable from phones |
| `API_PORT` | Defaults to `3000` | `3000` unless ECS task changes | ALB target group expects HTTP/3000 |
| `API_CORS_ALLOW_ORIGIN` | Can be omitted locally | `https://hnnt.app` for current production web origin | Add staging origin if using a separate staging web host |
| `ENABLE_DEVELOPMENT_AUTH` | `true` only for local testing | unset or `false` | Gates `/v1/dev/session` and dev bearer tokens |
| `DISABLE_EMAIL_OTP_DELIVERY` | `true` only for local OTP bypass testing | unset or `false` | Never enable on shared staging/prod |
| `AUTH_STATE_SECRET` | Required for local OAuth provider state | Required secret | Needed by provider start/callback flows |
| `JWT_ACCESS_TOKEN_SECRET` | Required for platform JWT sessions outside pure dev fallback | Required secret | Must be long, random, and environment-specific |
| `REFRESH_TOKEN_PEPPER` | Required for refresh token hashing | Required secret | Rotate carefully; invalidates refresh tokens |
| `APPLE_CLIENT_ID` | Defaults to `app.hnnt` | Required/verify | Native bundle ID must match Apple portal |
| `APPLE_TEAM_ID` | Defaults to `432862NB9P` | Required/verify | Current Apple team ID |
| `APPLE_KEY_ID` | Defaults to `U5L7DR4AND` | Required/verify | Current key ID |
| `APPLE_PRIVATE_KEY` / `APPLE_PRIVATE_KEY_FILE` | Local file fallback can read `AuthKey_U5L7DR4AND.p8` | Must live in secret storage | Rotate if exposed; do not commit `.p8` |
| `S3_MEDIA_BUCKET` | Optional; unset uses `.hinto-media/` | Required for deployed media | Feed/profile/situationship images use this |
| `CLOUDFRONT_MEDIA_DOMAIN` | Optional locally | Required for stable public media URLs | Prefer CloudFront URLs over raw S3 URLs |
| `S3_WEB_BUCKET` | Not needed for local web dev | Required for static web deployment | Used by deployment workflow/IaC |
| `SES_FROM_EMAIL` | Not needed when OTP delivery disabled | Required before real email delivery | Must pass SES/domain verification |
| `OPENAI_API_KEY` | Required only for live AI route testing | Required if AI coach is enabled | Keep AI routes gated if key absent |
| `SNAPCHAT_CLIENT_ID` / `SNAPCHAT_CLIENT_SECRET` | Optional until provider flow testing | Required before enabling Snapchat | Portal approval/callback registration still external |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | Optional until provider flow testing | Required before enabling TikTok | Callback URI must match portal |
| `META_CLIENT_ID` / `META_CLIENT_SECRET` | Present as config shape only | Required after backend routes exist | Meta/Facebook route implementation remains pending |
| `HINTO_API_BASE_URL` | Xcode scheme override for device testing | Release builds should use `https://api.hnnt.app` or intentional staging URL | Do not point TestFlight production build at local/LAN URL |

## Current API Asset Status

| Surface | Status | Production Gate |
| --- | --- | --- |
| Email/password sign-up and sign-in | Works in local/API path | Confirm SES/email delivery posture or intentionally keep password-only |
| Email OTP | Works with local delivery disabled | Configure real delivery before using OTP with users |
| Apple native sign-in route | Implemented | Verify secret storage, key rotation, bundle/team ID, and device flow |
| Snapchat/TikTok provider start/callback | Local-ready code path | Requires portal callback registration and app approval |
| Meta/Facebook auth | Not complete | Backend provider routes and portal approval required |
| Profile avatar upload | Implemented | Requires S3/CloudFront in deployed env |
| Situationship image upload | Implemented | Requires S3/CloudFront in deployed env |
| Friends feed submission image upload | Implemented | Requires S3/CloudFront in deployed env |
| Friends feed submission voting | Implemented | Needs friend graph/user acceptance testing at scale |
| Web app subdomain deployment | Build path exists | Confirm target subdomain/path, CloudFront behavior, and no landing-page navigation |
| Team-only TestFlight | Build path exists | Confirm API base URL, Apple auth entitlements, legal links, and no dev auth |

