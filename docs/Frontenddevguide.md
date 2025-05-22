# HNNT / HINTO – Front‑End MVP Guide

*Companion to the PRD (v2025‑05‑12).  Audience: React Native engineers & product designers.*
*Last updated: 2025‑05‑21*

---

## 1  Core Principles

1. **Snap‑native feel** – fast, playful, thumb‑friendly interactions.
2. **Clarity first** – minimal cognitive load; bright hierarchy.
3. **Safety cues** – constant sense of control (privacy, block/report visible).
4. **Accessible fun** – WCAG AA contrast, haptics, motion respectful of `reduceMotion`.

---

## 2  Brand Look‑and‑Feel (MVP Palette)

| Purpose              | Color         | Hex               |
| -------------------- | ------------- | ----------------- |
| Primary Gradient (A) | Pink → Orchid | #FF5F8D → #AF5CFF |
| Accent (Lime Pop)    | #C2FF5F       |                   |
| Surface Light        | #FFFFFF       |                   |
| Surface Dark         | #1B1B1F       |                   |
| Text Primary         | #1B1B1F       |                   |
| Text Muted           | #5F5F6E       |                   |
| Warning / Block      | #FF3366       |                   |

Typography: **Poppins** (Expo Google Fonts) – weights 400 / 600 / 700.  Base font 16 sp; headline 28 sp; caption 12 sp.

Motion: Use **Framer Motion (moti)** spring presets < 250 ms.  Large drag animations via **Reanimated 3**.

---

## 3  Project Structure (Expo / TypeScript)

```
apps/
  hnnt-app/
    app.tsx            ← entry / navigation container
    src/
      components/
      hooks/
      screens/
      navigation/
      graphql/
      theme/
      assets/
      utils/
```

> **Style Engine:** Tailwind‑in‑React‑Native via **NativeWind** (`className` prop).  Utility classes keep designs consistent & easily themeable.

---

## 4  Navigation Architecture

* **React Navigation v6** (Stack + Modal).
* Auth stack ➜ `MainStack` (tabless) ➜ Modal stack.

```
AuthStack
  ├── LoginScreen
  └── AgeGateScreen
MainStack
  ├── HomeScreen             (Situationship List)
  ├── DetailScreen           (AI Chat)
  ├── ResultsScreen          (Friend Feedback)
  ├── SettingsScreen
ModalStack
  ├── AddSituationshipModal
  ├── InviteModal
  ├── SharePreviewModal
  └── BlockReportModal
```

---

## 5  Component Inventory (MVP)

| File                                 | Purpose                                                         | Design Notes                                                                                             |
| ------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **components/SituationshipCard.tsx** | Render card in list with avatar emoji + nickname + drag handle. | Elevation 4; gradient border when `rankIndex===0`. Swipe‑left opens quick actions (delete, view detail). |
| **components/RankDragHandle.tsx**    | 24×24 icon; invisible on long‑press to provide drag anchor.     | Use Reanimated’s `useSharedValue` for smooth reorder.                                                    |
| **components/RankingList.tsx**       | DraggableFlatList wrapper.                                      | Emits `onOrderChange(ids[])` → GraphQL mutation.                                                         |
| **components/ChatBubble.tsx**        | Self vs AI bubbles; support markdown links.                     | Tailwind colors `bg-primary/90` (AI) vs `bg-surfaceDark/85` (user). Speech‑tail via pseudo‑element.      |
| **components/ChatInputBar.tsx**      | TextInput + send + plus‑icon (attach screenshot).               | Detachable; within safe‑area; auto‑grows ≤ 4 lines.                                                      |
| **components/ProgressDots.tsx**      | 3 subtle dots while AI streaming.                               | Animated pulse.                                                                                          |
| **components/VoteOptionCard.tsx**    | Big tappable card for friend vote (Best / Not The One).         | Emoji header (💖 / 🚩) + name. Once selected ➜ bounce animation.                                         |
| **components/ResultBar.tsx**         | Horizontal bar with fill % and avatar overlay for winner.       | Colors: pink positive, lime accent negative.                                                             |
| **components/ShareTemplate.tsx**     | Canvas (expo‑skia) draws branded 1080×1920 PNG.                 | Gradient header, list cards (first‑names), QR invite bottom.                                             |
| **components/BlockButton.tsx**       | IconButton used in profile header.                              | Destructive color #FF3366.                                                                               |
| **components/ReportSheet.tsx**       | BottomSheet for report reasons.                                 | 3 pre‑sets + optional textarea <140 chars.                                                               |
| **components/PaywallSheet.tsx**      | BottomSheet w/ feature comparison and \$4.99 CTA.               | Pricing card outlines free vs Pro. Use accent color for CTA.                                             |

---

## 6  Screens & Data Flow

### 6.1  HomeScreen

* Fetch `listSituationships` (GraphQL).
* Display `RankingList` → reorder triggers optimistic update (Apollo cache first).
* FAB ➜ `AddSituationshipModal`.
* Header share‑icon calls `ShareTemplate` → navigates to `SharePreviewModal`.

### 6.2  AddSituationshipModal

* Formik + Zod validation.
* EmojiPicker component (lazy load).
* On submit run `createSituationship` mutation then dismiss.

### 6.3  DetailScreen (AI Chat)

* Route param: `situationshipId`.
* `useAiChat(situationId)` hook streams messages (SSE).
* Store 20 latest in local SQLite for offline history.

