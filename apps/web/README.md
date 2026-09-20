# HINTO Web Shell

This directory contains the restart-era JS web shell for the first shared vertical slice.

Current scope:

- local development sign-in against `POST /v1/dev/session`
- profile editing against `PATCH /v1/me`
- situationship create, edit, delete, and reorder flows
- owner voting session creation and results loading against the shared API
- public invite-code vote loading and vote submission testing against the shared API
- hnnt coach at `/app/hnnt` against `/v1/me/conversations*` (list, create, open, delete, send;
  shows `dailyUsage`, friendly `quota_exceeded` / `rate_limited` copy, and a "Coach unavailable"
  state when `me.capabilities.canUseAiCoach` is `false`)
- settings: delete account (`DELETE /v1/me`), blocked users (`/v1/me/blocks`), and a report form
  (`POST /v1/reports`) reachable from settings, feed posts, and vote comments
- session refresh: `api.js` retries a request once after a 401 by calling `POST /v1/auth/refresh`
  with the stored refresh token; network errors never clear the stored session

## Legal pages

`apps/web/legal/` holds static, self-contained pages (no JS, inline CSS):

| File                 | Clean URL        | Purpose                                          |
| -------------------- | ---------------- | ------------------------------------------------ |
| `privacy.html`       | `/privacy`       | Privacy Policy (draft, converted from the docx)  |
| `terms.html`         | `/terms`         | Terms of Service (draft, converted from the docx) |
| `support.html`       | `/support`       | Contact, reporting, deletion, minimum age        |
| `data-deletion.html` | `/data-deletion` | Meta "Data Deletion Instructions URL" target     |

Both drafts carry a "pending legal review" banner and keep every counsel placeholder
(`[COMPANY LEGAL NAME]`, `[STREET ADDRESS]`, `[ZIP]`, `[PRIVACY CONTACT EMAIL]`,
`[LEGAL CONTACT EMAIL]`) wrapped in `<mark class="placeholder">`. Regenerate them from the root
`HINTO_*_DRAFT.docx` files when counsel updates the drafts, then remove the banner once they are
in effect.

The dev server serves the clean URLs directly. The app router (`app-core.js`) renders the same
pages inline at those routes by fetching `/legal/<name>.html` and extracting `article.legal`, and
falls back to a link when that fails. The build copies `apps/web/legal` to `dist/legal`.

In production the clean URLs (which iOS, App Store Connect, and Meta point at) need a CloudFront
rewrite to `/legal/<name>.html`; the `/legal/*.html` paths work on any static host.

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
