# HINTO Canonical Architecture

*Created: 2026-03-27*

## Decision Summary

HINTO will be rebuilt around:

- `AWS RDS PostgreSQL` as the production database
- `HINTO-owned platform auth` as the base authentication/session system
- `S3 + CloudFront` for media and share assets
- `ECS Express Mode on Fargate` for the TypeScript API container
- `S3 + CloudFront` for static web distribution
- `SES` for email and transactional notifications
- a `TypeScript API service` as the shared backend layer
- a `web app` that consumes the shared API
- a `native SwiftUI iOS app` that consumes the same shared API

The current AWS Amplify, Cognito, AppSync, Supabase Auth, Supabase Storage, and Expo-first architecture is legacy or transition-only and should not be expanded for production.

## Why This Architecture

This is the lowest-complexity path that still supports:

- one shared backend for both web and iOS
- a database-centered model that is easy to evolve
- explicit API contracts that Swift and web can both consume
- replacement of Cognito/AppSync/Supabase Auth without carrying their constraints forward
- future shared identity and consent primitives for HINTO plus later wellness apps such as MicrosTracker

## High-Level Layout

```text
/apps
  /ios          # Native SwiftUI app
  /web          # Web client
/services
  /api          # TypeScript backend service
/packages
  /domain       # Shared business rules and validation
  /contracts    # OpenAPI schemas / DTOs / generated client types
  /prompts      # AI prompt logic and moderation rules
/docs
/legacy
```

## Backend Shape

The backend should not be “database direct from every client.”

Instead:

- RDS Postgres is the production data foundation
- S3 is the production media foundation
- HINTO-owned platform auth is the production identity/session foundation
- the TypeScript API becomes the stable application boundary
- both clients talk to the API for business operations
- direct client access to database/storage policy should be limited and intentional

This reduces duplication and keeps behavior consistent across:

- auth/account creation
- profile and privacy rules
- situationship CRUD and reorder logic
- voting session creation and vote handling
- Rank feed submissions, repeated friend votes, aggregate scoring, and
  per-comment author vote badges
- AI chat quotas, moderation, and persistence
- report/block flows

## Auth Strategy

### Base Auth

Use HINTO-owned platform auth as the identity backbone and canonical session system.

### Required Social Auth

Apple auth is required.

Meta/Facebook login is required for the Instagram-discovery use case.

Snapchat and TikTok login are also in scope, but they should be treated as provider integrations layered onto the same canonical identity model.

Important clarification:

- We do not need Instagram data access for MVP.
- We do not need Instagram as a separate data integration target.
- We do need an easy login path for users who may know the product from Instagram.

The implementation should be treated as a backend-owned capability, not scattered per client and not delegated to Cognito or Supabase Auth for production.

Recommended pattern:

1. Client starts provider sign-in flow.
2. Backend-owned provider logic handles token exchange and identity resolution.
3. Backend resolves or provisions the platform user identity.
4. Backend maps that platform user to the HINTO app user.
5. Backend issues a short-lived HINTO access token and a hashed refresh session.
6. Provider-specific account linkage is stored in platform-owned tables, not treated as the sole identity record.

This matters because:

- provider support differs across Instagram, Snapchat, and TikTok
- mobile and web callback behavior differ
- client-only provider logic would create duplicate auth complexity

The backend auth layer should support:

- one canonical platform user record regardless of sign-in method
- HINTO-specific app-user mapping
- provider account linking
- provider token refresh handling if required
- normalized user profile mapping
- graceful fallback to email/passwordless or other supported sign-in methods

The backend should make one explicit distinction:

- `authentication` is how the user proves identity
- `provider linkage` is how external social accounts are associated with that user

Those should not be conflated with “import Instagram data,” which is not required for MVP.

## API Style

Use explicit HTTP JSON endpoints with OpenAPI-defined contracts.

Do not make tRPC the core contract layer.

Why:

- Swift benefits from explicit HTTP contracts
- web can consume the same contracts cleanly
- backend behavior stays decoupled from frontend framework choices

## Database Baseline

Use the donor Supabase schema as historical schema input, but normalize production migrations into RDS/Postgres. The HINTO app-domain baseline remains:

- `profiles`
- `situationships`
- `voting_sessions`
- `votes`
- `ai_conversations`
- `ai_messages`
- `blocks`
- `reports`
- `daily_usage`

Optional/later baseline entities from the donor repo:

- `friendships`
- `contacts`
- `friend_groups`
- `images`
- `image_attachments`

These should be validated against MVP scope before full adoption.

The current RDS-backed Rank feed voting path uses explicit feed submission
tables in addition to the legacy/public voting-session tables:

- `feed_submissions`
- `feed_submission_votes`
- `feed_submission_comments`

That path is documented in
[`docs/Friends_Feed_Voting.md`](/Users/benjamincox/Downloads/HINTO/docs/Friends_Feed_Voting.md).

Shared platform identity tables are now tracked separately in
[`db/migrations/001_platform_identity.sql`](/Users/benjamincox/Downloads/HINTO/db/migrations/001_platform_identity.sql):

- `platform_users`
- `app_users`
- `auth_identities`
- `auth_sessions`
- `auth_login_events`
- `oauth_states`
- `email_magic_links`
- `user_consents`
- `data_sharing_grants`

## AWS Distribution

Use the AWS plan in [`docs/AWS_Infrastructure_Plan.md`](/Users/benjamincox/Downloads/HINTO/docs/AWS_Infrastructure_Plan.md) as the production deployment source of truth.

Production distribution:

- API: ECS Express Mode on Fargate, image stored in ECR
- Database: RDS PostgreSQL, Single-AZ for MVP
- Web: S3 + CloudFront static distribution
- Media: S3 + CloudFront with API-issued presigned operations
- Email: SES
- Secrets/config: SSM Parameter Store by default, Secrets Manager when rotation/audit needs justify it
- Accounts: existing AWS Organization with separate `hinto-prod` and `shared-platform-prod` member accounts where practical

## iOS Direction

Use a fresh SwiftUI app under `/apps/ios`.

Reason:

- the existing `ios/` code in this repo is an Expo/React Native container
- it is not meaningful native product logic
- reshaping that shell into the target architecture would add migration overhead without real benefit

The current `ios/` directory can remain as reference material until replacement work is far enough along to archive it.

## Web Direction

Default to Next.js unless a clear reason emerges to choose otherwise.

The web app should be:

- first-class, not an afterthought
- built against the same contracts as iOS
- able to support both user-facing flows and simple internal/admin workflows

## Legacy Policy

Legacy code should be kept only if it does one of these:

- saves real engineering time
- contains durable business logic
- preserves product behavior that would be costly to rediscover

Otherwise:

- archive it
- move it under `/legacy`
- or delete it after replacements exist

## Immediate Implementation Priorities

1. Preserve the donor Supabase schema as transition/history while normalizing production migrations under `db/migrations`.
2. Containerize `/services/api` for ECS Express Mode.
3. Build the RDS-backed platform auth/session layer for Apple, Meta/Facebook, Snapchat, TikTok, and email fallback.
4. Replace Supabase client persistence with repository access through `DATABASE_URL`.
5. Implement or preserve the first backend slice:
   - profile
   - situationships
   - reorder logic
6. Build web and iOS against that slice before expanding into voting and AI.
