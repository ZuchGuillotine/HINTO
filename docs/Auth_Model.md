# HINTO Auth Model

*Created: 2026-03-27*

## Purpose

This document defines the restart-era auth model for HINTO.

It is intended to remove ambiguity before backend scaffolding begins.

## Auth Principles

- There must be one canonical HINTO user identity.
- Authentication method and social-account linkage are separate concerns.
- HINTO-owned platform auth is the canonical user/session backbone.
- Use backend-owned provider integration for Apple, Meta/Facebook, Snapchat, and TikTok.
- Do not use Cognito or Supabase Auth as the production session issuer.
- iOS and web must share the same identity model even if provider UX differs by platform.

## Canonical Identity Model

There are three layers:

1. `platform_users`
   The canonical authenticated user record managed by the HINTO platform.

2. `app_users`
   The mapping between a platform user and a product-specific user record, such as the HINTO profile owner.

3. `profiles`
   The HINTO application profile record.

4. `auth_identities`
   App-owned linkage records that describe which providers are attached to the user.

The donor schema already includes useful profile and provider-linkage concepts, but production should normalize them into RDS/Postgres tables independent of Supabase Auth.

## Supported Sign-In Methods

Base methods:

- Apple
- Meta/Facebook
- email magic link or comparable passwordless flow

Additional provider integrations in scope:

- Snapchat
- TikTok

Explicitly not required for MVP:

- Instagram data import
- Instagram as a separate social-data integration

## Session Model

Canonical session behavior:

- the API issues short-lived HINTO access tokens
- refresh sessions are stored as hashes in Postgres
- clients hold the canonical authenticated HINTO session
- the TypeScript API validates the incoming HINTO token on every authenticated request
- the API resolves the platform user, then the HINTO app user

The API should not mint provider-specific user systems. Provider accounts link into the platform user identity.

## Database Baseline

Production baseline:

- `platform_users`
- `app_users`
- `auth_identities`
- `auth_sessions`
- `auth_login_events`
- `oauth_states`
- `email_magic_links`
- `user_consents`
- `data_sharing_grants`
- HINTO app-domain tables such as `profiles` and `daily_usage`

Existing app-domain tables already key to `profiles.id` or should continue to key to the HINTO app user/profile:

- `situationships.user_id`
- `voting_sessions.owner_id`
- `votes.voter_id`
- `ai_conversations.user_id`
- `blocks.blocker_id`
- `blocks.blocked_id`
- `reports.reporter_id`
- `reports.reported_user_id`
- `daily_usage.user_id`

This means the donor schema already assumes one canonical user ID across the product, which aligns with the restart direction.

## New Tables Required

### `public.auth_identities`

Purpose:

- normalize provider linkage across Apple, Meta/Facebook, Snapchat, TikTok, and email/passwordless

Suggested fields:

- `id uuid primary key`
- `user_id uuid not null references public.profiles(id) on delete cascade`
- `provider text not null`
- `provider_user_id text not null`
- `provider_email text`
- `provider_username text`
- `provider_display_name text`
- `provider_avatar_url text`
- `provider_metadata jsonb default '{}'::jsonb`
- `linked_at timestamptz not null default now()`
- `last_used_at timestamptz`
- `is_primary boolean default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique `(provider, provider_user_id)`
- unique `(user_id, provider)` if only one linkage per provider is allowed

### `public.auth_login_events`

Purpose:

- audit provider sign-ins and failures
- support abuse review and operational debugging

Suggested fields:

- `id uuid primary key`
- `user_id uuid references public.profiles(id) on delete set null`
- `provider text not null`
- `event_type text not null`
- `success boolean not null`
- `ip_address inet`
- `user_agent text`
- `error_code text`
- `error_detail text`
- `created_at timestamptz not null default now()`

### Optional: `public.provider_oauth_states`

Purpose:

- temporary state/nonce tracking for providers that require backend-owned OAuth initiation and callback handling

This can also live in a short-TTL cache if preferred.

## Provider Handling Model

### Apple

Preferred path:

- backend-owned token verification and identity resolution

Expected flow:

1. client initiates Apple sign-in
2. client sends the Apple credential or callback result to the API
3. API verifies the provider token and nonce
4. API resolves or creates the platform user and HINTO app user
5. `auth_identities` entry is inserted or refreshed
6. API issues HINTO access/refresh session

### Meta/Facebook

Preferred path:

- backend-owned OAuth exchange and identity resolution

Product note:

- this is the approved path for the Instagram-discovery use case
- no Instagram graph/data import is required for MVP

### Snapchat

Preferred path:

- backend-owned OAuth initiation, callback, token exchange, and user resolution

Expected flow:

1. client requests provider start from API
2. API creates signed state/nonce and returns provider auth URL
3. provider redirects back to API callback
4. API validates state, exchanges code, fetches provider identity
5. API finds or creates the canonical HINTO user
6. API links `auth_identities`
7. API completes the authenticated app session through the canonical Supabase user model

### TikTok

Same design as Snapchat.

## User Resolution Rules

When a provider callback or sign-in succeeds:

1. resolve by existing `(provider, provider_user_id)` linkage first
2. if no linkage exists, attempt safe email-based match only when the provider email is verified and policy allows merge
3. if no safe match exists, create a new canonical user
4. create or update the `app_users` and `profiles` rows
5. create or update the `auth_identities` row
6. create an `auth_sessions` row for refresh-token tracking

Unsafe automatic merges must be avoided.

## Profile Creation Rules

The donor schema includes a Supabase-specific `handle_new_user()` trigger. Production RDS should replace this with API-owned bootstrap logic.

Bootstrap should:

- handle name fallback consistently across providers
- avoid overwriting user-edited profile fields on later logins
- initialize required app defaults only once

## API Responsibilities

The TypeScript API should own:

- provider-start endpoints for custom providers
- provider callback handlers for custom providers
- identity-link creation and reconciliation
- user bootstrap checks
- profile hydration rules
- audit logging

The API should own passwordless/session issuance for production.

## Security Rules

- never trust provider profile data without token verification
- keep provider access tokens out of normal client storage when backend-owned flows are used
- store only the minimum provider metadata required for account linkage and UX
- separate long-lived linkage metadata from sensitive short-lived tokens
- use explicit anti-CSRF state and nonce validation for all redirect-based provider flows
- make account linking an authenticated action unless it is part of initial signup

## Open Design Questions

- whether TikTok and Snapchat should both be MVP-day-one or staged immediately after Apple and Meta/Facebook
- whether phone-based identity fallback is needed later for invite conversion

## Recommended Next Step

Apply [`db/migrations/001_platform_identity.sql`](/Users/benjamincox/Downloads/HINTO/db/migrations/001_platform_identity.sql), then wire the API auth middleware against `platform_users`, `app_users`, `auth_identities`, and `auth_sessions`.
