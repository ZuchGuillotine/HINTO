# HINTO Initial Backend Wiring Plan

*Created: 2026-03-27*

## Purpose

This document turns the restart architecture into an initial backend implementation plan grounded in the donor Supabase schema at:

- `/Users/benjamincox/Downloads/rork-hnnt--hinto--relationship-ranking-app/supabase/migrations/001_initial_schema.sql`
- `/Users/benjamincox/Downloads/rork-hnnt--hinto--relationship-ranking-app/supabase/migrations/003_voting_functions.sql`
- `/Users/benjamincox/Downloads/rork-hnnt--hinto--relationship-ranking-app/supabase/migrations/004_create_profiles_table.sql`
- `/Users/benjamincox/Downloads/rork-hnnt--hinto--relationship-ranking-app/supabase/migrations/009_friends_contacts_system.sql`

## Canonical Starting Point

The donor schema already provides a usable MVP baseline for:

- `profiles`
- `situationships`
- `voting_sessions`
- `votes`
- `ai_conversations`
- `ai_messages`
- `blocks`
- `reports`
- `daily_usage`

These tables are strong enough to drive the first backend slices with normalization rather than reinvention.

## What The Donor Schema Gets Right

- one canonical user ID through `profiles.id -> auth.users.id`
- clear ownership on primary user content
- useful constraints on votes, blocks, and daily usage
- built-in profile bootstrap trigger
- reusable database functions for invite codes and vote-result aggregation

## What The Donor Schema Does Not Yet Solve

- canonical linkage for Apple, Meta/Facebook, Snapchat, and TikTok identities
- backend-owned auth flows for unsupported providers
- explicit admin/moderation surfaces
- share-asset lifecycle boundaries
- clear separation between app-domain API and direct client database access

## Service Layout

Recommended initial service shape:

```text
/services/api
  /src
    /app
    /config
    /lib
    /middleware
    /modules
      /auth
      /profiles
      /situationships
      /voting
      /results
      /ai
      /moderation
      /storage
    /contracts
```

Recommended supporting packages:

```text
/packages/domain
/packages/contracts
/packages/prompts
```

## Initial Module Boundaries

### Auth module

Responsibilities:

- validate authenticated caller
- resolve current user from Supabase identity
- bootstrap profile if missing
- handle provider linkage records
- host custom provider start/callback flows where needed

Primary tables:

- `auth.users`
- `profiles`
- proposed `auth_identities`
- proposed `auth_login_events`

### Profiles module

Responsibilities:

- get current profile
- update editable profile fields
- privacy settings

Primary table:

- `profiles`

### Situationships module

Responsibilities:

- list current user situationships
- create situationship
- update situationship
- archive or deactivate situationship
- reorder situationships safely

Primary table:

- `situationships`

Important schema note:

- donor schema uses `UNIQUE(user_id, rank)`, which is valid but means reorder logic should run transactionally to avoid transient collisions

### Voting module

Responsibilities:

- create voting session
- get public voting session by invite code
- submit votes
- expire or deactivate session

Primary tables:

- `voting_sessions`
- `votes`
- `situationships`

Useful donor functions:

- `generate_invite_code()`
- `get_voting_session_stats()`
- `get_vote_results_with_ranking()`

### Results module

Responsibilities:

- session-owner results summary
- ranking output
- comments view
- anonymity-safe response shaping

Primary tables:

- `voting_sessions`
- `votes`
- `situationships`

### AI module

Responsibilities:

- create or continue conversation
- persist messages
- apply moderation and quotas
- invoke prompt package and model adapter

Primary tables:

- `ai_conversations`
- `ai_messages`
- `daily_usage`

### Moderation module

Responsibilities:

- create reports
- create blocks
- apply basic enforcement checks

Primary tables:

- `reports`
- `blocks`

### Storage module

Responsibilities:

- issue upload intents or signed operations
- track share-asset usage
- keep clients from embedding storage policy logic everywhere

Primary storage:

- Supabase Storage

## Contract Style

The initial backend should use explicit HTTP JSON endpoints with OpenAPI contracts.

Suggested first authenticated routes:

- `GET /v1/me`
- `PATCH /v1/me`
- `GET /v1/situationships`
- `POST /v1/situationships`
- `PATCH /v1/situationships/:id`
- `POST /v1/situationships/reorder`

Suggested first public/shared routes:

- `GET /v1/voting-sessions/:inviteCode`
- `POST /v1/voting-sessions/:inviteCode/votes`

Suggested first auth routes:

- `GET /v1/auth/session`
- `POST /v1/auth/providers/:provider/start`
- `GET /v1/auth/providers/:provider/callback`
- `POST /v1/auth/link/:provider`

## Recommended Local Data Access Pattern

Use a service/repository split:

- route handlers validate contract input and auth context
- service layer owns business rules
- repository layer owns SQL or Supabase admin access

Do not spread raw table access across handlers.

## Schema-Normalization Plan

### Keep as baseline

- `profiles`
- `situationships`
- `voting_sessions`
- `votes`
- `ai_conversations`
- `ai_messages`
- `blocks`
- `reports`
- `daily_usage`

### Defer from baseline

- `friendships`
- `contacts`
- `friend_groups`
- `friend_group_members`
- `images`
- `image_attachments`

These may be useful later, but they should not block the first vertical slice.

### Add next

- `auth_identities`
- `auth_login_events`

Potential later additions:

- `share_assets`
- `moderation_actions`
- `provider_tokens` only if required by a provider and stored with tighter controls

## Request Lifecycle

For authenticated routes:

1. client sends Supabase-backed access token
2. auth middleware validates identity
3. API resolves `profiles.id`
4. service executes business rules
5. repository reads/writes app tables
6. response is shaped through explicit contracts

For public vote flows:

1. client resolves invite code
2. API checks session activity and expiry
3. API returns the minimal public vote view
4. vote submission enforces uniqueness, comment limits, and session validity

## Risks To Address Early

- reorder logic must handle unique rank constraints safely
- vote uniqueness rules need a clear anonymous-user policy
- RLS from the donor repo may not match the new API-owned boundary
- donor schema assumes some direct-client access patterns that should move behind the API
- ~~provider-linking tables are missing and should be added before auth complexity spreads~~ - Resolved: `auth_identities` and `auth_login_events` added in migration 010

## Recommended Build Order

1. ~~create `/services/api`~~ - Done
2. ~~wire config, logger, health route, and request ID middleware~~ - Done
3. ~~add auth middleware against Supabase-backed identity~~ - Done (PR #1, `services/api/src/middleware/auth.ts`)
4. ~~add `GET /v1/me` and `PATCH /v1/me`~~ - Done (PR #1, `services/api/src/routes/profile.ts`)
5. ~~add situationship CRUD and reorder endpoints~~ - Done (PR #1, `services/api/src/routes/situationships.ts`)
6. ~~add `auth_identities` migration~~ - Done (PR #1, `supabase/migrations/010_auth_identities.sql`)
7. add provider-start and provider-callback flows
8. add voting and results endpoints
9. add AI routes after prompt package and quota rules are in place

## Practical Conclusion

The initial backend foundation is now wired. Steps 1-6 are complete as of PR #1 (merged 2026-03-28). The Supabase-backed auth middleware, profile routes, situationship CRUD/reorder, and `auth_identities` migration are all in place.

The next priorities are provider auth flows (step 7), voting/results endpoints (step 8), and AI routes (step 9).
