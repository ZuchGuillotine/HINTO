# HINTO Web Shell

This directory contains the restart-era JS web shell for the first shared vertical slice.

Current scope:

- local development sign-in against `POST /v1/dev/session`
- profile editing against `PATCH /v1/me`
- situationship create, edit, delete, and reorder flows
- owner voting session creation and results loading against the shared API
- public invite-code vote loading and vote submission testing against the shared API
- AI remains an intentionally staged shell until `/packages/prompts` and conversation routes exist

Start locally with:

```bash
npm run web:dev
```

Run the web Jest suite with:

```bash
npm run web:test
```

Build static deployable assets with:

```bash
npm run web:build:staging
```

The build writes `apps/web/dist` and injects `WEB_API_BASE_URL`, defaulting to
`https://api.hnnt.app` for staging-style static hosting.
