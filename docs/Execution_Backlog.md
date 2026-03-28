# HINTO Execution Backlog

*Created: 2026-03-27*

## Purpose

This is the working end-to-end task list for the restart of HINTO.

It supersedes the old AWS/Amplify/Expo-first sprint plan in practice. The old docs are still useful as salvage input, but they are not the execution source of truth for the restart.

The active target is:

- one canonical repo
- shared backend that serves both web and native iOS
- PostgreSQL/Supabase-backed data model
- HTTP API and contracts that are clean for both Swift and web clients
- gradual retirement of AWS Amplify, Cognito, AppSync, and Expo-first assumptions

## Assumptions

- A Supabase database already exists and at least one migration has already been applied.
- The most likely current schema source is `/Users/benjamincox/Downloads/rork-hnnt--hinto--relationship-ranking-app/supabase/migrations/`.
- The current repo does not yet contain the new backend foundation.
- The current client code is still largely coupled to Amplify Auth and GraphQL.
- Native iOS and web are both first-class targets, so backend design must be client-agnostic.

## Execution Rules

- Do not expand the AWS/Amplify footprint.
- Prefer additive migration work before destructive deletion.
- Define shared contracts before building multiple clients against them.
- Keep legacy assets until replacements exist, then archive or delete intentionally.
- Any new backend surface should be usable by both Swift and web without client-specific branching.

## Workstreams

### 0. Immediate Clarification And Source Capture

| ID | Task | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| EX-00 | Identify the source of truth for the existing Supabase migration history and schema files | Human | In Progress | Likely donor repo: `/Users/benjamincox/Downloads/rork-hnnt--hinto--relationship-ranking-app/supabase/` |
| EX-01 | Confirm the intended backend stack for the restart | Human | Done | Use Supabase Postgres + Supabase Auth + Supabase Storage + TypeScript API |
| EX-02 | Confirm the intended web stack | Human | Assumed | Defaulting to Next.js unless changed |
| EX-03 | Confirm whether the first iOS milestone is native SwiftUI from this repo or a staged bridge from existing React Native flows | Agent | Done | Recommendation: fresh SwiftUI app under `/apps/ios`; current `ios/` is Expo shell only |
| EX-04 | Capture external service decisions still in scope for MVP | Human | Done | Supabase Auth is the canonical auth/session system. Apple auth is required. Meta/Facebook login is acceptable for the Instagram-discovery use case. Snapchat and TikTok also remain in scope. |

### 1. Canonical Product And Architecture Reset

| ID | Task | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| EX-10 | Write a new canonical MVP brief that replaces Seattle-only and Expo/AWS assumptions | Agent | Done | See `docs/Canonical_MVP_Brief.md` |
| EX-11 | Write a new system architecture doc for web + Swift + shared backend | Agent | Done | See `docs/Canonical_Architecture.md` |
| EX-12 | Define canonical top-level repo structure | Agent | Todo | `/apps/ios`, `/apps/web`, `/services/api`, `/packages/domain`, `/packages/contracts`, `/packages/prompts`, `/legacy` |
| EX-13 | Remove or quarantine legacy docs that conflict with the restart plan | Agent | Done | Conflicting AWS/Amplify/Expo planning docs removed; restart docs are now the active source of truth |

### 2. Domain Model And Database Alignment

| ID | Task | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| EX-20 | Pull the current Supabase schema/migrations into this repo or reference them cleanly | Agent | In Progress | Donor repo contains `001_initial_schema.sql` through `009_friends_contacts_system.sql` |
| EX-21 | Compare current Amplify schema to Supabase schema and produce an entity mapping | Agent | Todo | Users, profiles, situationships, voting sessions, votes, reports, blocks, AI entities |
| EX-22 | Define the canonical domain model independent of storage vendor details | Agent | Todo | Baseline entities already visible in donor schema: `profiles`, `situationships`, `voting_sessions`, `votes`, `ai_conversations`, `ai_messages`, `blocks`, `reports`, `daily_usage` |
| EX-23 | Identify schema gaps for web + Swift support | Agent | Todo | Public voting session access, auth identifiers, moderation, audit fields, share-image/storage model |
| EX-24 | Create follow-up DB migrations for missing fields or mismatches | Agent | Todo | Only after EX-20 to EX-23 are complete |

### 3. Backend Foundation

