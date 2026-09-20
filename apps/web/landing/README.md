# hnnt.app Landing Page

Static "coming soon" page served at `https://hnnt.app/` and `https://www.hnnt.app/`.

## Shape

- Single `index.html` with inline CSS, no JS framework, no build step.
- Public-facing brand is `HNNT` (the internal codebase still uses `HINTO`; we may A/B the public name later).
- Brand palette from `apps/ios/HINTO/Sources/Design/Colors.swift` (`#FF4275` pink on near-black).
- Inline SVG favicon (no extra file).
- Footer links to the legal pages in `apps/web/legal/` (`/legal/privacy.html`, `/legal/terms.html`,
  `/legal/support.html`, `/legal/data-deletion.html`).

## Deploy

Sync the landing page and the legal pages to the static web bucket and invalidate CloudFront:

```bash
aws s3 sync apps/web/landing/ s3://hinto-staging-web-881490119784-us-west-2/ \
  --delete \
  --exclude "legal/*" \
  --cache-control "public, max-age=300" \
  --profile HNNT --region us-west-2

aws s3 sync apps/web/legal/ s3://hinto-staging-web-881490119784-us-west-2/legal/ \
  --delete \
  --cache-control "public, max-age=300" \
  --profile HNNT --region us-west-2

aws cloudfront create-invalidation \
  --distribution-id <DIST_ID> \
  --paths "/*" \
  --profile HNNT
```

`<DIST_ID>` is recorded in `infra/aws/staging-resources.md` once the distribution is created.

### Clean legal URLs

iOS (`SettingsView.swift`), App Store Connect, and the Meta app settings point at the clean
paths `https://hnnt.app/privacy`, `/terms`, `/support`, and `/data-deletion`. S3 has no object
at those keys, so add a CloudFront Function (viewer-request) that rewrites them to
`/legal/<name>.html`, or serve the full web build (`npm run web:build:staging`) whose SPA
fallback renders the same pages inline. The `/legal/*.html` links on this page work either way.
