# HINTO Launch Readiness Audit

_Created: 2026-09-20_
_Branch audited: `restart-plan` (b63e6ca), which is ahead of `main`_

## Purpose

What blocks a live, functional deployment of the AWS stack (`api.hnnt.app` on ECS + RDS Postgres, `hnnt.app` on CloudFront + S3, native SwiftUI iOS `app.hnnt`)? This complements `docs/Operational_Readiness_Checklist.md`, which lists the operator steps; this document lists the code and product gaps found by review.

Verification at audit time: `npm run api:build` passes, `npm run api:test` 107/107, `npm run web:test` 7/7, `npm run lint` clean. No Swift toolchain here, so iOS findings are from static reading.

## Bottom Line

The backend is deployable and most product routes run on RDS. Three things stop a public launch:

1. The **AI coach does not work on AWS**. `services/api/src/routes/ai.ts` is 100% Supabase; with only `DATABASE_URL` set every coach route throws "Missing SUPABASE_URL". The iOS coach tab returns random canned strings. The coach is a headline feature in the onboarding copy.
2. **No account deletion exists**. There is no `DELETE /v1/me`; the iOS "Delete Account" button only signs out. App Store Guideline 5.1.1(v) requires working in-app deletion.
3. **No public legal pages**. `/privacy` and `/terms` on web are placeholder text. The 2,400-word Privacy Policy and 3,000-word Terms drafts exist only as `.docx` at the repo root with `[COMPANY LEGAL NAME]`, `[STREET ADDRESS]`, `[CONTACT EMAIL]` unfilled. App Store Connect and Meta both require live URLs.

Everything else is hardening, operator steps, or provider-portal work.

## Blockers

| ID  | Area    | Finding                                                                                                                                                                                                                                                                                                                                        | Location                                                                         |
| --- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| B1  | AI      | Coach routes have no Postgres path (0 `shouldUsePostgres` guards, 6 Supabase call sites). `ai_conversations`, `ai_messages`, `daily_usage` already exist in `db/migrations/002`. Port to `postgres-core.ts`.                                                                                                                                   | `services/api/src/routes/ai.ts`                                                  |
| B2  | AI      | iOS `ChatView` sleeps 1.5s and returns one of five canned strings; never calls `/v1/me/conversations`.                                                                                                                                                                                                                                         | `apps/ios/.../Views/Chat/ChatView.swift:123-143`                                 |
| B3  | Account | No `DELETE /v1/me` route. iOS delete-account dialog calls `auth.signOut()` only. Web has no delete flow.                                                                                                                                                                                                                                        | `services/api/src/routes.ts`, `ProfileView.swift:56-58`                          |
| B4  | Legal   | Privacy, Terms, support, and data-deletion instructions are not served anywhere. Web routes render placeholder copy; landing page has no links; iOS links to `hnnt.app/privacy` and `/terms` which show placeholders. Drafts exist as root `.docx` files with placeholders unfilled.                                                             | `apps/web/src/app-core.js:929-947`, `apps/web/landing/index.html`, root `*.docx` |
| B5  | Auth    | Email OTP has no Postgres path: `handleEmailOtp`/`handleEmailVerify` call Supabase Auth unless the dev bypass is on. In production the OTP button 500s. Either wire SES + `email_magic_links` (table exists in `db/migrations/001`) or hide OTP and ship password + Apple only. `SES_FROM_EMAIL` is read into config but nothing sends email. | `services/api/src/routes/auth.ts:254-400`                                        |
| B6  | Auth    | Snapchat and TikTok callbacks are 100% Supabase (`ensureAuthUserForIdentity`, `bootstrapSupabaseSession` use `auth.admin.*`). In production they 500 after the provider redirects back. Owner is working on providers; port to `postgres-auth.ts`.                                                                                             | `services/api/src/routes/auth-providers.ts:468-680`                              |
| B7  | Config  | Production boots with no `DATABASE_URL` (every route then tries Supabase), and the refresh-token hash pepper falls back to the literal `hinto-local-auth-pepper` when `REFRESH_TOKEN_PEPPER`, `AUTH_STATE_SECRET`, and `JWT_ACCESS_TOKEN_SECRET` are all unset. Nothing refuses `ENABLE_DEVELOPMENT_AUTH=true` in production.                     | `services/api/src/config.ts`, `repositories/postgres-auth.ts:50-56`              |
| B8  | iOS     | No app icon (`resources: []`, no asset catalog), no `PrivacyInfo.xcprivacy`, `NSAllowsLocalNetworking` shipped in all configurations, no associated-domains entitlement for `hnnt.app/vote/<code>`. App Store Connect rejects the upload without the icon and privacy manifest.                                                                    | `Project.swift`                                                                  |
| B9  | iOS     | "Continue with Facebook" renders and throws "sign-in coming soon". Placeholder features are a 2.1 rejection.                                                                                                                                                                                                                                    | `AuthManager.swift:222,430`, `OnboardingView.swift`                              |

## High

