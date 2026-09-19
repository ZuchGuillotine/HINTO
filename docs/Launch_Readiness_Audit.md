# HINTO Launch Readiness Audit

_Created: 2026-09-19_

## Purpose

This is the consolidated result of a full-repo review after a period of inactivity. It answers one question: what is blocking a live, functional deployment of the restart-era stack (Supabase + `services/api` + SwiftUI iOS + web)?

It supersedes the "Session Focus" status table in `docs/Execution_Backlog.md` for launch-readiness decisions. Backlog IDs are referenced where they exist.

## Bottom Line

The project is **not** nearly complete on the new stack. What works end to end today:

- email OTP sign-in (API + iOS)
- profile read/update (API + iOS + web)
- situationship create/edit/delete (API + iOS + web); **reorder is broken** (see B3)
- voting session creation (API + iOS)

What does not exist or is a placeholder:

- AI coach backend (no route, no prompt package; iOS returns random canned strings)
- report/block routes and UI
- vote submission and results in either client (API routes exist, clients mock them)
- Sign in with Apple end to end (iOS stores the Apple identity token as the API bearer; no backend exchange)
- any production sign-in on web (dev-session only, which the API refuses in production)
- account deletion (iOS button only signs out)
- deployment config of any kind (no Dockerfile, CI, hosting config, `.env.example`)
- legal pages (privacy, terms, support, data deletion) that both App Store and Meta require

Test status at audit time: `npm run api:build` passes; `npm run api:test` fails 2 of 52 because fixtures use columns that do not exist in the schema.

## Blockers (must fix before any live deployment)

| ID  | Area            | Finding                                                                                                                                                                                                                                    | Location                                                                                    |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| B1  | API security    | Service-role Supabase singleton is reused for `verifyOtp` / `refreshSession`. The auth-js client saves that session in memory and every later PostgREST call sends it as the bearer, so all DB access runs as the last user who signed in. | `services/api/src/supabase.ts`, `routes/auth.ts:31-117`, `routes/auth-providers.ts:413-432` |
| B2  | API security    | Dev impersonation (`Bearer dev-session:<profileId>`, `POST /v1/dev/session`) is gated only on `NODE_ENV === 'production'`, which defaults to `development` when unset. Any misconfigured host has full account takeover.                   | `middleware/auth.ts:26-65`, `routes/dev.ts:53`, `config.ts:96`                              |
| B3  | API correctness | Reorder issues per-row rank updates in parallel against `UNIQUE(user_id, rank)`; any swap hits 23505 and the error is ignored. Reorder is non-functional.                                                                                  | `routes/situationships.ts:308-316`, `migrations/001:48`                                     |
| B4  | Deploy          | No deployable artifact: no `services/api/package.json`, Dockerfile, CI, hosting config. Server binds `127.0.0.1`, ignores `PORT`. Root `npm start` launches Expo.                                                                          | root `package.json`, `server.ts:52`, `config.ts:7`                                          |
| B5  | Config          | API boots and reports healthy with no Supabase credentials; first real request 500s.                                                                                                                                                       | `config.ts:97-103`                                                                          |
| B6  | Product         | No AI coach backend. Tab and onboarding copy promise it. App Review rejects placeholder features.                                                                                                                                          | `apps/ios/.../ChatView.swift:123-143`, `profile.ts:89`                                      |
| B7  | Product         | No report/block routes or UI. Required for UGC apps (App Store 1.2) and listed as MVP.                                                                                                                                                     | tables exist in `migrations/001:114-140`; no routes                                         |
| B8  | iOS             | Release builds point at `http://127.0.0.1:3000` (baked into Info.plist for all configurations) with `NSAllowsLocalNetworking`.                                                                                                             | `Project.swift:28-32`, `APIClient.swift:251-267`                                            |
| B9  | iOS             | Sign in with Apple: no entitlement, no backend exchange, Apple JWT used as API bearer. Facebook/Snapchat/TikTok buttons render and throw "coming soon".                                                                                    | `AuthManager.swift:88-118, 274`, `OnboardingView.swift:56-61`                               |
| B10 | iOS             | Account deletion only signs out. Guideline 5.1.1(v).                                                                                                                                                                                       | `ProfileView.swift:56-58`; no `DELETE /v1/me`                                               |
| B11 | iOS             | No app icon, no `PrivacyInfo.xcprivacy`, no entitlements file.                                                                                                                                                                             | `Project.swift:36`                                                                          |
| B12 | iOS             | Definite compile error: `.foregroundStyle(.hintoPink)`.                                                                                                                                                                                    | `EmailSignInView.swift:53,123`                                                              |
| B13 | Web             | Only sign-in path is `POST /v1/dev/session`. No email OTP, Apple, or Facebook.                                                                                                                                                             | `apps/web/src/api.js:32`, `app.js:89-116`                                                   |
| B14 | Web             | API base URL hardcoded to localhost; nothing sets `window.HINTO_API_BASE_URL`. No static-host config.                                                                                                                                      | `apps/web/src/api.js:1`, `dev-server.mjs`                                                   |
| B15 | Legal           | No Privacy Policy, Terms, support contact, or data-deletion page. iOS links to `hinto.app/privacy` and `/terms`, which nothing serves. Meta login requires privacy URL + data deletion URL.                                                | none exist                                                                                  |
| B16 | Data            | Views and materialized views (`situationships_with_images`, `vote_statistics`, `ai_conversation_analytics`) bypass RLS and are readable with the anon key.                                                                                 | `migrations/002:141`, `006:403`, `007:179`, `008:48`                                        |
| B17 | Data            | Permissive RLS lets any client enumerate `invite_code` on active sessions and read all votes/comments; `daily_usage` is `USING (true)`.                                                                                                    | `migrations/001:316,409`, `003:161-179`                                                     |
| B18 | Auth            | Custom-provider OAuth accepts any `clientRedirectUri` and redirects access/refresh tokens to it (open redirect + token exfiltration).                                                                                                      | `auth-providers.ts:96-113, 717-725`                                                         |

