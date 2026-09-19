# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HINTO is a social relationship voting platform with an AI relationship coach, targeting women 16–35. Users manage ranked lists of romantic options, friends vote and comment, and an AI coach gives personalized guidance. Platforms: native iOS and web.

**This repo is in an active restart phase.** The legacy Expo/AWS Amplify architecture is still present but slated for retirement. New work targets Supabase + TypeScript HTTP API + native SwiftUI iOS + web. Read `docs/Restart_Unification_Plan.md` before making architecture-level decisions.

## Development Commands

### New Backend API (services/api)

- `npm run api:build` — Compile API + `@hinto/prompts` (`tsc -b services/api/tsconfig.json`)
- `npm start` — Run the built API (`node services/api/dist/server.js`); this is the deploy entrypoint
- `npm run api:start` — Build and run
- `npm run dev` — Build, watch, and run with restarts
- `npm run api:test` — Jest suite under `services/api/src/__tests__/`
- Copy `.env.example` to `.env` for local development. The server refuses to boot without the Supabase variables.
- Container: `docker build -f services/api/Dockerfile -t hinto-api .`

### Web (apps/web)

- `npm run web:dev` — Static dev server on `127.0.0.1:3001`

### iOS (apps/ios)

- `npm run tuist:generate` then open the workspace in Xcode. See `docs/Local_Development.md`.

### Legacy Expo App (apps/hnnt-app) — retiring

- `npm run legacy:start` / `legacy:ios` / `legacy:android` / `legacy:web`
- Currently does not bundle (missing `amplifyconfiguration.json`); do not invest here.

### Code Quality

- `npm run lint` / `npm run lint:fix` — ESLint (legacy tree is excluded via `.eslintignore`)
- `npm run typecheck` — `tsc -b` over `packages/prompts` and `services/api`
- `npm run format` — Prettier
- Pre-commit hook (`.husky/pre-commit`) runs lint-staged
- CI: `.github/workflows/ci.yml` runs build, lint, tests, and the container build

## Repository Structure

```
/apps
  /hnnt-app/         Legacy Expo/React Native app (still running, retiring)
  /ios/              New native SwiftUI app (in progress)
    HINTO/Sources/   App, Navigation, Design, Models, Services, Views

/services
  /api/              New TypeScript HTTP API (first vertical slice done)
    src/             server.ts, routes/, middleware/, config, logger, supabase client

/packages
  /contracts/        Vendor-neutral OpenAPI/JSON schema definitions
  /domain/           Business rules and validation (no vendor dependencies)
  /prompts/          AI coach system prompt, safety rules, crisis detection (workspace package)

/supabase
  migrations/        PostgreSQL migration files

/amplify/            Legacy AWS backend — do NOT expand
/lambda/             Legacy reference only (Snapchat OAuth)
/scripts/            Legacy operational scripts (Cognito helpers)
/docs/               Restart architecture documentation (source of truth)
```

## Architecture: New (Target)

Defined in `docs/Canonical_Architecture.md`. First vertical slice (profile + situationships) is implemented.

- **Backend**: Node.js HTTP API under `/services/api/` with versioned routes (`/v1`), structured JSON error envelopes, request-context propagation
- **Database**: PostgreSQL via Supabase with RLS policies
- **Auth**: Supabase Auth + provider linkage tables (Apple, Meta/Facebook required for MVP; Snapchat, TikTok deferred). See `docs/Auth_Model.md`
- **iOS**: SwiftUI app under `/apps/ios/` with design system, models, API client, auth manager
- **Web**: Planned under `/apps/web/` (not yet scaffolded)
- **API Style**: REST/JSON — no GraphQL, no tRPC
- **Contracts**: OpenAPI definitions in `/packages/contracts/` consumed by Swift and web clients
- **Domain Logic**: Vendor-neutral rules in `/packages/domain/` (profile privacy, situationship ordering, viewer/audience modeling)

### Implemented API Routes (services/api)

- `GET /health`, `GET /v1/health`, `GET /v1` (discovery)
- Auth: `POST /v1/auth/email/otp`, `POST /v1/auth/email/verify`, `POST /v1/auth/refresh`, `POST /v1/auth/apple`, custom provider start/callback (TikTok; Snapchat stubbed)
- Profile: `GET|PATCH|DELETE /v1/me` (PATCH accepts `age` >= 16 and `bio`)
- Situationships: `GET|POST /v1/me/situationships`, `PATCH|DELETE /v1/me/situationships/:id`, `PUT /v1/me/situationships/order`
- Voting: `POST /v1/me/voting-sessions`, `POST .../:id/expire`, `GET .../:id/results`, public `GET /v1/voting-sessions/:inviteCode`, `POST .../votes`
- Moderation: `POST /v1/reports`, `GET|POST /v1/me/blocks`, `DELETE /v1/me/blocks/:profileId`
- AI coach: `GET|POST /v1/me/ai/conversations`, `GET|POST /v1/me/ai/conversations/:id/messages` (503 unless `OPENAI_API_KEY` is set; `capabilities.canUseAiCoach` tells clients)
- Dev only: `POST /v1/dev/session` (requires `API_ENABLE_DEV_AUTH=true`, never in production)

