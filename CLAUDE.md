# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HINTO is a social relationship voting platform with an AI relationship coach, targeting women 16–35. Users manage ranked lists of romantic options, friends vote and comment, and an AI coach gives personalized guidance. Platforms: native iOS and web.

**This repo is in an active restart phase.** The legacy Expo/AWS Amplify architecture is still present but slated for retirement. New work targets AWS (ECS Fargate API + RDS PostgreSQL + S3/CloudFront + SES) with a TypeScript HTTP API, native SwiftUI iOS, and a static web app. Supabase code paths remain only as a transition fallback and must not be extended. Public domain is `hnnt.app` (API `api.hnnt.app`, bundle id `app.hnnt`). Read `docs/Launch_Readiness_Audit.md` and `docs/Operational_Readiness_Checklist.md` before launch work, and `docs/AWS_Infrastructure_Plan.md` before architecture-level decisions.

## Development Commands

### Backend API (services/api)
- `npm run api:build` — Compile TypeScript (`tsc -p services/api/tsconfig.json`)
- `npm start` / `npm run api:start` — Build and run (`node services/api/dist/server.js`)
- `npm run api:start:device` — Bind `0.0.0.0` with debug logs for physical-iPhone testing
- `npm run dev` — Build + watch API and restart server on dist changes
- `npm run db:migrate` / `npm run db:migrate:status` — Apply or inspect `db/migrations` against `DATABASE_URL`
- Copy `.env.example` to `.env`; in production the server refuses to boot without `DATABASE_URL` and the session secrets (`assertProductionConfig`)
- Container: `docker build -t hinto-api:local .` from the repo root

### Web App (apps/web)
- `npm run web:dev` — Static dev server via `apps/web/dev-server.mjs`
- `npm run web:build` / `web:build:staging` — Static bundle in `apps/web/dist` with the API base URL injected
- `npm run web:test` — Jest for web (`apps/web/jest.config.cjs`)

### iOS (apps/ios)
- `npm run ios` — `tuist generate`, then open the workspace in Xcode

### Legacy Expo App (apps/hnnt-app) — retiring, does not bundle
- `npm run legacy:expo:start` / `legacy:expo:ios` / `legacy:expo:android` / `legacy:expo:web`

### Code Quality
- `npm run lint` / `npm run lint:fix` — ESLint
- `npm run format` — Prettier
- Pre-commit hooks via Husky + lint-staged (auto-runs eslint --fix + prettier on staged files)

### Testing
- `npm test` — Runs API + web Jest suites
- `npm run api:test` — API Jest only (`services/api/jest.config.ts`)
- `npm run web:test` — Web Jest only
- Single test: `npx jest --config services/api/jest.config.ts -t "<name>"` (or pass a file path)

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

/db
  migrations/        Production RDS PostgreSQL migrations (apply with npm run db:migrate)
  migrate.mjs        Migration runner with schema_migrations tracking

/infra/aws/          Staging resource inventory, access rules, deploy workflow notes

/supabase
  migrations/        Transition-era schema history only; do not extend

