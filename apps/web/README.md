# HINTO Web Shell

This directory contains the restart-era JS web shell for the first shared vertical slice.

Current scope:

- local development sign-in against `POST /v1/dev/session`
- profile editing against `PATCH /v1/me`
- situationship create, edit, delete, and reorder flows
- honest roadmap panels for voting and AI work that is still backend-blocked

Start locally with:

```bash
npm run web:dev
```
