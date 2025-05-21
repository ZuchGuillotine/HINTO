# HNNT / HINTO – Project Requirements Document (PRD)

*Last updated: 2025‑05‑12*

---

## 1  Overview

### 1.1  Purpose

Provide a definitive, engineering‑ready reference that translates HNNT’s product vision into clear, testable requirements for the cross‑functional development team.  This PRD focuses on the **MVP scope for a Seattle‑only launch** while outlining guard‑rails for future expansion.

### 1.2  Background

HNNT is a mobile relationship ranking & coaching app that blends **AI advice** with **friend voting** to help young women (16‑30) navigate “situationships.”  Virality depends on social sharing and invite‑driven feedback loops.  Safety, privacy, and positivity are non‑negotiable.

---

## 2  Objectives & Success Metrics

| Goal              | KPI                                              | MVP Target           |
| ----------------- | ------------------------------------------------ | -------------------- |
| Viral acquisition | K‑factor (invites × conversion)                  | ≥ 1.2 within 30 days |
| Engagement        | D1 retention                                     | ≥ 55 %               |
| Core utility      | Avg. AI chats per weekly active                  | ≥ 5                  |
| Monetization      | Free‑to‑paid conversion                          | ≥ 3 % within 60 days |
| Safety            | < 0.2 % content reports confirmed TOS violations | ≤ 0.2 %              |

---

## 3  Target Users & Personas

1. **College Socialite “Jess” (19)** – heavy Snapchat/TikTok, shares everything with close friends.
2. **Young Pro “Maya” (24)** – busy Amazon intern, uses AI for quick clarity, values anonymity.
3. **High‑schooler “Liv” (17)** – seeks friend feedback, parents expect safe environment.

Key motivators: relationship clarity, validation, entertainment, social proof.

---

## 4  Scope

### 4.1  In‑Scope (MVP)

* iOS & Android mobile app via **React Native + Expo**
* Social OAuth (Snapchat, Google, TikTok)
* Add/edit/delete **Situationships** (≤ 5 free)
* Drag‑and‑drop ranking list
* **AI Coach chat** (GPT‑4 via OpenAI) – 10 msgs/day free cap
* Friend **vote & comment** flow (mutuals‑only by default)
* Shareable image/story generator (Snap Kit Creative Kit)
* Invite links + referral tracking
* Safety: block, report, content moderation, rate limits
* Basic analytics (Amplitude), crash/error logging (Sentry)

### 4.2  Out‑of‑Scope / Phase 2+

* Web client
* SMS inbox parsing or dating‑app integrations
* Global launch & localization
* Public community feed
* Advanced AI plans (Breakup Plan, Radar Alerts)

---

## 5  Functional Requirements

### 5.1  Onboarding & Authentication

|  ID      | Requirement                                            | Priority | Acceptance Criteria                                      |
| -------- | ------------------------------------------------------ | -------- | -------------------------------------------------------- |
|  AUTH‑1  | Users can sign up/in with Snapchat, Google, or TikTok. | P0       | JWT token issued via AWS Cognito; account appears in DB. |
|  AUTH‑2  | Age gate; users under 16 cannot proceed.               | P0       | DOB check blocks under‑16; 16–17 flagged as minor.       |
|  AUTH‑3  | Invite‑code gate toggle (config flag).                 | P1       | When enabled, signup requires valid code.                |

### 5.2  Profile & Privacy

* PROF‑1 (P0): Users select username, avatar (Bitmoji if Snap) ✱ unique.
* PROF‑2 (P0): Toggle **Public / Private** profile.
* PROF‑3 (P1): Toggle **Mutuals‑Only Engagement**.

### 5.3  Situationship Management

* SITU‑1 (P0): Add card with name (25 chars), tag, optional emoji.
* SITU‑2 (P0): Max 5 cards for free tier; attempt to add 6th triggers upsell.
* SITU‑3 (P0): Drag‑and‑drop reorder updates `rankIndex` in ≤ 200 ms.

### 5.4  AI Coaching

* AI‑1 (P0): Send/receive messages; first token in ≤ 3 s (p95).
* AI‑2 (P0): System prompt enforces positive, PG‑13 advice; output moderated.
* AI‑3 (P1): Streaming responses with typing indicator.

### 5.5  Voting & Feedback

* VOTE‑1 (P0): Owner can generate invite link scoped to one session (expires 48 h).
* VOTE‑2 (P0): Friend selects **Best Fit** & **Not the One**; optional 140‑char comment.
* VOTE‑3 (P0): Owner sees aggregated results in real‑time via GraphQL subscription.

### 5.6  Sharing & Invites

* SHARE‑1 (P0): Generate 1080×1920 PNG preview of ranked list.
* SHARE‑2 (P0): One‑tap share to Snapchat Story via Creative Kit.
* SHARE‑3 (P1): Instagram Story & TikTok share intents.

### 5.7  Safety & Moderation

* SAFE‑1 (P0): Any user can **block** another; blocked ID blacklisted at API level.
* SAFE‑2 (P0): **Report** user/content; auto‑hide after ≥ 3 unique reports or moderator action.
* SAFE‑3 (P0): All UGC passes through OpenAI Moderation; blocked content returns error 422.