| ID | Task | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| EX-30 | Scaffold `/services/api` | Agent | Todo | Recommended: TypeScript service with clear route/module layout |
| EX-31 | Choose API style and codify it | Agent | Todo | REST or RPC-style JSON; OpenAPI contract required |
| EX-32 | Add environment/config management for local and deployed backend | Agent | Todo | Supabase URL/keys, AI keys, auth settings, storage config |
| EX-33 | Establish API error model and shared response envelope rules | Agent | Todo | Must be stable for web and Swift clients |
| EX-34 | Add structured logging, request IDs, and health endpoints | Agent | Todo | Needed before real client integration |
| EX-35 | Add auth middleware and session/user resolution | Agent | Todo | Should not depend on Cognito and should treat Supabase Auth as the canonical session layer |
| EX-36 | Design the canonical auth model and identity-linking tables | Agent | Done | See `docs/Auth_Model.md` |
| EX-37 | Implement supported-provider auth flows through Supabase where available | Agent | Todo | Apple and Meta/Facebook should use Supabase-managed auth where practical |
| EX-38 | Implement custom provider integrations not covered natively by Supabase | Agent | Todo | Snapchat and TikTok likely require backend-owned OAuth/token-exchange flows layered onto the Supabase user/session model |

### 4. Backend Modules

| ID | Task | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| EX-40 | Implement profile routes/services | Agent | Todo | Get current profile, update profile, privacy settings |
| EX-41 | Implement situationship routes/services | Agent | Todo | CRUD, reorder, limits, validation |
| EX-42 | Implement voting session routes/services | Agent | Todo | Create session, expire session, retrieve public voting view |
| EX-43 | Implement vote submission routes/services | Agent | Todo | Best/worst selection, optional comment, idempotency safeguards |
| EX-44 | Implement results aggregation routes/services | Agent | Todo | Owner-facing summaries, counts, comments, anonymity rules |
| EX-45 | Implement report/block routes/services | Agent | Todo | Minimal moderation-safe MVP |
| EX-46 | Implement AI conversation/message routes/services | Agent | Todo | Conversation persistence, moderation hooks, quotas |
| EX-47 | Implement storage helpers for media/share assets | Agent | Todo | Use backend-compatible storage assumptions |

### 5. Contracts And Shared Utilities

| ID | Task | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| EX-50 | Create `/packages/contracts` for OpenAPI schemas and DTOs | Agent | Todo | Central source for both clients |
| EX-51 | Create `/packages/domain` for shared business rules and validators | Agent | Todo | Limits, enums, state transitions |
| EX-52 | Create `/packages/prompts` for AI prompt logic and moderation rules | Agent | Todo | Salvage from donor repo if better |
| EX-53 | Generate typed clients or client helpers for web and Swift consumption | Agent | Todo | Web can use generated TS types; Swift can use OpenAPI generation later |

### 6. Web App Foundation

| ID | Task | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| EX-60 | Scaffold `/apps/web` | Agent | Todo | Recommended: Next.js |
| EX-61 | Implement app shell, auth entry, and session handling | Agent | Todo | Must target new backend, not Amplify |
| EX-62 | Build profile flow on the new API | Agent | Todo | First vertical slice candidate |
| EX-63 | Build situationship list/detail/create/edit flows | Agent | Todo | Reuse domain naming and copy where useful |
| EX-64 | Build voting session and vote submission flows | Agent | Todo | Public or semi-public share flow |
| EX-65 | Build results view | Agent | Todo | Owner-facing |
| EX-66 | Add admin-safe report triage view if needed for MVP | Agent | Todo | Could be deferred if manual ops suffice |

### 7. Native iOS Foundation

| ID | Task | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| EX-70 | Decide whether `/apps/ios` will be created fresh or derived from current `ios/` shell | Agent | Done | Fresh SwiftUI is lower-complexity than reworking the existing Expo-native shell |
| EX-71 | Scaffold native SwiftUI app structure | Agent | Todo | Fresh app under `/apps/ios` |
| EX-72 | Establish networking layer against the shared API contract | Agent | Todo | Auth, request/response decoding, error handling |
| EX-73 | Build auth and onboarding shell | Agent | Todo | Must support Supabase session flow and social provider entrypoints |
| EX-74 | Build profile and situationship flows | Agent | Todo | Consume same backend as web |
| EX-75 | Build voting and results flows | Agent | Todo | Same contract, native UI |
| EX-76 | Build AI coach UI against backend API | Agent | Todo | After AI module is stable |

### 8. Client Migration And De-AWS Work

| ID | Task | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| EX-80 | Audit all AWS/Amplify/Cognito touchpoints in the current repo | Agent | Todo | Code, docs, scripts, native configs, deps |
| EX-81 | Replace client auth assumptions with backend-neutral interfaces | Agent | Todo | Begin with adapters rather than full deletion |
| EX-82 | Replace GraphQL/AWS API calls with new service clients | Agent | Todo | Incrementally by feature slice |
| EX-83 | Remove AWS-specific env/config usage from active app paths | Agent | Todo | Only after replacements exist |
| EX-84 | Move legacy Expo/Amplify implementation under `/legacy` | Agent | Todo | Only once new structure is ready |
| EX-85 | Delete obsolete AWS scripts, docs, and configs from active paths | Agent | Todo | After archive/move step |

