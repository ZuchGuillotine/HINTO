# Legacy AWS / Amplify / Cognito / AppSync Audit

Created: 2026-03-27

Scope: audit only. No product code was changed. Codegraph was used to identify active coupling points before classifying legacy surfaces.

## Executive Summary

The repo still contains a live Amplify/Cognito/AppSync client path that blocks the first backend/client slice. The highest-risk surfaces are:

- root app bootstrap in `App.tsx`
- auth state in `apps/hnnt-app/src/hooks/useAuth.tsx`
- profile state in `apps/hnnt-app/src/context/useUserProfile.tsx`
- situationship state in `apps/hnnt-app/src/context/useSituationships.tsx`

Those are not just references. They are wired into the current screens and navigation, so they must be replaced or isolated before the restart can move to a Supabase-backed HTTP API.

Legacy backend assets under `amplify/`, AWS helper scripts, and the Expo/Amplify iOS shell can wait until replacements exist. They are not the first-slice blocker unless the team keeps trying to run the old stack.

## Active Code Path Blockers

### 1. Root app bootstrap still hard-codes Amplify/Cognito

`App.tsx:21-58` configures `Amplify` directly and imports `./apps/hnnt-app/amplifyconfiguration.json`, which does not exist in the repo. `index.ts` registers this `App` as the root component, so this is the actual bootstrap path.

Why this matters:

- the app cannot be treated as backend-neutral while the root entry still owns Cognito setup
- the missing `amplifyconfiguration.json` import is a live startup risk, not a cosmetic issue

### 2. `useAuth` is the central auth coupling point

`apps/hnnt-app/src/hooks/useAuth.tsx` uses `@aws-amplify/core` and `@aws-amplify/auth` throughout the provider lifecycle. It maps Cognito users into local app state and drives sign-in, sign-up, confirmation, sign-out, and redirect auth flows.

Codegraph signals:

- `useAuth` has 4 direct callers
- `mapCognitoUserToAppUser` has 4 transitive dependents
- `checkCurrentUser` is internal but part of the same auth boot path

Why this matters:

- `AppRoot`, `EmailLoginScreen`, and `SituationshipsProvider` all depend on it
- replacing this hook is a prerequisite for swapping in Supabase-backed session handling

### 3. Profile flow still uses AppSync plus Cognito sign-out

`apps/hnnt-app/src/context/useUserProfile.tsx` calls `generateClient()` from Amplify, fetches `getUser`, `updateUser`, and `deleteUser` through GraphQL, and signs out through Amplify after deletion.

`apps/hnnt-app/src/screens/ProfileScreen.tsx` consumes that context directly and also uses `uploadAvatar`.

Why this matters:

- profile is part of the first vertical slice, so this is a live blocker
- update/delete behavior is still coupled to AppSync schema shape

### 4. Situationship flow still uses AppSync query/mutation paths

`apps/hnnt-app/src/context/useSituationships.tsx` uses Amplify GraphQL and Cognito user lookup to:

- list situationships
- reorder situationships
- submit votes

Codegraph signals:

- `useSituationships` is exported and consumed by the list screen and list component
- `reorder` has 6 transitive dependents
- `submitVote` has 6 transitive dependents

Why this matters:

- this is the other half of the first vertical slice
- the current screen tree already expects these behaviors, so the replacement must be contract-first, not ad hoc

### 5. Helper utilities still assume Cognito and AWS storage

`apps/hnnt-app/src/utils/auth.ts` contains Cognito redirect handling, hosted-UI assumptions, and provider branches for Google, Instagram, Snapchat, TikTok, and email.

`apps/hnnt-app/src/utils/upload.ts` uses `@aws-amplify/storage` and `getCurrentUser()` to upload and delete avatars in S3-like storage.

Why this matters:

- `LoginScreen`, `OnboardingScreen`, and `ProfileScreen` import these helpers
- the first slice can defer rich social provider work, but it cannot keep depending on AWS-specific redirect logic

## Config And Dependency Surface

### Package dependencies

`package.json:16-24` and `package.json:66-80` still include:

- `@aws-amplify/api`
- `@aws-amplify/auth`
- `@aws-amplify/core`
- `@aws-amplify/storage`
- `@aws-amplify/react-native`
- `@aws-amplify/rtn-web-browser`
- `@aws-amplify/backend`
- `@aws-amplify/backend-cli`
- `aws-cdk-lib`
- `@aws-sdk/types`

This is acceptable as a legacy residue, but it should not expand. It is a migration cost center.

### Hardcoded Cognito config

`apps/hnnt-app/src/config/auth.ts:1-8` hardcodes the Cognito domain and redirect URLs.

`apps/hnnt-app/src/config/amplify.ts:9-34` hardcodes user pool, client ID, and identity pool IDs.

These files are legacy configuration, not restart architecture.

### Amplify backend artifacts

`amplify/backend/backend-config.json:2-37` and `amplify/backend/backend-config.json:39-110` still declare:

- AppSync as the API service
- Cognito as the auth service
- Lambda triggers for Cognito events

`amplify/backend/api/hinto/schema.graphql:1-103` shows the old owner/group-based GraphQL model for `User`, `Situationship`, `Vote`, `Report`, and `InviteToken`.

`amplify/backend/auth/HITNOauth/cli-inputs.json:3-92` still contains hosted-UI, social provider, and callback URL configuration for Google and Facebook.

These are valuable as salvage input, but they are legacy-only from the restart perspective.

## Scripts

`scripts/update-cognito-redirects.sh:1-51` updates Cognito redirect URIs with AWS CLI calls.

`scripts/create-test-user.sh:1-37` creates Cognito test users and sets passwords.

These are operationally tied to the old auth stack. They can wait until archival unless someone is still depending on them for manual development.

## Native Refs

The iOS shell is still Expo-based and not the target SwiftUI architecture:

- `ios/Podfile:1-39`
- `ios/Podfile.lock`
- `ios/Podfile.properties.json:1-4`
- `ios/hinto/Supporting/Expo.plist:1-12`
- `ios/hinto/AppDelegate.swift`
- `ios/hinto.xcodeproj/project.pbxproj`

`ios/Podfile.lock` still references `AmplifyRTNCore` and `AmplifyRTNWebBrowser`, which confirms the shell is still carrying Amplify runtime pieces.

This is reference material for the restart, not the end-state native architecture.

## Archive-Only Legacy

These are useful as history or salvage, but they should not drive the restart:

- `apps/hnnt-app/src/App.tsx` is a duplicate app entry and is not the root entry used by `index.ts`
- `apps/hnnt-app/src/context/useSituationships-backup.tsx` is backup legacy state
- `lambda/snap-auth/` is an AWS-specific auth experiment
- `ProjectArchitecture.md`, `CHANGELOG.md`, and `UPGRADE_SUMMARY.md` are historical AWS-era docs
- `amplify/` remains legacy-heavy and should be treated as read-only salvage unless a specific migration task requires it

## What Blocks The First Slice

The first slice is profile + situationship CRUD/reorder against a new backend boundary.

Blocking items:

- root `App.tsx` still initializes Amplify/Cognito
- `useAuth` still owns Cognito session state
- `useUserProfile` still fetches profile data through AppSync
- `useSituationships` still fetches/reorders/votes through AppSync
- `uploadAvatar` still assumes AWS storage

## What Can Wait

These can be deferred until the replacement path exists:

- `scripts/update-cognito-redirects.sh`
- `scripts/create-test-user.sh`
- `amplify/backend/**`
- `lambda/snap-auth/**`
- `ios/` Expo shell files
- backup legacy context files

## Recommended Follow-Up Tasks

1. Replace the root app bootstrap with a backend-neutral auth/session boundary.
2. Move profile and situationship reads/writes behind the new HTTP API contract.
3. Quarantine AWS scripts and `amplify/` behind legacy documentation only.
4. Preserve the schema vocabulary from `amplify/backend/api/hinto/schema.graphql`, but do not preserve its transport or auth assumptions.
