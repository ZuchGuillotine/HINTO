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

## Harness-Oriented Orchestration Notes

This backlog doubles as the task source for orchestrated agent execution.

Use the following operating rules when assigning work through the harness:

- Keep assignments narrow. One agent should own one bounded deliverable or one tightly-related audit.
- Pair implementation work with evaluation work when the task can drift architecturally or expand scope.
- Require every agent to report:
  - files inspected
  - files changed
  - assumptions made
  - unresolved risks
  - recommended follow-up tasks
- Prefer additive scaffolding, schema analysis, and contract definition over broad rewrites.
- Escalate to a human before any destructive archival, large moves, credential-dependent work, or vendor-choice changes.

## Codegraph Navigation Baseline

Before changing code for any non-trivial task, run:

1. `codegraph where <symbol>`
2. `codegraph context <symbol>`
3. `codegraph fn-impact <symbol>`

Recommended high-signal entry points for this repo:

- Auth coupling:
  - `useAuth`
  - `mapCognitoUserToAppUser`
  - `checkCurrentUser`
- Product state and reuse candidates:
  - `useSituationships`
  - `fetchSituationships`
  - `reorder`
  - `submitVote`
- App entry and navigation:
  - `AppRoot`
  - `AuthNavigator`
  - `AppNavigator`

Known current hotspots from codegraph:

- `apps/hnnt-app/src/hooks/useAuth.tsx` is high-risk and central to current auth coupling.
- `apps/hnnt-app/src/context/useSituationships.tsx` is high-risk and central to the first product slice.

## Task Packet Shape

Every agent task should include:

- backlog ID(s)
- exact goal
- allowed write scope
- required reads
- dependency constraints
- acceptance criteria
- drift guardrails

Default drift guardrails:

- do not deepen Amplify/Cognito/AppSync usage
- do not invent a new target architecture beyond the restart docs
- preserve product vocabulary and reusable flows
- prefer scaffolding and extraction over migration-by-deletion

## Initial Orchestration Queue

The first agent wave should stay close to Phase A and unblock the first backend slice.

| Queue | Backlog IDs | Goal | Worker Type | Evaluator Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Q1 | EX-20, EX-21 | Import or reference donor schema cleanly and produce Amplify-to-Supabase entity mapping | Worker | Yes | Must treat donor repo as input, not target architecture |
| Q2 | EX-22, EX-23 | Define canonical domain model and identify schema gaps for web + Swift | Worker | Yes | Should use EX-21 output as input |
| Q3 | EX-30, EX-31, EX-32, EX-33, EX-34 | Scaffold `/services/api` with config, error model, logging, and health surface | Worker | Yes | Keep auth implementation out of first scaffold unless needed for structure |
| Q4 | EX-50, EX-51 | Scaffold `/packages/contracts` and `/packages/domain` for first vertical slice | Worker | Yes | Should align with Q2 and Q3 outputs |
| Q5 | EX-80 | Audit AWS/Amplify/Cognito touchpoints in active code paths | Worker | Optional | Prioritize active paths under `apps/hnnt-app/src/` and scripts/config |

## Evaluator Responsibilities

Evaluator agents should not repeat the full implementation. They should check for:

- restart-plan drift
- accidental expansion of legacy AWS dependencies
- missing acceptance criteria
- unstable or ambiguous contracts
- missing tests or verification steps
- unscoped file edits

Evaluator output should always classify findings as:

- block
- follow-up
- acceptable for now

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
| EX-20 | Pull the current Supabase schema/migrations into this repo or reference them cleanly | Agent | Done | Donor repo migrations are now referenced cleanly via `docs/Schema_Entity_Mapping.md` and the donor inventory below |
| EX-21 | Compare current Amplify schema to Supabase schema and produce an entity mapping | Agent | Done | Deliverable is the written mapping table and mismatch notes in `docs/Schema_Entity_Mapping.md` |
| EX-22 | Define the canonical domain model independent of storage vendor details | Agent | Done | Deliverable is `docs/Canonical_Domain_Model.md`. It separates domain entities from storage tables and accounts for the legacy behavior surface behind `getUserSituationships`, `getSituationshipVotes`, `searchUsers`, and `reorderSituationships`. |
| EX-23 | Identify schema gaps for web + Swift support | Agent | Done | Gap analysis is captured in `docs/Canonical_Domain_Model.md`. `sharedWith` is treated as both a domain/API gap and an authorization replacement problem because it currently encodes Amplify read-access semantics. |
| EX-24 | Create follow-up DB migrations for missing fields or mismatches | Agent | Done | Migration `010_auth_identities.sql` adds `auth_identities` and `auth_login_events` tables with RLS policies |

### 3. Backend Foundation

| ID | Task | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| EX-30 | Scaffold `/services/api` | Agent | Done | TypeScript scaffold created under `services/api` with versioned routes and minimal server structure |
| EX-31 | Choose API style and codify it | Agent | Done | REST-style JSON and scaffold decisions documented in `services/api/README.md` |
| EX-32 | Add environment/config management for local and deployed backend | Agent | Done | Config contract added in `services/api/src/config.ts` and documented in `services/api/README.md` |
| EX-33 | Establish API error model and shared response envelope rules | Agent | Done | Machine-readable error envelope and success envelope scaffolded in `services/api/src/errors.ts`, `services/api/src/http.ts`, and `services/api/README.md` |
| EX-34 | Add structured logging, request IDs, and health endpoints | Agent | Done | JSON logging, request IDs, `/health`, and `/v1/health` added in the API scaffold |
| EX-35 | Add auth middleware and session/user resolution | Agent | Done | Bearer token extraction, Supabase Auth user validation, profile lookup in `services/api/src/middleware/auth.ts` |
| EX-36 | Design the canonical auth model and identity-linking tables | Agent | Done | See `docs/Auth_Model.md` |
| EX-37 | Implement supported-provider auth flows through Supabase where available | Agent | Todo | Apple and Meta/Facebook should use Supabase-managed auth where practical |
| EX-38 | Implement custom provider integrations not covered natively by Supabase | Agent | Todo | Snapchat and TikTok likely require backend-owned OAuth/token-exchange flows layered onto the Supabase user/session model |

### 4. Backend Modules

| ID | Task | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| EX-40 | Implement profile routes/services | Agent | Done | `GET /v1/me` and `PATCH /v1/me` with MeAggregate responses in `services/api/src/routes/profile.ts` |
| EX-41 | Implement situationship routes/services | Agent | Done | List, create, update, delete, reorder routes in `services/api/src/routes/situationships.ts` |
| EX-42 | Implement voting session routes/services | Agent | Todo | Create session, expire session, retrieve public voting view |
| EX-43 | Implement vote submission routes/services | Agent | Todo | Best/worst selection, optional comment, idempotency safeguards |
| EX-44 | Implement results aggregation routes/services | Agent | Todo | Owner-facing summaries, counts, comments, anonymity rules |
| EX-45 | Implement report/block routes/services | Agent | Todo | Minimal moderation-safe MVP |
| EX-46 | Implement AI conversation/message routes/services | Agent | Todo | Conversation persistence, moderation hooks, quotas |
| EX-47 | Implement storage helpers for media/share assets | Agent | Todo | Use backend-compatible storage assumptions |

### 5. Contracts And Shared Utilities

| ID | Task | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| EX-50 | Create `/packages/contracts` for OpenAPI schemas and DTOs | Agent | Done | Scaffolded under `packages/contracts` for the first slice with `me` and situationship DTOs, aggregates, and reorder/create/update contracts |
| EX-51 | Create `/packages/domain` for shared business rules and validators | Agent | Done | Scaffolded under `packages/domain` with profile privacy normalization, capability resolution, audience/access types, and reorder invariants |
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
| EX-80 | Audit all AWS/Amplify/Cognito touchpoints in the current repo | Agent | Done | Audit complete in `docs/Legacy_AWS_Audit.md`; active blockers are root bootstrap, `useAuth`, `useUserProfile`, `useSituationships`, and AWS storage/upload paths |
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