### 9. Quality, Testing, And Delivery

| ID | Task | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| EX-90 | Add backend test harness | Agent | Todo | Unit + route/integration tests |
| EX-91 | Add contract validation in CI | Agent | Todo | Prevent API drift across clients |
| EX-92 | Add web app smoke tests | Agent | Todo | Critical flows only at first |
| EX-93 | Add iOS networking/model tests | Agent | Todo | Expand as native app grows |
| EX-94 | Add migration verification and seed/dev fixtures | Agent | Todo | Necessary for repeatable local setup |
| EX-95 | Define deployment path for API and web | Human | Todo | Supabase + Vercel/Hetzner or comparable |

## Recommended Sequence

### Phase A: Unblock The Backend

1. EX-00 through EX-04
2. EX-10 through EX-13
3. EX-20 through EX-24
4. EX-30 through EX-35
5. EX-50 through EX-53

### Phase B: Ship One Vertical Slice

1. EX-40 and EX-41
2. EX-60 through EX-63
3. EX-72 through EX-74
4. EX-90 through EX-94

The first vertical slice should be:

- authenticate user with the canonical Supabase-backed session model
- fetch or create profile
- list situationships
- create/edit/reorder situationships

If that works on web and the iOS networking layer, the foundation is credible.

### Phase C: Voting And AI

1. EX-42 through EX-47
2. EX-64 through EX-66
3. EX-75 and EX-76

### Phase D: Legacy Retirement

1. EX-80 through EX-85
2. prune stale docs and scripts
3. move or delete legacy implementation once replacements are live

## Suggested Ownership Split

### Human-Owned

- final product scope decisions
- stack decisions that affect long-term maintenance
- Supabase project access and secret management
- external provider credentials
- go/no-go decisions for deletions and archival

### Agent-Owned

- audits
- architecture and backlog docs
- API scaffold
- route/service implementation
- shared contracts and validators
- client integration work
- deprecation and cleanup PRs after replacement paths exist

### Mixed

- schema changes
- auth strategy
- AI provider behavior and policy
- deployment shape
- iOS structural decisions if there are multiple plausible migration paths

## Immediate Next Actions

1. Pull the donor Supabase schema and supporting API logic into the restart analysis.
2. Produce the Supabase-to-HINTO entity mapping and identify schema gaps.
3. Normalize the first auth migration around `auth_identities` and related audit tables.
4. Scaffold `/services/api`, `/packages/contracts`, and `/packages/domain`.
5. Implement `GET /v1/me`, `PATCH /v1/me`, and situationship CRUD/reorder as the first backend slice.
6. Add provider-start and provider-callback flows after the canonical session path is wired.

## Notes From Donor Supabase Repo

- Donor path: `/Users/benjamincox/Downloads/rork-hnnt--hinto--relationship-ranking-app`
- Schema assets found under:
  - `supabase/migrations/001_initial_schema.sql`
  - `supabase/migrations/002_ai_functions.sql`
  - `supabase/migrations/003_voting_functions.sql`
  - `supabase/migrations/004_create_profiles_table.sql`
  - `supabase/migrations/005_create_images_table.sql`
  - `supabase/migrations/006_image_storage_system.sql`
  - `supabase/migrations/007_performance_optimizations.sql`
  - `supabase/migrations/008_fix_image_relationships.sql`
  - `supabase/migrations/009_friends_contacts_system.sql`
- Useful donor implementation files found:
  - `lib/api/situationships.ts`
  - `lib/api/voting.ts`
  - `lib/ai/openai-service.ts`
  - `lib/ai/hnnt-prompts.ts`
  - `lib/supabase.ts`

The donor schema is strong enough to use as the initial baseline, but it should still be normalized into the restart architecture rather than copied blindly. In particular:

- `friendships` and `contacts` may be Phase 2 rather than MVP-critical
- `images` and image attachments may be useful, but should be validated against the new web + Swift share flow
- DB functions for invite-code generation, vote stats, and results ranking are useful patterns
- tRPC/Hono implementation details in the donor repo should not become the contract by default; the restart should still prefer a clean HTTP API and OpenAPI contract
- the donor auth/client implementation should be treated as reference only; social auth needs to be rebuilt around Supabase-compatible backend flows
- the donor auth/client implementation should be treated as reference only; use Supabase-managed auth where supported and custom backend-owned provider integration where not supported
