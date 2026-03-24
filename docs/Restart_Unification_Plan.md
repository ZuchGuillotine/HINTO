# HINTO Restart And Unification Plan

*Reviewed on: 2026-03-23*

## 1. Purpose

This document resets the project around the current goal:

- Product: social relationship voting platform with an AI relationship coach
- Audience: women 16-35 who are not married
- Platforms: native iOS and web
- Constraint: low-cost MVP, minimal operational complexity, one canonical repo

It is based on a review of:

- `/Users/benjamincox/Downloads/HINTO`
- `/Users/benjamincox/Downloads/rork-hnnt--hinto--relationship-ranking-app`
- `/tmp/rork-hnnt---hinto-relationship-appV2`
- `/tmp/HINTORORK`

## 2. Main Findings

### 2.1 Product intent is still valid

The durable idea is consistent across both repos:

- users manage a ranked list of romantic options or relationship states
- friends vote and comment on those options
- an AI coach gives personalized guidance
- privacy, moderation, and invite-based sharing matter

### 2.2 The implementation assumptions are outdated

The current `HINTO` repo is built around:

- Expo
- AWS Amplify
- Cognito
- AppSync
- DynamoDB
- generated backend infrastructure

The sibling `rork-...relationship-ranking-app` repo is built around:

- Expo
- Supabase
- Expo Router
- Zustand
- React Query
- some RORK-specific scaffolding and naming

Neither repo matches the stated restart target of:

- native iOS in Swift
- web app in JS or PHP
- no Expo as the primary app runtime
- one clean repo

### 2.3 Reuse is possible, but selective

The codebase should not be "resumed" as-is. It should be treated as a salvage operation:

- preserve product logic, domain models, prompts, flows, and selected UI ideas
- discard platform-specific scaffolding that fights the new architecture

## 3. Salvage Assessment

### 3.1 High-value reuse

From `HINTO`:

- PRD and sprint docs as product-history input only
- domain vocabulary in [schema.graphql](/Users/benjamincox/Downloads/HINTO/amplify/backend/api/hinto/schema.graphql)
- some screen/component concepts in `apps/hnnt-app/src/`
- existing iOS project shell in `ios/` for reference only

From `rork-hnnt--hinto--relationship-ranking-app`:

- Supabase/Postgres schema direction in `supabase/migrations/`
- voting service patterns in [voting.ts](/Users/benjamincox/Downloads/rork-hnnt--hinto--relationship-ranking-app/lib/api/voting.ts)
- AI coaching prompt/safety logic in [hnnt-prompts.ts](/Users/benjamincox/Downloads/rork-hnnt--hinto--relationship-ranking-app/lib/ai/hnnt-prompts.ts)
- friend/contact and invite flow ideas in `app/contacts/`, `app/create-vote.tsx`, and `app/vote/`
- some Zustand state shapes and data models

### 3.2 Medium-value reuse

- branding assets, icons, copy, onboarding text
- validation rules
- image/share flow ideas
- docs that explain why certain choices were attempted

### 3.3 Low-value or discard candidates

- Amplify-generated infrastructure under `amplify/`
- Cognito redirect scripts and AWS environment metadata
- Expo-specific build flow, EAS assumptions, and Expo Router structure
- RORK-specific package naming and project artifacts
- tRPC/Hono pieces if we move to Swift + web clients with a shared HTTP API
- Seattle-only launch assumptions
- TikTok/Snap-first auth priority for MVP

### 3.4 Findings From The Remaining Repos

`rork-hnnt---hinto-relationship-appV2`:

- an early RORK-generated Expo prototype
- only one visible commit in the shallow audit
- uses RORK startup commands and RORK API assumptions
- contains basic auth, age-gate, home, and AI coach flows
- uses thin Supabase REST helpers rather than a mature data layer

Recommendation:

- do not use it as a base repo
- only mine small UI ideas, tags, or copy if they are uniquely useful

`HINTORORK`:

- empty repository

Recommendation:

- nothing to preserve

## 4. Recommended Canonical Direction

### 4.1 Repo decision

Use `HINTO` as the canonical repo and migrate only selected assets from the other repos into it.

Reason:

- it already appears to be the plainest repo name
- it avoids keeping a RORK-derived repo as the long-term base
- it is the current working directory and easiest place to centralize docs and cleanup

### 4.2 Platform decision

Target this structure:

```text
/apps
  /ios          # SwiftUI native app
  /web          # Next.js or similar JS web app
/services
  /api          # TypeScript API for AI, voting, auth-adjacent server logic, webhooks
/packages
  /domain       # shared business rules, enums, validation specs
  /contracts    # OpenAPI schema / DTOs / generated clients
  /prompts      # AI prompt definitions and moderation rules
/docs
/legacy
```

