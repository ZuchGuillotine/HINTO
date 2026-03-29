# Donor Repo Salvage Assessment

*Created: 2026-03-27*
*Donor repo: `/Users/benjamincox/Downloads/rork-hnnt--hinto--relationship-ranking-app`*

## Goal

Identify what should be:

- kept as a direct baseline
- ported selectively
- referenced only
- ignored or left behind

This is a restart aid, not a mandate to merge the donor repo wholesale.

## High-Value Salvage

### 1. Supabase schema and migrations

Keep as the main backend baseline for analysis and likely import:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_ai_functions.sql`
- `supabase/migrations/003_voting_functions.sql`
- `supabase/migrations/004_create_profiles_table.sql`
- `supabase/migrations/005_create_images_table.sql`
- `supabase/migrations/006_image_storage_system.sql`
- `supabase/migrations/007_performance_optimizations.sql`
- `supabase/migrations/008_fix_image_relationships.sql`
- `supabase/migrations/009_friends_contacts_system.sql`

Why:

- It already models the main restart entities more closely than the Amplify schema.
- It is Postgres/Supabase-centered, which matches the restart direction.
- It contains useful database functions for invite codes, vote stats, usage tracking, and maintenance.

Use with caution:

- `friendships`, `contacts`, and related grouping features may be Phase 2, not MVP-critical.
- Some image/storage features may be more elaborate than the first restart slice requires.

### 2. Domain-oriented API logic

Port patterns, not the exact implementation shape:

- `lib/api/situationships.ts`
- `lib/api/voting.ts`

Why:

- The CRUD and reorder flows are directly relevant.
- Voting session creation and stats retrieval logic are useful.
- These files expose the core application operations in a fairly understandable way.

Do not port directly:

- client-coupled Supabase calls embedded in Expo app logic
- debug logging noise
- any assumptions tied to the old client runtime

### 3. AI prompt and safety logic

Strong salvage candidate:

- `lib/ai/hnnt-prompts.ts`

Why:

- It contains a concrete product voice and safety posture.
- It includes contextual prompt construction and emergency-path handling.
- This is the kind of product logic that is more expensive to recreate well than to adapt.

Likely destination:

- `/packages/prompts`

### 4. AI service behavior

Reference and selectively port:

- `lib/ai/openai-service.ts`

Why:

- Useful for message flow, prompt wiring, and persistence expectations.
- Should be adapted to a backend service, not kept in client-side form.

## Medium-Value Salvage

### 5. Supabase client typing patterns

Useful as reference only:

- `lib/supabase.ts`

Why:

- Helpful for understanding current table typing and realtime subscription intent.
- Not appropriate as the new canonical shared access layer because it is Expo/mobile-oriented.

### 6. Flow and screen ideas

Useful to mine for product behavior and UX sequencing:

- `app/auth/`
- `app/chat/`
- `app/contacts/`
- `app/friends/`
- `app/situationship/`
- `app/vote/`
- `app/vote-results/`

Why:

- These likely encode the newer product flow ideas than the older Amplify repo.
- They can inform web and iOS product requirements even if the implementation is discarded.

Use carefully:

- treat them as flow references
- do not import Expo Router structure or UI scaffolding into the restart by default

## Low-Value Or Leave Behind

### 7. Expo / RORK / app-runtime scaffolding

Do not adopt as the new foundation:

- Expo Router structure under `app/`
- Expo/native build scaffolding
- `backend/trpc/`
- RORK-specific project assumptions
- Android/iOS generated project artifacts inside the donor repo

Why:

- The restart target is native Swift + web + shared backend contract.
- Carrying over more Expo-centric structure would recreate the same migration problem.

### 8. tRPC/Hono coupling

Reference only, not default foundation:

- `backend/trpc/`

Why:

- The restart direction is better served by a clean HTTP API and OpenAPI contract.
- Swift consumes explicit HTTP contracts more naturally than tRPC coupling.

## Recommended Salvage Order

1. Import or reference the donor Supabase migrations as the schema baseline.
2. Extract entity mapping from donor schema to restart backlog.
3. Port AI prompt logic into a shared prompts package.
4. Port domain logic from `lib/api/situationships.ts` and `lib/api/voting.ts` into backend service modules.
5. Review flow directories for product behavior and UX decisions.
6. Ignore Expo/RORK structural scaffolding unless a specific file saves substantial time.

## Immediate Follow-Up Tasks

- Produce a table-by-table mapping between donor Supabase schema and current Amplify schema.
- Decide whether the donor migrations should be copied into this repo now or first documented and normalized.
- Review donor flow files to capture MVP behavior requirements for web and iOS.

## Practical Conclusion

Yes, there is more to salvage from the donor repo, but the valuable parts are mostly:

- schema and migrations
- domain service logic
- AI prompts and safety behavior
- product-flow ideas

The valuable parts are not:

- Expo runtime structure
- RORK assumptions
- tRPC-coupled backend shape
- generated mobile scaffolding