| ID  | Area   | Finding                                                                                                                                                                                                                   | Location                                                    |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| H1  | iOS    | Access and refresh tokens stored in `UserDefaults` (plaintext, backed up). Move to Keychain.                                                                                                                              | `AuthManager.swift:30-61`                                   |
| H2  | Deploy | `db/migrations` has no runner. Docs say "run from inside the VPC" with no script, no tracking table, no CI step. Staging RDS schema state is unknown.                                                                       | `db/`, `infra/aws/staging-resources.md:190`                 |
| H3  | Deploy | Only workflow is `deploy-api-staging.yml`, triggered on `main`. The live code is on `restart-plan`, which is 14 commits ahead of `main`. No CI runs tests or lint on any branch. No web deploy workflow (landing README documents a manual `aws s3 sync`). | `.github/workflows/`                                        |
| H4  | API    | No rate limiting anywhere: password sign-in, OTP, public vote submission, feed votes. Add per-IP limits at least on `/v1/auth/*` and `/v1/voting-sessions/*/votes`.                                                        | `services/api/src/server.ts`                                |
| H5  | API    | No request timeout, body-size limit is per-route only, no security headers, no graceful `SIGTERM` handling for ECS deployments, no `unhandledRejection` handler.                                                          | `services/api/src/server.ts`                                |
| H6  | Web    | `/app/coach` route exists; verify it is wired (API client has no `/v1/me/conversations` calls, so it is likely a placeholder). Web has no delete-account or report/block UI.                                              | `apps/web/src/api.js`, `app-core.js:128`                    |
| H7  | Legacy | `ios/` (Expo native shell, 70 files), `web-build/` (23 files, ignored by `.gitignore` but tracked), and `apps/hnnt-app` remain in the tree; `CLAUDE.md` still says Supabase is the target and `npm start` starts Expo.       | root                                                        |
| H8  | Docs   | Absolute local paths (`/Users/benjamincox/Downloads/HINTO/...`) used as links in `docs/*.md` and `infra/aws/*.md`; they break for everyone else.                                                                          | `docs/`, `infra/aws/`                                       |

## Medium

- M1 Access tokens are opaque 7-day tokens with 90-day refresh; sign-out does not appear to revoke server-side. Verify `auth_sessions` revocation on sign-out.
- M2 `db.ts` uses `rejectUnauthorized: false` for `sslmode=require`; use the RDS CA bundle.
- M3 Media uploads are base64 JSON (5 MB cap) through the API task rather than presigned S3 PUTs; fine for MVP, costs task memory.
- M4 iOS `APIClient` returns `.unauthorized` on 401 but callers do not refresh and retry; sessions silently break after the 7-day access token expires.
- M5 No age gate in onboarding for a 16+ product; profile `age` exists in schema.
- M6 `apps/web/landing/index.html` is a "coming soon" page with no navigation to the app, legal pages, or support.
- M7 `ChatBubbleView` typing animation and design are fine; `AuthError.providerNotImplemented` copy "coming soon" should not be reachable from any visible button.

## Human Testing Required

1. Apply `db/migrations/001-008` to staging RDS (via the runner added in this session, run from a one-shot ECS task or through the SSM tunnel) and confirm the ECS task turns healthy at `https://api.hnnt.app/health`.
2. Merge `restart-plan` into `main` (or retarget the deploy workflow) so the staging deploy actually runs.
3. Xcode: build the Tuist project, run on a device, Sign in with Apple against `api.hnnt.app`, password sign-up and sign-in, avatar and situationship image upload, feed post + vote, voting link on a second device.
4. SES: verify `hnnt.app` domain identity, DKIM, and sandbox exit before enabling OTP.
5. Provider portals: Apple Services ID and key rotation (checklist notes the `.p8` was exposed), Meta app with privacy and data-deletion URLs, Snapchat and TikTok redirect URIs.
6. TestFlight upload: icon, privacy manifest, encryption declaration, age rating (likely 17+).
7. Legal: fill `[COMPANY LEGAL NAME]`, `[STREET ADDRESS]`, contact emails, effective dates; counsel review.
8. CloudFront: confirm the web build (not just the landing page) is what you want at `hnnt.app`, or pick `app.hnnt.app`.

## LLM Testing And Evals Required

Once B1 is fixed and `OPENAI_API_KEY` is set on the task definition:

1. Safety: self-harm, abuse, coercion, minors, explicit content. Must de-escalate and surface resources.
2. Scope: decline medical, legal, diagnostic questions.
3. Tone: matches `docs/Canonical_MVP_Brief.md` ("supportive without being clinical").
4. Grounding: references the user's real list and vote results; never invents people or votes.
5. Prompt injection through situationship names, notes, feed comments.
6. Quota: `daily_usage` cap enforced server-side per tier; cost cap per day.
7. Moderation: inputs and outputs run through moderation; flagged turns logged for review.

Recommended home: `packages/prompts/evals/` with fixture conversations and a Jest harness that runs only when the key is present.

## Recommended Order

1. B7 config fail-fast, B3 account deletion, B1 AI coach on Postgres (backend), H4/H5 server hardening, H2 migration runner, H3 CI.
2. B4 legal pages on web + landing links; B2/B8/B9/H1/M4 iOS.
3. B5 OTP via SES or hide; B6 provider callbacks on Postgres (owner).
4. Human list above.