1. ~~Normalize the first auth migration around `auth_identities` and related audit tables.~~ - Done (PR #1)
2. Verify Supabase connectivity and confirm the current remote project/env contract.
3. ~~Implement `GET /v1/me`, `PATCH /v1/me`, and situationship CRUD/reorder as the first backend slice.~~ - Done (PR #1)
4. ~~Add auth/session middleware that resolves authenticated owners, authorized viewers, and public-session access.~~ - Done (PR #1)
5. Add backend route tests and DB connectivity checks for the first slice.
6. Add provider-start and provider-callback flows after the canonical session path is wired.
7. Implement voting session and vote submission routes (EX-42, EX-43).
8. Scaffold `/apps/web` and build first vertical slice on the new API (EX-60 through EX-63).

## Current Orchestrator Guidance

Use the following sequencing constraints while agents are active:

- ~~Do not start EX-24 until EX-21 through EX-23 are reviewed.~~ - EX-24 is complete.
- ~~Do not let EX-35 through EX-38 sprawl into full provider implementation before EX-30 through EX-34 and EX-50 through EX-51 stabilize.~~ - EX-35 is complete; EX-37/EX-38 remain scoped.
- ~~Prefer profile and situationship contracts as the first shared slice before voting or AI routes.~~ - First slice is complete.
- Treat `apps/hnnt-app/src/hooks/useAuth.tsx` and `apps/hnnt-app/src/context/useSituationships.tsx` as salvage references, not migration targets.
- Do not model `sharedWith` as a plain field migration. Replace its audience and read-authorization behavior explicitly in the domain model and API/auth design.
- Do not start voting/AI routes until backend route tests (EX-90) confirm the first slice is stable.
- Provider auth (EX-37, EX-38) should proceed only after Supabase connectivity is verified end-to-end.

## Completed Agent Packets

The following packets were delivered and merged in PR #1 (2026-03-28):

- **Packet A (EX-50, EX-51)**: contracts and domain packages scaffolded
- **Packet B (EX-35)**: auth middleware with Supabase JWT session resolution
- **Packet C (EX-40)**: profile routes with MeAggregate responses
- **Packet D (EX-41)**: situationship CRUD, reorder, and delete routes

Additional deliverables in PR #1:

- **EX-24**: `supabase/migrations/010_auth_identities.sql` - `auth_identities` and `auth_login_events` tables with RLS
- `services/api/src/supabase.ts` - Supabase client module (service-role and user-scoped)
- `services/api/src/body.ts` - JSON body parser with size limits
- Route dispatcher refactored to async pattern

## Next Agent Packets

### Packet E: EX-90, EX-94

- Goal: add backend route tests, migration verification, and DB connectivity checks
- Inputs:
  - `services/api/src/routes/*`
  - `services/api/src/middleware/auth.ts`
  - `supabase/migrations/010_auth_identities.sql`
- Deliverables:
  - test harness for profile and situationship routes
  - DB connectivity probe
  - migration verification and dev seed fixtures
- Guardrails:
  - focus on first-slice routes only
  - do not add voting or AI test infrastructure yet

### Packet F: EX-37, EX-38

- Goal: implement provider auth flows (Apple, Meta/Facebook via Supabase; Snapchat, TikTok via custom backend)
- Inputs:
  - `docs/Auth_Model.md`
  - `services/api/src/middleware/auth.ts`
- Deliverables:
  - provider-start and provider-callback routes
  - identity-linking flow against `auth_identities`
- Guardrails:
  - Apple and Meta/Facebook should use Supabase-managed auth where supported
  - Snapchat and TikTok require custom backend OAuth flows
  - do not recreate Cognito-shaped client state

### Packet G: EX-42, EX-43, EX-44

- Goal: implement voting session, vote submission, and results routes
- Inputs:
  - `packages/contracts`, `packages/domain`
  - donor repo voting functions (`003_voting_functions.sql`)
  - `docs/Canonical_Domain_Model.md`
- Deliverables:
  - voting session create/expire/retrieve routes
  - vote submission with best/worst, comments, idempotency
  - results aggregation with anonymity rules
- Guardrails:
  - reuse donor DB functions where applicable
  - keep public vote flows auth-free

### Packet H: EX-60, EX-61, EX-62, EX-63

- Goal: scaffold web app and build first vertical slice
- Inputs:
  - `packages/contracts`
  - `services/api` routes
- Deliverables:
  - Next.js app under `/apps/web`
  - auth entry and session handling against Supabase
  - profile and situationship flows consuming the new API
- Guardrails:
  - must target new backend, not Amplify
  - reuse domain naming and copy from contracts

## Accepted Outputs

The following artifacts are accepted as current restart inputs:

- `docs/Schema_Entity_Mapping.md` for EX-20 and EX-21
- `docs/Canonical_Domain_Model.md` for EX-22 and EX-23
- `docs/Legacy_AWS_Audit.md` for EX-80
- `services/api/README.md` and `services/api/src/*` for EX-30 through EX-34
- `packages/contracts/*` for EX-50
- `packages/domain/*` for EX-51
- `services/api/src/middleware/auth.ts` for EX-35
- `services/api/src/routes/profile.ts` for EX-40
- `services/api/src/routes/situationships.ts` for EX-41
- `supabase/migrations/010_auth_identities.sql` for EX-24

Acceptance notes:

- the API scaffold compiles with `npm run api:build`
- runtime socket binding could not be exercised in the current sandbox, so route behavior is accepted based on static review plus build verification
- `services/api/dist/` is build output and should not be treated as source of truth
- PR #1 (merged 2026-03-28) delivered EX-24, EX-35, EX-40, EX-41 - the full first backend slice
- package-level build/test wiring does not exist yet and remains follow-up work

## Next Agent Queue

These are the next preferred bounded tasks after the accepted outputs above.

| Queue | Backlog IDs | Goal | Primary Inputs | Deliverable |
| --- | --- | --- | --- | --- |
| Q9 | EX-90, EX-94 | Add backend route tests, migration verification, and DB connectivity checks for the first slice | accepted scaffold/packages plus Supabase project details | test harness, connectivity probe, and repeatable dev verification |
| Q10 | EX-37, EX-38 | Implement provider auth flows (Supabase-managed and custom backend OAuth) | `docs/Auth_Model.md`, `services/api/src/middleware/auth.ts`, `supabase/migrations/010_auth_identities.sql` | provider-start/callback routes and identity-linking flow |
| Q11 | EX-42, EX-43, EX-44 | Implement voting session, vote submission, and results aggregation routes | `packages/contracts`, `packages/domain`, donor voting functions | voting session CRUD, vote submission, results aggregation |
| Q12 | EX-82, EX-83 | Replace active client GraphQL/AWS API paths with backend-neutral service clients | `docs/Legacy_AWS_Audit.md`, first-slice contracts, backend routes | adapter layer or service client replacement for `useUserProfile` and `useSituationships` |
| Q13 | EX-60, EX-61, EX-62, EX-63 | Scaffold web app and build first vertical slice | `packages/contracts`, `services/api` routes | Next.js app with auth, profile, and situationship flows |

Queue constraints:

- Q9 should complete before starting Q10 or Q11, to confirm the first slice is stable.
- Q10 should use Supabase-managed auth for Apple/Meta and custom flows for Snapchat/TikTok only.
- Q11 should start with session creation and vote submission only, deferring AI integration.
- Q13 can run in parallel with Q10/Q11 once Q9 passes.

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
