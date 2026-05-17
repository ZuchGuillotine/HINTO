# hnnt.app Landing Page

Static "coming soon" page served at `https://hnnt.app/` and `https://www.hnnt.app/`.

## Shape

- Single `index.html` with inline CSS, no JS framework, no build step.
- Public-facing brand is `HNNT` (the internal codebase still uses `HINTO`; we may A/B the public name later).
- Brand palette from `apps/ios/HINTO/Sources/Design/Colors.swift` (`#FF4275` pink on near-black).
- Inline SVG favicon (no extra file).

## Deploy

Sync to the static web bucket and invalidate CloudFront:

```bash
aws s3 sync apps/web/landing/ s3://hinto-staging-web-881490119784-us-west-2/ \
  --delete \
  --cache-control "public, max-age=300" \
  --profile HNNT --region us-west-2

aws cloudfront create-invalidation \
  --distribution-id <DIST_ID> \
  --paths "/*" \
  --profile HNNT
```

`<DIST_ID>` is recorded in `infra/aws/staging-resources.md` once the distribution is created.
