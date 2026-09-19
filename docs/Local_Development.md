# HINTO Local Development

This document covers the current restart-era local development path for the shared backend, web shell, and SwiftUI app.

## Current Local Slice

Working local slice in this repo:

- `services/api`: profile and situationship routes, `.env` loading, local CORS, development session bootstrap
- `apps/web`: dependency-light JS shell for onboarding, profile, and situationship management
- `apps/ios`: SwiftUI shell with local API base URL support, local development sign-in, profile editing, and situationship wiring

Still staged:

- real provider auth flows beyond the local development bootstrap
- client wiring for voting session creation, vote submission, results aggregation, and AI flows

## Local Ports

Defaults used by the current repo:

- API: `http://127.0.0.1:3000`
- Web: `http://127.0.0.1:3001`

## Environment

The API now loads the repo-root `.env` automatically when present.

Important environment variables for the current slice:

- `SUPABASE_URL` or `PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` or `PUBLIC_SUPABASE_ANON_KEY`
- `API_HOST`
- `API_PORT`
- `API_CORS_ALLOW_ORIGIN`

If `API_CORS_ALLOW_ORIGIN` is unset, the API defaults to `*` outside production.

## Start The API

Install JS dependencies if they are not present:

```bash
npm install
```

Build and run the API:

```bash
npm run api:build
npm run api:start
```

## Start The Web Shell

The web shell does not need a framework-specific install beyond the repo dependencies.

Run:

```bash
npm run web:dev
```

Then open:

```text
http://127.0.0.1:3001
```

Use the `Use Local API` button to create or refresh the shared development profile through `POST /v1/dev/session`.

## Generate The iOS Project With Tuist

This repo now includes:

- `Project.swift`
- `Workspace.swift`
- `Tuist.swift`

Generate the Xcode project:

```bash
tuist generate
```

The app target uses a hand-written, preprocessed `apps/ios/HINTO/Info.plist`. `HINTOAPIBaseURL` is substituted from the `HINTO_API_BASE_URL` build setting (`http://127.0.0.1:3000` in Debug, `https://api.hinto.app` in Release), and the ATS local-networking exception exists only in Debug. Edit that plist as source; Xcode's plist editor cannot open it.

Override the API base URL at runtime from Xcode by setting the `HINTO_API_BASE_URL` environment variable for the scheme if needed.

Copy `.env.example` to `.env` and set `API_ENABLE_DEV_AUTH=true` for the `Use Local API` button to work; the API refuses dev sessions otherwise.

## Run The SwiftUI App

After `tuist generate`, open the generated workspace or project in Xcode and run the `HINTO` app target.

In debug builds:

- `Use Local API` creates a real local development session through the API
- `Preview Mode` preserves the old fully local mock path when the API is unavailable

## Verification Targets

The current verification goal is:

1. API starts with local `.env`
2. web shell loads at `127.0.0.1:3001`
3. `Use Local API` works in web and SwiftUI
4. profile edit persists
5. situationship create/edit/delete/reorder persists

Voting backend routes now exist in `services/api`, but the web and SwiftUI voting/results experiences should still be treated as staged shells until the new endpoints are wired and exercised against a live Supabase project.
