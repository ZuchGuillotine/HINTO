# HINTO Restart And Unification Plan

*Reviewed on: 2026-04-14*

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

The legacy implementation in `HINTO` is built around:

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

Neither original implementation matched the stated restart target of:

- native iOS in Swift
- web app in JS or PHP
- no Expo as the primary app runtime
- one clean repo

The repo now contains restart-era work that moves toward that target:

- `/services/api` with auth, profile, and situationship routes
- `/packages/contracts` and `/packages/domain` for the first shared slice
- `/apps/ios` with a native SwiftUI app shell and feature views

What remains true is that the active legacy runtime under `apps/hnnt-app/src/` is still Amplify-shaped and has not yet been retired.

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
- assumptions that auth must stay client-only or Cognito-shaped

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

Current state in the repo:

- `/apps/ios` exists
- `/apps/web` exists
- `/services/api` exists
- `/packages/contracts` exists
- `/packages/domain` exists
- `/packages/prompts` and `/legacy` do not yet exist

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
- subscriptions and monetization
- full real-time everywhere
- large contact-import system if it slows delivery
- public community feed

### 5.3 Suggested auth simplification

Start with:

- Supabase Auth as the canonical user/session system
- Sign in with Apple
- Meta/Facebook login to cover the Instagram-discovery use case
- email magic link or other passwordless fallback

Then layer in:

- Snapchat login
- TikTok login

Clarification:

- We do not need Instagram data access as part of MVP.
- We need a low-friction path for users who discover HINTO via Instagram.
- Meta/Facebook-backed login is acceptable for that requirement.
- Supabase can manage auth directly where it has provider support.
- For providers without built-in support, HINTO should own the provider integration and map the result into the canonical app identity model.

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

## 7. Current Execution Status

The restart is no longer only a plan. The following execution artifacts now exist in the canonical repo:

- execution backlog and orchestration guidance in `docs/Execution_Backlog.md`
- Amplify-to-Supabase mapping and donor migration inventory in `docs/Schema_Entity_Mapping.md`
- canonical domain model and first-slice aggregate definitions in `docs/Canonical_Domain_Model.md`
- restart auth model in `docs/Auth_Model.md`
- AWS/Amplify blocker audit in `docs/Legacy_AWS_Audit.md`
- backend scaffold plus first-slice auth/profile/situationship implementation in `/services/api`
- restart-era voting routes in `/services/api/src/routes/voting.ts`
- auth-linkage migration in `supabase/migrations/010_auth_identities.sql`
- voting idempotency/results migration in `supabase/migrations/011_voting_session_identity_support.sql`
- first-slice contracts scaffold in `/packages/contracts`
- first-slice domain rules scaffold in `/packages/domain`
- dependency-light web shell in `/apps/web`
- native SwiftUI app shell in `/apps/ios`

What is now settled:

- the first vertical slice is profile plus situationship CRUD and reorder
- the shared API shape is REST-style JSON with stable envelopes and request IDs
- the first shared package boundary is `/packages/contracts` plus `/packages/domain`
- `restart-plan` is now the integration branch that contains the restart docs, the merged backend slice, and the merged SwiftUI branch
- legacy custom GraphQL behavior such as reorder and owner-scoped situationship listing must be preserved as product behavior, not as transport details
- legacy `sharedWith` semantics must be replaced explicitly as audience/access behavior rather than copied as a field

What remains immediately in front of implementation:

- confirm remote Supabase connectivity and current environment contract
- add backend tests, DB verification, and repeatable migration/dev workflows
- implement provider auth flows on top of the new auth identity model
- wire `/apps/web` and `/apps/ios` voting/results shells to the new backend routes
- align the existing SwiftUI app shell with the live backend contracts and replace remaining placeholder auth/voting/AI behavior incrementally

## 8. Current Risks

- The active app bootstrap still depends on legacy Amplify/Cognito paths, so the current client runtime is not yet backend-neutral.
- The repo-local environment and Supabase metadata are not yet confirmed as a complete end-to-end setup for remote DB verification, so connectivity work is still blocked pending a verified URL/key set or linked project workflow.
- There is no repo-local Supabase project config yet, so migration and connectivity workflows still need to be normalized.
- Backend route tests and DB verification are still only partial, so the backend slice now includes voting routes but is not yet verified end-to-end against a live Supabase environment.
- The native iOS app currently mixes real API-facing structure with placeholder behavior: auth stores a temporary token locally, vote submission is mocked, and AI chat uses canned responses.
- The repo shape is still only partially converged because `/packages/prompts` and `/legacy` have not been created yet.

## 9. Recommended Data Model Baseline

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

## 10. Immediate Next Steps

### Next step A: verify the backend slice against a real Supabase environment

- confirm working `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
- verify migration `010_auth_identities.sql`
- add route tests and DB connectivity checks for `/v1/me` and situationships

### Next step B: continue backend completion from the current baseline

- implement provider auth flows
- verify the new voting session, vote submission, and results routes against a live Supabase project
- keep AI routes behind the prompt/moderation package boundary

### Next step C: turn the existing clients into real consumers of the shared backend

- align `apps/ios/HINTO/Sources/Services/APIClient.swift` with the current route contract
- replace placeholder iOS auth, voting, and AI behavior incrementally as backend routes become available
- add web voting session, vote submission, and results flows against the shared API

### Next step D: continue cleanup with a strict rule

Only preserve code that does one of these:

- matches the new platform direction
- saves at least a few days of engineering time
- contains product logic that is harder to recreate than to port

Everything else should be archived or deleted.

## 11. Practical Conclusion

The fastest credible path is not to repair the current Expo/AWS app. It is to:

1. declare one canonical repo
2. salvage the best schema and domain logic from the Supabase branch
3. keep building on the restart branch that now already contains the backend slice and SwiftUI shell
4. retire RORK, Amplify, and Expo-first assumptions as replacement paths become real
5. rebuild the MVP around native iOS, a JS web app, and a Postgres-centered backend

That gives you a smaller, more durable foundation for the MVP and avoids carrying obsolete architecture into the restart.
