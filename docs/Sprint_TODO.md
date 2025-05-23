# HNNT MVP – Kan‑ban / Sprint Board

> **Scope:** Tracks all engineering tasks required to deliver the MVP for the Seattle launch as specified in the PRD (v2025‑05‑12).
>
> **Cadence:** 1‑week sprints. Columns are mapped to current sprint focus; cards move **rightward** as they progress.

---

## Legend

\* `[ ]` Todo  `🔄` In Progress  `✅` Done  `🧩` Blocked  `⏩` Deferred
\* **Pts** = story‑points (XS = 1, S = 2, M = 3, L = 5, XL = 8)
\* **Owner** = Lead dev (assign in stand‑up)

---

## Columns

### 📥 Backlog (un‑scheduled)

| ID     | Task                          | Pts | Owner | Status |
| ------ | ----------------------------- | --- | ----- | ------ |
|  BL‑01 | Instagram story share intent  |  M  |      |  [ ]  |
|  BL‑02 | TikTok OAuth login            |  M  |      |  [ ]  |
|  BL‑03 | Internationalization scaffold |  L  |      |  [ ]  |
|  BL‑04 | Public web poll for Pro users |  M  |      |  [ ]  |

---

### 🚀 Sprint 0 (Setup) — \*Week 0 \*

| ID     | Task                                                     | Pts | Owner | Status |
| ------ | -------------------------------------------------------- | --- | ----- | ------ |
|  S0‑01 | Initialize mono‑repo, lint & Husky hooks                 |  S  |      |  ✅  |
|  S0‑02 | Configure Expo + EAS build pipeline                      |  M  |      |  ✅  |
|  S0‑03 | Provision AWS Amplify env (AppSync, Cognito, Dynamo, S3) |  M  |      |  ✅  |
|  S0‑04 | Obtain/secure Snap Kit, Google, TikTok (incomplete) dev creds         |  S  |      |  ✅  |
|  S0‑05 | Add Sentry + Amplitude base SDKs                         |  S  |      |  ⏩  |

---

**Progress Update (Week 0, Day 4):**
- Snap OAuth implementation in progress:
  - Created Lambda function `HITNOauthSnapAuth-dev` for OAuth flow
  - Set up secure credential storage in SSM Parameter Store
  - Configured IAM roles and permissions
  - Integrated with Cognito user pool (us-west-2_G1vzYe7Fm)
- Instagram OAuth implementation:
  - Configured Meta App ID (2033331813827444) in Cognito for Instagram login
  - Added Instagram login button to onboarding screen
  - Integrated with Amplify Auth using Meta platform (Facebook provider with Instagram scopes)
  - Ready for testing with configured callback URLs
  - Note: Using Instagram login instead of Facebook for better user experience