### 6.4  InviteModal

* Generates `InviteLink` via mutation (`generateInvite`).
* ShareSheet with contacts list & Snap share.
* Success snackbar.

### 6.5  VoteScreen (web‑poll or in‑app)

* If deep‑linked and not logged in: show lightweight sign‑up prompt overlay → continue vote.

### 6.6  ResultsScreen

* Subscribes to `onVoteAdded(targetUserId)`.
* Displays `ResultBar` per situation.
* CTA to thank friends (share again).

### 6.7  SettingsScreen

* Toggles: `isPrivate`, `mutualsOnly`, notifications.
* Manage subscription status (if Pro).
* Danger zone: delete account.

---

## 7  Hooks / Context

| Hook                      | Responsibility                                           |
| ------------------------- | -------------------------------------------------------- |
| `useAuth()`               | Provide user object, login/out, subscription info.       |
| `useSituationships()`     | CRUD ops + local cache; handles optimistic reorder.      |
| `useAiChat(id)`           | Stream with Abort Controller; handles token limit error. |
| `useInvite()`             | Create invite link, referral analytics.                  |
| `useVoting(targetUserId)` | Submit vote & real‑time results subscription.            |

Global **ThemeContext** exposes color palette & dark‑mode toggle.  Use `useColorScheme()` and persist choice.

---

## 8  Styling & Theming

* **Tailwind tokens** configured via `tailwind.config.js` (nativewind).  Add custom colors: `primaryGradientStart`, `primaryGradientEnd`, `accentLime`, etc.
* Use utility classes: `bg-primaryGradientStart/90`, `rounded-2xl`, `shadow-lg`, `text-[17px] font-semibold`.
* **Dark Mode:** invert surfaces, keep accent colors; gradients become deeper (#E44577 → #7B3BFF).
* **Haptics:** `react-native-haptic-feedback` on drag‑drop complete, vote tap, paywall open.
* **Accessibility:** ensure tap targets ≥44×44; voiceover labels for icons; dynamic‑type friendly units.

---

## 9  API Layer & State Strategy

* **Apollo Client** with `createAuthLink` (Cognito JWT) ➜ `AppSyncUrl` + `aws-appsync-auth-link`.
* Split links: HTTP for queries/mutations, WebSocket for subscriptions.
* Normalized cache keyed by `__typename:id`.
* Use `react-query` only for REST (OpenAI proxy) calls; keep GraphQL pure for app data.

---

## 10  Testing & QA (Front‑End)

* **Unit**: Jest + Testing Library (RN).
* **E2E**: Detox flows for login, add, reorder, share.
* **Visual**: Percy snapshot diff of key screens (light & dark).

---

## 11  File Checklist (MVP)

```
src/
  components/
    SituationshipCard.tsx
    RankDragHandle.tsx
    RankingList.tsx
    ChatBubble.tsx
    ChatInputBar.tsx
    ProgressDots.tsx
    VoteOptionCard.tsx
    ResultBar.tsx
    ShareTemplate.tsx
    BlockButton.tsx
    ReportSheet.tsx
    PaywallSheet.tsx
  hooks/
    useAuth.ts
    useSituationships.ts
    useAiChat.ts
    useInvite.ts
    useVoting.ts
  screens/
    LoginScreen.tsx
    AgeGateScreen.tsx
    HomeScreen.tsx
    DetailScreen.tsx
    AddSituationshipModal.tsx
    InviteModal.tsx
    VoteScreen.tsx
    ResultsScreen.tsx
    SharePreviewModal.tsx
    SettingsScreen.tsx
  navigation/
    AuthNavigator.tsx
    MainNavigator.tsx
    ModalNavigator.tsx
  graphql/
    mutations.ts
    queries.ts
    subscriptions.ts
  theme/
    colors.ts
    tailwind.config.js
  utils/
    formatDate.ts
    imageExport.ts
```

---

## 12  MVP Cut Rules

* **Must ship**: Login, list CRUD, reorder, AI chat, friend vote, share image, block/report, paywall.
* **Can defer if time**: Dark‑mode polished themes, in‑app contacts import UI (fallback is OS share sheet), micro‑animations beyond base.

---

## 13  Hand‑Off Prompt (for AI co‑dev in Cursor)

> **System Context:** You are a front‑end React Native engineer working on HNNT (Snap‑native dating insight app).  Follow the file architecture above.  Use Expo SDK > 50, TypeScript strict.  Styling = NativeWind Tailwind classes.  Consume GraphQL operations via Apollo hooks (`graphql/queries.ts` etc.).  Drag‑and‑drop ranking uses DraggableFlatList + Reanimated 3.
> **Task:** Implement `<SituationshipCard />` with animated gradient ring when `rankIndex===0`.  Props: `{ situation: { id: string; name: string; emoji: string; rankIndex: number } }`.  Long‑press starts drag via parent callback.  Apply classes: `bg-surfaceLight rounded-2xl p-4 flex-row items-center shadow-lg`.
> **Acceptance:** Renders emoji + name, supports dark‑mode, VoiceOver label "{name} card rank {rankIndex+1}".

Adapt this pattern for each component task.  Keep commits atomic and reference card IDs from Kan-ban (e.g., `S3-01`).

---

**Document Owner:** Front‑End Lead
**Next Review:** prior to Sprint 1 kickoff.
