# HINTO Web

The web client for HINTO: a private ranked list, friend voting via invite links, and the AI coach.
It is plain HTML, CSS, and ES modules served as static files. No bundler, no framework, no npm
packages.

```
apps/web/
  src/
    index.html        app shell (also served for /vote/:code)
    config.js         resolves the API base URL before anything else loads
    api.js            fetch wrapper, session storage, token refresh, all API calls
    app.js            signed-in app: email sign-in, age check, list, votes, coach, settings
    vote-page.js      public voting page for friends (no sign-in)
    ui.js             shared render helpers
    styles.css
    legal/            privacy.html, terms.html, support.html, data-deletion.html (static)
  dev-server.mjs      local static server with the same rewrites as production
  inject-config.mjs   writes HINTO_API_BASE_URL into index.html at deploy time
  vercel.json         static hosting config (rewrites + headers)
```

## Run locally

```bash
# 1. start the API (needs Supabase credentials in services/api/.env)
npm run api:start

# 2. start the web server on http://127.0.0.1:3001
npm run web:dev
```

On `localhost` / `127.0.0.1` the app talks to `http://127.0.0.1:3000` automatically.

## Sign-in

The real sign-in flow is email one-time code:

1. `POST /v1/auth/email/otp` with the email
2. `POST /v1/auth/email/verify` with the code, which returns `{ accessToken, refreshToken, expiresAt, me }`

The session is stored in `localStorage` under `hinto_web_session`. `api.js` refreshes the access
token proactively when it is about to expire and once more on any 401; if the refresh fails the
session is cleared and the app returns to sign-in. Network failures never clear the session; the
app shows a retry banner instead.

Two other buttons exist on the sign-in screen:

- **Use Local API (dev only)** appears only on `localhost`/`127.0.0.1`. It calls `POST /v1/dev/session`,
  which the API only serves when started with `API_ENABLE_DEV_AUTH=true`. It is a convenience for
  working without email delivery; it is not a production path.
- **Sign in with Apple** is hidden unless `window.HINTO_APPLE_WEB_ENABLED` is `true` (or the
  `hinto-apple-web-enabled` meta tag is `"true"`). The web flow needs an Apple Services ID, a verified
  domain and return URL, and Apple's `appleid.auth.js` SDK configured on the page. None of that is set
  up yet, so leave it disabled; the button does not fake a sign-in.

## Routes

| Path             | Served by                  | What it is                                               |
| ---------------- | -------------------------- | -------------------------------------------------------- |
| `/`              | `index.html`               | signed-in app (or sign-in screen)                        |
| `/vote/:code`    | `index.html`               | public voting page; `app.js` reads the code from the URL |
| `/privacy`       | `legal/privacy.html`       | Privacy Policy (draft)                                   |
| `/terms`         | `legal/terms.html`         | Terms of Service (draft)                                 |
| `/support`       | `legal/support.html`       | Support page and FAQ (draft)                             |
| `/data-deletion` | `legal/data-deletion.html` | Data deletion instructions (Meta requirement, draft)     |
| anything else    | static file or **404**     | never falls back to `index.html`                         |

The legal pages carry a "DRAFT - requires legal review before publishing" banner in a comment at the
top and an effective-date placeholder. Do not remove those until legal review is done.

## Configuring the API base URL per environment

`src/config.js` resolves `window.HINTO_API_BASE_URL` in this order:

1. an existing `window.HINTO_API_BASE_URL` global set by the host page
2. `<meta name="hinto-api-base-url" content="...">` in `index.html`
3. hostname `localhost` / `127.0.0.1` -> `http://127.0.0.1:3000`
4. otherwise `https://api.hinto.app`

For staging or any other environment, set the meta tag at deploy time. The Vercel build command
runs `node inject-config.mjs`, which reads these environment variables and rewrites the meta tags:

| Variable                  | Effect                                                                  |
| ------------------------- | ----------------------------------------------------------------------- |
| `HINTO_API_BASE_URL`      | e.g. `https://api.staging.hinto.app`; written into `hinto-api-base-url` |
| `HINTO_APPLE_WEB_ENABLED` | `true` or `false`; written into `hinto-apple-web-enabled`               |

With no variables set, `index.html` is left as-is and the defaults above apply. You can run the
script manually for any static host:

```bash
HINTO_API_BASE_URL=https://api.staging.hinto.app node apps/web/inject-config.mjs
```

The API must allow the web origin in `API_CORS_ALLOW_ORIGIN` (it defaults to `https://hinto.app`
in production).

## Deploying to Vercel

`vercel.json` is set up for a static deploy with `outputDirectory: src`. Point the Vercel project's
root directory at `apps/web`, set `HINTO_API_BASE_URL` in the project's environment variables, and
deploy. The rewrites map `/vote/*` and the legal paths exactly as `dev-server.mjs` does.

Any other static host works as long as it implements the same rewrites and serves a 404 for
unknown paths.

## What the app covers

- Email code sign-in, session refresh, sign-out
- Age confirmation (16+) before the main UI if the profile has no age
- Ranked list: add, edit, remove, reorder
- Share for votes: create a session, copy the `/vote/:code` link, view ranked results with vote
  counts and comments, end voting
- Public vote page: pick best fit and not-the-one, optional name and 140-character comment,
  duplicate and closed-session handling
- Coach: conversations, messages, daily usage; an unavailable state when
  `me.capabilities.canUseAiCoach` is false
- Settings: profile (username, display name, bio, age, privacy), blocked users with unblock,
  report form (also reachable from a vote comment), account deletion via `DELETE /v1/me`
