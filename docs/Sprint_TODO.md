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
|  BL‑01 | Instagram story share intent  |  M  |       |  \[ ]  |
|  BL‑02 | TikTok OAuth login            |  M  |       |  \[ ]  |
|  BL‑03 | Internationalization scaffold |  L  |       |  \[ ]  |
|  BL‑04 | Public web poll for Pro users |  M  |       |  \[ ]  |

---

### 🚀 Sprint 0 (Setup) — \*Week 0 \*

| ID     | Task                                                     | Pts | Owner | Status |
| ------ | -------------------------------------------------------- | --- | ----- | ------ |
|  S0‑01 | Initialize mono‑repo, lint & Husky hooks                 |  S  |      |  ✅  |
|  S0‑02 | Configure Expo + EAS build pipeline                      |  M  |      |  ✅  |
|  S0‑03 | Provision AWS Amplify env (AppSync, Cognito, Dynamo, S3) |  M  |      |  🔄  |
|  S0‑04 | Obtain/secure Snap Kit, Google, TikTok dev creds         |  S  |      |  🔄  |
|  S0‑05 | Add Sentry + Amplitude base SDKs                         |  S  |      |  [ ] |

---

**Progress Update (Week 0, Day 4):**
- Snap OAuth implementation in progress:
  - Created Lambda function `HITNOauthSnapAuth-dev` for OAuth flow
  - Set up secure credential storage in SSM Parameter Store
  - Configured IAM roles and permissions
  - Integrated with Cognito user pool (us-west-2_G1vzYe7Fm)
- Next steps for Snap OAuth:
  - Set up API Gateway endpoints
  - Configure custom domain
  - Update Snap Developer Portal
  - Test authentication flow
- Remaining tasks:
  - Complete Google OAuth configuration
  - Set up TikTok OAuth (pending credentials)
  - Configure AppSync and DynamoDB
  - Implement remaining Lambda functions

---

### 🛠️ Sprint 1 (Core Data & Auth) — *Weeks 1–2*

| ID     | Task                                                      | Pts | Owner | Status |
| ------ | --------------------------------------------------------- | --- | ----- | ------ |
|  S1‑01 | Snapchat Login (JWT → Cognito)                            |  M  |      |  🔄  |
|  S1‑02 | Google Sign‑in flow                                       |  M  |      |  [ ]  |
|  S1‑03 | Age‑gate + invite‑code gate                               |  S  |       |  \[ ]  |
|  S1‑04 | User profile CRUD (username, avatar, privacy toggles)     |  M  |       |  \[ ]  |
|  S1‑05 | GraphQL schema v1 (User, Situationship) + Amplify codegen |  M  |       |  \[ ]  |
|  S1‑06 | Situationship add/edit/delete UI                          |  M  |       |  \[ ]  |
|  S1‑07 | Local/optimistic cache sync tests                         |  S  |       |  \[ ]  |

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
