# HINTO Auth Model

*Created: 2026-03-27*

## Purpose

This document defines the restart-era auth model for HINTO.

It is intended to remove ambiguity before backend scaffolding begins.

## Auth Principles

- There must be one canonical HINTO user identity.
- Authentication method and social-account linkage are separate concerns.
- Supabase Auth is the canonical user/session backbone.
- Use Supabase-managed provider auth where available.
- Use backend-owned provider integration where Supabase does not natively support the provider.
- iOS and web must share the same identity model even if provider UX differs by platform.

## Canonical Identity Model

There are three layers:

1. `auth.users`
   The canonical authenticated user record managed by Supabase Auth.

2. `public.profiles`
   The application profile record keyed by `auth.users.id`.

3. `public.auth_identities`
   App-owned linkage records that describe which providers are attached to the user.

The donor schema already includes `public.profiles` keyed to `auth.users.id`, which is the correct base pattern.

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

- Supabase Auth issues and refreshes the user session
- clients hold the canonical authenticated session
- the TypeScript API validates the incoming Supabase-backed identity on every authenticated request
- the API resolves the HINTO user from `auth.users.id`

The API should not mint a second independent user system unless a specific provider constraint makes it unavoidable.

## Database Baseline

Existing donor baseline:

- `auth.users`
- `public.profiles`
- `public.daily_usage`

Existing app-domain tables already key to `profiles.id`:

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

- Supabase-managed sign-in if the provider is supported in the project auth configuration

Expected flow:

1. client initiates Apple sign-in
2. Supabase completes authentication
3. `auth.users` session is established
4. profile is created if missing
5. `auth_identities` entry is inserted or refreshed

### Meta/Facebook

Preferred path:

- Supabase-managed sign-in where supported

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

Same design as Snapchat unless later proven to be directly supportable through Supabase-managed provider auth.

## User Resolution Rules

When a provider callback or sign-in succeeds:

1. resolve by existing `(provider, provider_user_id)` linkage first
2. if no linkage exists, attempt safe email-based match only when the provider email is verified and policy allows merge
3. if no safe match exists, create a new canonical user
4. create or update the `profiles` row
5. create or update the `auth_identities` row

Unsafe automatic merges must be avoided.

## Profile Creation Rules

The donor schema already includes `handle_new_user()` to create `public.profiles` when a new `auth.users` row is inserted.

That remains a good default, but the restart should extend it to:

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

The API should not duplicate:

- core passwordless/session issuance logic already handled cleanly by Supabase Auth

## Security Rules

- never trust provider profile data without token verification
- keep provider access tokens out of normal client storage when backend-owned flows are used
- store only the minimum provider metadata required for account linkage and UX
- separate long-lived linkage metadata from sensitive short-lived tokens
- use explicit anti-CSRF state and nonce validation for all redirect-based provider flows
- make account linking an authenticated action unless it is part of initial signup

## Open Design Questions

- whether backend-owned custom provider flows should create Supabase custom tokens directly or reconcile by a controlled bootstrap exchange
- whether TikTok and Snapchat should both be MVP-day-one or staged immediately after Apple and Meta/Facebook
- whether phone-based identity fallback is needed later for invite conversion

## Recommended Next Step

Implement the first migration for:

- `auth_identities`
- `auth_login_events`
- any supporting indexes and RLS rules

Then wire the API auth middleware against `auth.users` and `profiles` before building feature routes.