## High

| ID  | Area       | Finding                                                                                                                                                                                             | Location                                                                                                   |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| H1  | Tests      | Profile/situationship test fixtures use `display_name`, `bio`, `privacy`, `status`; schema has `name`, `is_public`, `mutuals_only`, `is_active`. 2 tests fail; seed SQL would fail against real DB. | `__tests__/routes.profile.test.ts`, `seed.fixtures.ts:135-146`                                             |
| H2  | Migrations | Not idempotent, stray `COMMIT;` without `BEGIN`, no `supabase/config.toml`. True remote state unknown.                                                                                              | `supabase/migrations/*`                                                                                    |
| H3  | iOS        | Tokens in `UserDefaults`, not Keychain. `refreshSessionIfNeeded()` never called; 401s swallowed; sessions die after ~1h.                                                                            | `AuthManager.swift:14-49,153`, `APIClient.swift:54`                                                        |
| H4  | iOS        | Vote submission and results are `Task.sleep` mocks; `VotingView` never presented; no universal links / `onOpenURL` for `hinto.app/vote/<code>`.                                                     | `VotingView.swift:174`, `VoteResultsView.swift:169`, `ShareSessionView.swift:148`                          |
| H5  | iOS        | Mock fallbacks and dev sign-in compiled into release.                                                                                                                                               | `SituationshipListView.swift:180-208`, `SituationshipDetailView.swift:211-226`, `AuthManager.swift:62,183` |
| H6  | Repo       | `npm run lint` fails (21 errors) and root `tsc` fails (43 errors), all in legacy tree plus one API test helper. Husky pre-commit hook not installed.                                                | `.eslintignore`, `tsconfig.json`, `.husky/`                                                                |
| H7  | Repo       | Stale `web-build/` (Expo export named `temp-project`) tracked despite `.gitignore`.                                                                                                                 | `web-build/`                                                                                               |
| H8  | Auth       | Apple and Meta identities never land in `auth_identities`; Snapchat handshake is a 501 stub.                                                                                                        | `auth-providers.ts:394-404`, `profile.ts:111-122`                                                          |
| H9  | Product    | No age gate or DOB capture for a 16+ product with AI relationship coaching.                                                                                                                         | onboarding (iOS + web)                                                                                     |
| H10 | Domain     | `hinto.app` (new stack), `hnnt.app` (Cognito), `com.hnnt.app` (legacy bundle), `app.hinto.restart` (Tuist bundle) all coexist.                                                                      | `config.ts:94`, `Project.swift:22`, `app.json:18`                                                          |
| H11 | Web        | Token in `localStorage`, wiped on any bootstrap error; no refresh.                                                                                                                                  | `app.js:3-34, 74-82`                                                                                       |
| H12 | Web        | Voting, results, AI, `/vote/:code` landing, settings, legal, report/block all absent. Developer-facing copy ships to users.                                                                         | `app.js:259-290, 459-488`                                                                                  |
| H13 | API        | No rate limiting; public vote trusts client `voterIdentity`; OTP endpoint unthrottled.                                                                                                              | `voting.ts:329-423`, `auth.ts:17-43`                                                                       |
| H14 | API        | CORS is one hardcoded origin, no allowlist, no `Vary: Origin`.                                                                                                                                      | `config.ts:92-94`, `server.ts:22`                                                                          |

## Medium

- M1 `bio` exists in contract, Swift, and web form but no DB column and the API drops it. `age`/`ageVerified` returned but not in contract. (`profile.ts:39-53`, `contracts/me.ts`)
- M2 `emoji`/`category` optional in contract, required by handler and DB. (`situationships.ts:119-124`)
- M3 Free-tier trigger and CHECK constraint errors surface as 500s instead of 4xx. (`situationships.ts:152-154`)
- M4 Storage: bucket `situationship-images` created, `images.storage_bucket` defaults to `images` (never created). No upload endpoint; photo pickers in iOS are dead affordances. (EX-47)
- M5 `handle_new_user` trigger inserts `NEW.email` into `NOT NULL` column; Facebook users without shared email fail signup. (`001:182-198`)
- M6 Swift optional-clearing impossible (nil omitted from JSON). Errors swallowed with `try?` in list/detail/profile views. Nested `NavigationStack` in `ProfileView`. Stale row after delete from detail sheet.
- M7 `.gitignore` misses `.env.production`, `.env.staging`, `services/api/.env*`. No `.env.example`.
- M8 Root dependency tree is 1000+ packages of Expo/Amplify; `eslint`, `jest`, `prettier` in `dependencies`; junk `js` dependency.
- M9 Stale tooling metadata: `AGENTS.md` mandates a `.codegraph` that does not exist; `.cursor/rules` describes a Vite/Zustand/Prisma stack that never existed.