### Supabase Client Rules (services/api/src/supabase.ts)

- `getServiceClient` for data access and `auth.admin.*` only.
- `getAuthClient` (fresh anon client) for anything that returns a session: `verifyOtp`, `refreshSession`, `signInWithOtp`, `signInWithIdToken`. Never call those on the service client.

### Environment Variables (services/api)

Full annotated list in `/.env.example`. Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Common: `PORT`, `API_CORS_ALLOW_ORIGIN`, `PUBLIC_WEB_BASE_URL`, `OPENAI_API_KEY`, `API_ENABLE_DEV_AUTH`, `AUTH_ALLOWED_REDIRECT_URIS`.

## Architecture: Legacy (Still Running)

- **Frontend**: Expo 53, React Native 0.79, React 19, React Navigation v7
- **Backend**: AWS Amplify — AppSync GraphQL, Cognito, DynamoDB, S3
- **Auth**: Cognito with federated OAuth (Google, Snapchat, Instagram)
- **State**: React Context providers (`SituationshipsProvider`, `UserProfileProvider`) + custom hooks
- **Entry**: `App.tsx` → hardcoded Amplify config → `index.ts` → Expo registration

### Legacy Coupling Hotspots (see `docs/Legacy_AWS_Audit.md`)

- `apps/hnnt-app/src/hooks/useAuth.tsx` — hard-coupled to Cognito
- `apps/hnnt-app/src/context/useSituationships.tsx` — uses AppSync GraphQL
- `apps/hnnt-app/src/context/useUserProfile.tsx` — uses AppSync GraphQL
- `App.tsx` — inline Amplify configuration

### GraphQL Schema

`amplify/backend/api/hinto/schema.graphql` — Models: User, Situationship, Vote, Report, InviteToken

## Core Domain Model

Defined in `docs/Canonical_Domain_Model.md`:

- **Profile**: User identity with privacy settings and social links
- **AuthIdentity**: Provider linkage per user (Apple, Meta, Snapchat, TikTok)
- **Situationship**: Ranked romantic options with sharing/access control
- **VotingSession / Vote**: Friend voting system (best/worst rankings)
- **AI Coach**: Personalized guidance (routes not yet implemented)

## Key Constraints

- **Do not widen the AWS Amplify/Cognito/AppSync footprint** unless explicitly asked
- Legacy `amplify/` directory: changes should be rare and intentional
- Prefer isolating and documenting legacy code over deepening coupling
- New structure follows: `/apps/ios`, `/apps/web`, `/services/api`, `/packages/domain`, `/packages/contracts`, `/packages/prompts`
- Keep changes scoped — do not mix restart rewrites with incidental refactors
- When touching legacy frontend code, follow existing patterns in `apps/hnnt-app/src/`

## Known Issues

- **Reanimated disabled**: Babel plugin permanently removed due to incompatibility with optional chaining and modern JS syntax. Standard FlatList used instead of DraggableFlatList.
- **Missing amplifyconfiguration.json import**: Legacy app cannot bundle; documented in AWS audit. Legacy scripts are namespaced `legacy:*`.
- **Migrations were hand-applied**: `supabase/migrations/001-011` were run through the SQL editor; remote parity is unverified. `012_launch_hardening.sql` must be applied before the reorder route works.
- **Docker image unverified locally**: `services/api/Dockerfile` is validated by CI, not yet by a local daemon.

## Key Documentation

| Document                           | Purpose                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `docs/Launch_Readiness_Audit.md`   | Current blockers, human-testing and eval checklists — read first for launch work |
| `docs/Restart_Unification_Plan.md` | Master restart plan                                                              |
| `docs/Canonical_Architecture.md`   | Target architecture decisions                                                    |
| `docs/Canonical_Domain_Model.md`   | Core entities and business rules                                                 |
| `docs/Auth_Model.md`               | Auth strategy (Supabase Auth + provider linking)                                 |
| `docs/Execution_Backlog.md`        | Current task queue for restart work                                              |
| `docs/Legacy_AWS_Audit.md`         | Coupling analysis of Amplify touchpoints                                         |
| `docs/Schema_Entity_Mapping.md`    | Legacy-to-new schema mapping                                                     |