/amplify/            Legacy AWS backend — do NOT expand
/lambda/             Legacy reference only (Snapchat OAuth)
/scripts/            Legacy operational scripts (Cognito helpers)
/docs/               Restart architecture documentation (source of truth)
```

## Architecture: New (Target)

Defined in `docs/Canonical_Architecture.md`. First vertical slice (profile + situationships) is implemented.

- **Backend**: Node.js HTTP API under `/services/api/` with versioned routes (`/v1`), structured JSON error envelopes, request-context propagation; runs on ECS Fargate behind an ALB at `api.hnnt.app`
- **Database**: AWS RDS PostgreSQL via `DATABASE_URL`; production migrations in `/db/migrations` (apply with `npm run db:migrate`). `/supabase/migrations` is schema history only.
- **Auth**: platform-owned. Opaque access tokens (7 days) and hashed refresh tokens (90 days) in `auth_sessions`; email/password, email OTP via SES, native Sign in with Apple; Snapchat/TikTok backend OAuth (callbacks still on the Supabase fallback); Meta not implemented. See `docs/AWS_Infrastructure_Plan.md`
- **iOS**: SwiftUI app under `/apps/ios/` with design system, models, API client, auth manager
- **Web**: Scaffolded under `/apps/web/` (vanilla JS + static dev server; see `apps/web/README.md`)
- **API Style**: REST/JSON — no GraphQL, no tRPC
- **Contracts**: OpenAPI definitions in `/packages/contracts/` consumed by Swift and web clients
- **Domain Logic**: Vendor-neutral rules in `/packages/domain/` (profile privacy, situationship ordering, viewer/audience modeling)

### Implemented API Routes (services/api)
`GET /v1` lists every route. Groups: auth (`/v1/auth/email/*`, `/v1/auth/apple/native`, `/v1/auth/refresh`, `/v1/auth/providers/:provider/*`), profile (`GET|PATCH|DELETE /v1/me`, avatar), situationships (CRUD, reorder, image), voting (owner sessions, results, public invite + vote), friends and feed (requests, suggestions, submissions, votes, comments, share invites), moderation (`/v1/reports`, `/v1/me/blocks`), AI coach (`/v1/me/conversations` and messages), dev-only `/v1/dev/session` (requires `ENABLE_DEVELOPMENT_AUTH=true`).

Every route handler checks `shouldUsePostgres(config)` first; the Supabase branch below it is a transition fallback. New routes must be written for Postgres only.

### Environment Variables (services/api)
See `/.env.example`. Production requires `DATABASE_URL`, `JWT_ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_PEPPER`, `API_HOST=0.0.0.0`, explicit `API_CORS_ALLOW_ORIGIN`. Optional integrations: `SES_FROM_EMAIL`, `S3_MEDIA_BUCKET`, `CLOUDFRONT_MEDIA_DOMAIN`, `OPENAI_API_KEY`, Apple/Meta/TikTok/Snapchat credentials.

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
- **AI Coach**: `/v1/me/conversations` routes backed by `packages/prompts` (system prompt, moderation, emergency responses) and OpenAI when `OPENAI_API_KEY` is set

## Key Constraints

- **Do not widen the AWS Amplify/Cognito/AppSync footprint** unless explicitly asked
- Legacy `amplify/` directory: changes should be rare and intentional
- Prefer isolating and documenting legacy code over deepening coupling
- New structure follows: `/apps/ios`, `/apps/web`, `/services/api`, `/packages/domain`, `/packages/contracts`
- Keep changes scoped — do not mix restart rewrites with incidental refactors
- When touching legacy frontend code, follow existing patterns in `apps/hnnt-app/src/`

## Known Issues

- **Reanimated disabled**: Babel plugin permanently removed due to incompatibility with optional chaining and modern JS syntax. Standard FlatList used instead of DraggableFlatList.
- **Missing amplifyconfiguration.json import**: Legacy app startup risk documented in AWS audit.
- **Mixed Jest configs**: API uses `services/api/jest.config.ts`, web uses `apps/web/jest.config.cjs`. Always pass `--config` when invoking Jest directly.

## Key Documentation

| Document | Purpose |
|---|---|
| `docs/Launch_Readiness_Audit.md` | Current launch blockers, human-testing and eval checklists — read first for launch work |
| `docs/Operational_Readiness_Checklist.md` | Operator steps for local testing, staging hardening, variables and secrets |
| `docs/AWS_Infrastructure_Plan.md` | Production AWS shape and environment contract |
| `docs/Restart_Unification_Plan.md` | Master restart plan |
| `docs/Canonical_Architecture.md` | Target architecture decisions |
| `docs/Canonical_Domain_Model.md` | Core entities and business rules |
| `docs/Auth_Model.md` | Original auth strategy (Supabase-era; superseded by the platform-owned model in the AWS plan) |
| `docs/Execution_Backlog.md` | Current task queue for restart work |
| `docs/Legacy_AWS_Audit.md` | Coupling analysis of Amplify touchpoints |
| `docs/Schema_Entity_Mapping.md` | Legacy-to-new schema mapping |
