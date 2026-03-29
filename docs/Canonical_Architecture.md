# HINTO Canonical Architecture

*Created: 2026-03-27*

## Decision Summary

HINTO will be rebuilt around:

- `Supabase Postgres` as the primary database
- `Supabase Auth` as the base authentication system
- `Supabase Storage` for media and share assets
- a `TypeScript API service` as the shared backend layer
- a `web app` that consumes the shared API
- a `native SwiftUI iOS app` that consumes the same shared API

The current AWS Amplify, Cognito, AppSync, and Expo-first architecture is legacy and should not be expanded.

## Why This Architecture

This is the lowest-complexity path that still supports:

- one shared backend for both web and iOS
- a database-centered model that is easy to evolve
- explicit API contracts that Swift and web can both consume
- replacement of Cognito/AppSync without carrying their constraints forward

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

The backend should not be “Supabase direct from every client.”

Instead:

- Supabase remains the data/auth/storage foundation
- the TypeScript API becomes the stable application boundary
- both clients talk to the API for business operations
- direct client-to-Supabase access should be limited and intentional

This reduces duplication and keeps behavior consistent across:

- auth/account creation
- profile and privacy rules
- situationship CRUD and reorder logic
- voting session creation and vote handling
- AI chat quotas, moderation, and persistence
- report/block flows

## Auth Strategy

### Base Auth

Use Supabase Auth as the identity backbone and canonical session system where provider support exists.

### Required Social Auth

Apple auth is required.

Meta/Facebook login is required for the Instagram-discovery use case.

Snapchat and TikTok login are also in scope, but they should be treated as provider integrations layered onto the same canonical identity model.

Important clarification:

- We do not need Instagram data access for MVP.
- We do not need Instagram as a separate data integration target.
- We do need an easy login path for users who may know the product from Instagram.

That means the auth design should prefer:

- built-in Supabase Auth providers where available
- backend-owned provider integration where Supabase does not natively cover the provider

The implementation should be treated as a backend-owned capability, not scattered per client.

Recommended pattern:

1. Client starts provider sign-in flow.
2. Use Supabase Auth directly for supported providers such as Apple and Meta/Facebook where practical.
3. For unsupported providers such as Snapchat or TikTok, backend-owned provider logic handles token exchange and identity resolution.
4. Backend resolves or provisions the HINTO user identity.
5. Supabase-backed session/user mapping becomes the canonical app identity.
6. Provider-specific account linkage is stored in app-owned tables, not treated as the sole identity record.

This matters because:

- provider support differs across Instagram, Snapchat, and TikTok
- Supabase provider support is uneven across the required providers
- mobile and web callback behavior differ
- client-only provider logic would create duplicate auth complexity

The backend auth layer should support:

- one canonical HINTO user record regardless of sign-in method
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

Use the donor Supabase schema as the baseline for analysis and likely initial import:

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

1. Normalize the donor Supabase schema into the restart plan.
2. Scaffold `/services/api`, `/packages/domain`, and `/packages/contracts`.
3. Build auth/session handling around Supabase Auth plus provider-linking logic for Apple, Meta/Facebook, Snapchat, and TikTok.
4. Implement the first backend slice:
   - profile
   - situationships
   - reorder logic
5. Build web and iOS against that slice before expanding into voting and AI.