## Human Testing Required

These cannot be verified in this environment and need a person with the accounts and devices:

1. Apply migrations to the live Supabase project and confirm parity (`supabase db diff`). The remote schema state is unknown because migrations were hand-applied through the SQL editor.
2. Xcode build of the Tuist-generated project on a device; Sign in with Apple on a real Apple ID (requires the capability on the App ID and a provisioning profile).
3. Email OTP delivery end to end (Supabase email template, rate limits, spam placement).
4. Facebook login through Supabase (requires Meta app in Live mode with privacy and data-deletion URLs).
5. Invite link tap on a phone without the app installed (web landing) and with it installed (universal link).
6. Full core loop with two real accounts: create list, share, friend votes, owner sees results.
7. TestFlight upload: icon, privacy manifest, encryption declaration, age rating questionnaire.
8. Provider dashboards: Apple Services ID, Meta App ID, Snapchat and TikTok Login Kit apps, redirect URIs.

## LLM Testing And Evals Required

The AI coach does not exist yet, so nothing can be evaluated today. Once B6 is implemented:

1. Safety evals: self-harm, abuse or coercion disclosures, minors, explicit content. The coach must de-escalate and surface resources, never advise confrontation or retaliation.
2. Scope evals: the coach should decline medical, legal, and diagnostic questions and redirect.
3. Persona and tone evals against the MVP brief ("supportive without being overly clinical", "non-escalatory").
4. Context grounding: responses must reference the user's actual situationship list and vote results when provided, and never fabricate votes or people.
5. Quota and cost: `daily_usage` limits per tier; verify the free-tier cap is enforced server-side.
6. Prompt injection via situationship names, notes, and vote comments (all user-generated and passed into the prompt).
7. Moderation: run inputs and outputs through a moderation endpoint and log flagged conversations for review.

A `packages/prompts` package (EX-52) with fixture conversations and a small Jest eval harness is the recommended home for these.

## App Store Submission Checklist (missing today)

- [ ] 1024x1024 app icon in an asset catalog (B11)
- [ ] `PrivacyInfo.xcprivacy` with UserDefaults reason and collected data types (B11)
- [ ] Sign in with Apple entitlement and working flow (B9)
- [ ] In-app account deletion that deletes server data (B10)
- [ ] Privacy Policy and Terms URLs that resolve (B15)
- [ ] Support URL and email (B15)
- [ ] Age rating decision (likely 17+ for mature/suggestive themes) and an age gate (H9)
- [ ] Report and block for user-generated content (B7)
- [ ] No "coming soon" or placeholder features visible (B6, B9, settings toggles)
- [ ] Production API URL in release configuration, no ATS local-network exception (B8)
- [ ] `ITSAppUsesNonExemptEncryption` declared
- [ ] Bundle ID decision (`app.hinto.restart` is a working name and cannot change after first upload)
- [ ] Associated Domains for `hinto.app/vote/*` if universal links are used (H4)

## Infrastructure Checklist (missing today)

- [ ] `services/api/package.json` with runtime deps only, `Dockerfile`, `PORT` support, `0.0.0.0` bind (B4)
- [ ] CI workflow: `api:build`, `api:test`, lint on the new-stack paths only (B4, H6)
- [ ] `.env.example` listing every variable the API reads (M7)
- [ ] `supabase/config.toml` and a reproducible migration baseline (H2)
- [ ] Web static-host config with SPA rewrite and API base URL injection (B14)
- [ ] One domain decision and DNS: web root, `api.` host, Supabase Site URL and redirect allowlist (H10)
- [ ] Supabase Auth providers enabled: Apple, Facebook, email OTP template
- [ ] Rate limiting in front of `/v1/auth/email/otp` and `/v1/voting-sessions/:code/votes` (H13)
- [ ] Revoke anon/authenticated grants on the leaky views (B16) and tighten voting RLS (B17)

## Recommended Order

1. Backend hardening: B1, B2, B3, B5, H1 (tests green), B18, then B16/B17 via a new migration.
2. Deployability: B4, M7, H6, H7, CI.
3. Missing MVP routes: `DELETE /v1/me` (B10), reports/blocks (B7), AI coach (B6), storage upload (M4).
4. iOS: B12, B8, B9 (Apple via `signInWithIdToken` on a new `POST /v1/auth/apple`), B11, H3, H4, H5.
5. Web: B13, B14, B15 static pages, then voting/results/AI (H12).
6. Human-only: provider dashboards, live Supabase apply, TestFlight, legal copy review.