- Google OAuth implementation:
  - ✅ COMPLETE: Configured Google provider in Cognito with client ID (798510659255-2p2fnrcnii2kta3gootr007q9s2k7jbn.apps.googleusercontent.com)
  - ✅ COMPLETE: Set up proper scopes (openid email profile) and attribute mapping
  - ✅ COMPLETE: Configured callback URLs (hnnt://, https://www.hnnt.app/auth/callback/)
  - ✅ COMPLETE: Implemented client-side auth logic with signInWithRedirect
  - ✅ COMPLETE: Added Google login button to onboarding screen
  - Ready for end-to-end testing
- Amplify Backend Updates:
  - Deployed updated GraphQL schema with User, Situationship, Vote, Report, and InviteToken models
  - Updated Lambda functions for auth flow (PostConfirmation, PreSignup, PreTokenGeneration)
  - Configured S3 storage (HITNOmedia) for media assets
  - GraphQL API endpoint deployed: https://4b5xcv6m6vendkjb2skswpao6u.appsync-api.us-west-2.amazonaws.com/graphql
  - Note: Added field-level authorization warnings for User, Situationship, and InviteToken models
- Next steps for OAuth:
  - Set up API Gateway endpoints for Snap OAuth
  - Configure custom domain for API Gateway
  - Update Snap Developer Portal with callback URL
  - Test authentication flows end-to-end
- Remaining tasks:
  - Set up TikTok OAuth (pending credentials)
  - Configure AppSync and DynamoDB
  - Implement remaining Lambda functions
  - Address field-level authorization warnings in GraphQL schema

---

### 🛠️ Sprint 1 (Core Data & Auth) — *Weeks 1–2*

| ID     | Task                                                      | Pts | Owner | Status |
| ------ | --------------------------------------------------------- | --- | ----- | ------ |
|  S1‑01 | Snapchat Login (JWT → Cognito)                            |  M  |      |  🔄  |
|  S1‑02 | Google Sign‑in flow                                       |  M  |      |  ✅  |
|  S1‑03 | Age‑gate (13+) + invite‑code gate                           |  S  |      |  🔄  |
|  S1‑04 | User profile CRUD (username, avatar, privacy toggles)     |  M  |      |  ✅  |
|  S1‑05 | GraphQL schema v1 (User, Situationship) + Amplify codegen |  M  |      |  ✅  |
|  S1‑06 | Situationship add/edit/delete UI                          |  M  |      |  [ ]  |
|  S1‑07 | Local/optimistic cache sync tests                         |  S  |      |  [ ]  |

---

**Progress Update (Week 1, Day 3):**
- User Profile Implementation Complete:
  - ✅ Implemented comprehensive profile fields (bio, displayName, location, website)
  - ✅ Added social links (Instagram, Twitter, Snapchat, TikTok)
  - ✅ Implemented S3 avatar upload with proper error handling
  - ✅ Added form validation for all fields
  - ✅ Implemented privacy controls (isPrivate, mutualsOnly)
  - ✅ Added dark mode support
  - ✅ Integrated with GraphQL schema and types
  - ✅ Added proper TypeScript types and error handling
  - ✅ Implemented optimistic updates for better UX
  - ✅ Added proper loading states and error boundaries
  - ✅ Updated GraphQL schema with field-level validation
  - ✅ Configured S3 bucket permissions for avatar uploads
  - ✅ Added proper error recovery and validation messages
  - ✅ Implemented proper cleanup for file uploads
  - ✅ Added proper TypeScript types for all components
  - ✅ Updated Sprint_TODO.md to mark S1-04 as complete (✅)

- Next steps for profile features:
  - Add profile completion percentage
  - Implement profile analytics
  - Add profile verification badges
  - Implement profile export functionality
  - Add profile sharing deep links
  - Implement profile search functionality

- Remaining tasks for Sprint 1:
  - Complete Snapchat OAuth implementation
  - Finish age and invite code gates
  - Implement situationship management UI
  - Add local/optimistic cache sync tests

---

### 🤖 Sprint 2 (AI & Moderation) — *Weeks 3–4*

| ID     | Task                                             | Pts | Owner | Status |
| ------ | ------------------------------------------------ | --- | ----- | ------ |
|  S2‑01 | Baseten proxy → OpenAI GPT‑4 integration         |  L  |      |  [ ]  |
|  S2‑02 | Chat UI (GiftedChat scaffold + typing indicator) |  M  |      |  [ ]  |
|  S2‑03 | Streaming response hook                          |  M  |      |  [ ]  |
|  S2‑04 | OpenAI Moderation filter service                 |  S  |      |  [ ]  |
|  S2‑05 | Rate‑limit per user (10 msgs/day)                |  S  |      |  [ ]  |

---

### 📋 Sprint 3 (Ranking & Sharing) — *Weeks 5–6*

| ID     | Task                                            | Pts | Owner | Status |
| ------ | ----------------------------------------------- | --- | ----- | ------ |
|  S3‑01 | Drag‑and‑drop ranking (Reanimated 3)            |  M  |      |  [ ]  |
|  S3‑02 | Rank reorder mutation + subscription            |  S  |      |  [ ]  |
|  S3‑03 | Shareable PNG generator (Expo + Canvas)         |  L  |      |  [ ]  |
|  S3‑04 | Snap Creative Kit share flow                    |  M  |      |  [ ]  |
|  S3‑05 | Invite‑link deep‑linking (Branch.io or Amplify) |  M  |      |  [ ]  |

---

### 🗳️ Sprint 4 (Voting & Feedback) — *Weeks 7–8*

| ID     | Task                                    | Pts | Owner | Status |
| ------ | --------------------------------------- | --- | ----- | ------ |
|  S4‑01 | Voting mutation + DB model (Best/Worst) |  M  |      |  [ ]  |
|  S4‑02 | Friend vote UI (modal)                  |  M  |      |  [ ]  |
|  S4‑03 | Real‑time vote aggregation subscription |  M  |      |  [ ]  |
|  S4‑04 | Feedback comment input + moderation     |  M  |      |  [ ]  |
|  S4‑05 | Results screen w/ bar chart             |  S  |      |  [ ]  |

---

### 🛡️ Sprint 5 (Safety & Payments) — *Week 9*

| ID     | Task                                             | Pts | Owner | Status |
| ------ | ------------------------------------------------ | --- | ----- | ------ |
|  S5‑01 | Block/unblock API & UI                           |  S  |      |  [ ]  |
|  S5‑02 | Report flow + admin email alert                  |  S  |      |  [ ]  |
|  S5‑03 | IAP subscription (Apple/Google) + receipt verify |  L  |      |  [ ]  |
|  S5‑04 | Paywall modal + upsell triggers                  |  M  |      |  [ ]  |
|  S5‑05 | Feature gating (situations>5, AI cap)            |  S  |      |  [ ]  |

---

### 🐞 Sprint 6 (Beta & Polish) — *Weeks 10–12*

| ID     | Task                                           | Pts | Owner | Status |
| ------ | ---------------------------------------------- | --- | ----- | ------ |
|  S6‑01 | Closed beta TestFlight build + onboard docs    |  S  |      |  [ ]  |
|  S6‑02 | QA test cases & bug bash                       |  L  |      |  [ ]  |
|  S6‑03 | Push notifications (vote, weekly nudge)        |  M  |      |  [ ]  |
|  S6‑04 | Performance & memory audit                     |  M  |      |  [ ]  |
|  S6‑05 | Accessibility audit (WCAG AA)                  |  M  |      |  [ ]  |
|  S6‑06 | Store listing (screenshots, copy, App Privacy) |  S  |      |  [ ]  |

---

### ✅ Done

*(empty – fill as cards complete)*

---

**Board Owner:** Engineering PM
**Stand‑up cadence:** Daily 10 AM PT
**Review/retro:** End of each sprint (Friday)
**Next update:** Move Sprint 0 cards to 🔄 as soon as setup starts.

**Progress Update (Week 0):**
- ESLint, Prettier, Husky, and lint-staged configured for code quality and pre-commit checks.
- EAS CLI installed and eas.json build config scaffolded.
- AWS Amplify dependencies added and web build configuration set up.
- Web build tested successfully with web-build output directory.