### 4.3 Backend decision

Recommended MVP backend:

- PostgreSQL as the source of truth
- Supabase for DB/Auth/Storage in MVP
- small TypeScript API service for AI calls, moderation, admin tasks, and webhooks
- deploy API/web on Hetzner if desired

Why this is the best default:

- it is the fastest path from the current repos to a working MVP
- the Supabase repo already contains reusable schema and voting logic
- it avoids reviving Amplify/Cognito/AppSync complexity
- it keeps future self-hosting possible because the core data model remains Postgres

If vendor minimization becomes more important than speed, a later phase can replace Supabase Auth/Storage with self-hosted equivalents on Hetzner. That should not be the first move.

### 4.4 API style decision

Do not make tRPC the foundation.

Use:

- REST or RPC-style JSON endpoints
- OpenAPI as the contract layer

Reason:

- Swift consumes HTTP/OpenAPI more naturally than tRPC
- web can still consume the same contract cleanly
- this lowers coupling between clients and backend implementation

## 5. Updated MVP Scope

### 5.1 Keep for MVP

- account creation and sign-in
- profile and preferences
- create/edit/reorder situationships
- create voting session and share invite link
- friend voting with optional comments
- results view
- AI relationship coach
- moderation and abuse reporting

### 5.2 Defer from MVP

- Android
- complex social OAuth matrix
- Snapchat/TikTok integrations
- subscriptions and monetization
- full real-time everywhere
- large contact-import system if it slows delivery
- public community feed

### 5.3 Suggested auth simplification

Start with:

- Apple Sign In on iOS
- Google sign-in
- email magic link or passwordless web login

That is materially simpler than restoring Cognito or reviving every social provider from the old docs.

## 6. Repo Unification Plan

### Phase 0. Full Inventory

1. Inventory which repo contains the newest useful work by area:
   - docs
   - schema
   - AI
   - voting
   - auth
   - assets
2. Tag each artifact as:
   - keep
   - port
   - archive
   - delete

### Phase 1. Documentation Reset

1. Replace legacy PRD assumptions with a new canonical MVP brief.
2. Create one architecture doc for native iOS + web + Postgres backend.
3. Create one backlog that reflects the new MVP rather than the old Expo/AWS plan.

### Phase 2. Repository Restructure

1. Create the new top-level app/service/package layout.
2. Move legacy React Native/Expo code into `/legacy`.
3. Copy over only selected reusable logic from the Supabase repo.
4. Remove RORK naming, stale repo metadata, and duplicate docs.

### Phase 3. Backend Foundation

1. Finalize Postgres schema.
2. Stand up auth, storage, and core tables.
3. Build API endpoints for:
   - profile
   - situationships
   - voting sessions
   - votes
   - AI chat
   - reports/blocks

### Phase 4. Client MVP Build

1. Build iOS SwiftUI app against the shared API contract.
2. Build web app against the same contract.
3. Add admin-safe moderation and support workflows.

## 7. Recommended Data Model Baseline

Keep these core entities regardless of backend tooling:

- `users`
- `profiles`
- `situationships`
- `voting_sessions`
- `votes`
- `ai_conversations`
- `ai_messages`
- `blocks`
- `reports`

Optional later entities:

- `friendships`
- `contact_imports`
- `subscriptions`
- `notifications`

## 8. Immediate Next Steps

### Next step A: finish the repo audit

Audit result:

- `rork-hnnt---hinto-relationship-appV2` is a low-value RORK/Expo prototype
- `HINTORORK` is empty

This means the only meaningful donor repo besides `HINTO` is `rork-hnnt--hinto--relationship-ranking-app`.

### Next step B: choose the migration baseline

Current recommendation:

- keep `HINTO` as the canonical repo
- use the Supabase repo as a donor for schema, voting, and AI prompt logic
- do not keep Amplify as the target backend

### Next step C: begin cleanup with a strict rule

Only preserve code that does one of these:

- matches the new platform direction
- saves at least a few days of engineering time
- contains product logic that is harder to recreate than to port

Everything else should be archived or deleted.

## 9. Practical Conclusion

The fastest credible path is not to repair the current Expo/AWS app. It is to:

1. declare one canonical repo
2. salvage the best schema and domain logic from the Supabase branch
3. retire RORK, Amplify, and Expo-first assumptions
4. rebuild the MVP around native iOS, a JS web app, and a Postgres-centered backend

That gives you a smaller, more durable foundation for the MVP and avoids carrying obsolete architecture into the restart.