### 5.8  Monetization

* MON‑1 (P0): **Subscription** via Apple/Google IAP; entitlements stored in Cognito attr `plan=pro`.
* MON‑2 (P1): One‑time **Anonymous Voting** add‑on; flag `anonVoting=true` for 72 h.
* MON‑3 (P2): Paywall screen reachable from upsell events and settings.

### 5.9  Analytics & Admin

* ANALYT‑1 (P0): Track core events (sign\_up, add\_situation, share, vote, ai\_message, purchase).
* ADMIN‑1 (P1): Web dashboard (internal) for reports triage & user search.

---

## 6  Non‑Functional Requirements

| Category            | Requirement                                                                          |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Performance**     | API p95 < 300 ms; AI p95 first‑token < 3 s.                                          |
| **Scalability**     | Handle 10k concurrent users with auto‑scaling Lambda/AppSync.                        |
| **Availability**    | 99.9 % app services uptime.                                                          |
| **Security**        | End‑to‑end TLS, JWT auth, OWASP M obile TOP 10 mitigations, GDPR & CCPA data rights. |
| **Privacy**         | Minimal PII; no storing last names of situationships.                                |
| **Accessibility**   | WCAG 2.1 AA for color contrast and voiceover labels.                                 |
| **Localization**    | English only MVP; framework ready for i18n.                                          |
| **Maintainability** | IaC via Amplify; CI/CD with Expo EAS & GitHub Actions.                               |

---

## 7  Technical Stack & Constraints

| Layer         | Choice                                                                 | Notes                                      |
| ------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| **Mobile**    | React Native + Expo SDK > 50                                           | OTA updates; Reanimated 3 for drag‑n‑drop. |
| **OAuth**     | Snap Kit Login, Google Sign‑In, TikTok OAuth 2.0                       | Must handle token refresh.                 |
| **Backend**   | AWS Amplify (AppSync + DynamoDB + S3 + Lambda + Cognito)               | Serverless, pay‑per‑use.                   |
| **AI**        | OpenAI GPT‑4 (chat‑completions) via Baseten proxy                      | Fallback to GPT‑3.5 if quota.              |
| **CDN**       | CloudFront for images and meta‑tags.                                   |                                            |
| **Analytics** | Amplitude SDK; Sentry for error monitoring.                            |                                            |
| **CI/CD**     | GitHub Actions (lint, test, EAS build ==> TestFlight/G‑Play Internal). |                                            |

Constraints:

* Only use public, review‑safe iOS/Android SDKs to avoid store rejections.
* No storing any user contact list on server; contacts are processed client‑side for invitations.
* First release limited to US region endpoints for GDPR & COPPA simplicity.

---

## 8  External Dependencies

* **Apple/Google IAP** – subscription validation.
* **Snapchat Kit** – subject to Snap TOS; must show Snap ID during login.
* **OpenAI API** – SLA > 99 %; contingencies: fallback model.
* **Amplitude** – analytics ingestion.

---

## 9  Milestones & Timeline (Indicative)

| Phase                        | Duration | Deliverables                                        |
| ---------------------------- | -------- | --------------------------------------------------- |
| **0 – Setup**                | 1 wk     | Repo, CI/CD, Amplify env, Snap/TikTok dev approval. |
| **1 – Core Data & Auth**     | 2 wks    | Login, user profiles, situationship CRUD.           |
| **2 – AI Chat & Moderation** | 3 wks    | AI coach MVP, moderation pipeline.                  |
| **3 – Ranking & Sharing**    | 2 wks    | Drag‑drop reorder, share image, invite links.       |
| **4 – Voting & Feedback**    | 2 wks    | Friend voting UI, real‑time updates.                |
| **5 – Safety & Paywall**     | 1 wk     | Block/report, subscription flow.                    |
| **6 – Beta & Bug Bash**      | 3 wks    | Closed beta, telemetry, polish.                     |
| **7 – Seattle Launch**       | 1 wk     | App Store/Play release, ambassador onboarding.      |

---

## 10  Risks & Mitigations

| Risk                       | Impact         | Mitigation                                          |
| -------------------------- | -------------- | --------------------------------------------------- |
| AI latency spikes          | Poor UX        | Baseten autoscaling, partial streaming.             |
| Viral spike overload       | Downtime       | Serverless scaling, on‑call rotation.               |
| Content abuse              | Brand harm     | Aggressive moderation filters & fast human review.  |
| Platform SDK changes       | Login breakage | Monitor SDK deprecations; keep versions pinned.     |
| App Store policy rejection | Delay launch   | Early review of policies, TestFlight feedback loop. |

---

## 11  Future Considerations

* Web dashboard for users to export AI chats.
* Dating‑app message analysis ingest.
* Local‑first data model for offline support.
* Additional revenue streams (brand collabs, higher tier).

---

**Document Owner:** Product Lead / PM
**Review Cadence:** Weekly during MVP build; update version & date on revisions.
