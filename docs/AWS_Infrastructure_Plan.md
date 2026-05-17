# HINTO AWS Infrastructure Plan

*Created: 2026-05-05*

## Decision Summary

HINTO production should target AWS without reviving the legacy Amplify, Cognito, AppSync, or Lambda-heavy shape.

The production baseline is:

- ECS Express Mode on Fargate for the TypeScript API container
- ECR for API images
- RDS PostgreSQL as the primary database
- S3 and CloudFront for the static web app and media distribution
- SES for transactional email
- SSM Parameter Store for low-cost configuration and Secrets Manager only where rotation/audit needs justify it
- Route 53 and ACM for domains and TLS
- CloudWatch and AWS Budgets for logs, metrics, alarms, and spend guardrails

App Runner is not a target service. AWS moved App Runner to maintenance for new customers on April 30, 2026 and recommends ECS Express Mode for the same low-ops container use case.

## Account Strategy

Use the existing AWS organization and consolidated billing. Do not create a totally unrelated AWS account unless ownership, tax, or legal separation requires it.

Recommended initial account layout:

- `management/billing`: existing payer or AWS Organizations management account
- `shared-platform-prod`: shared identity, cross-app user map, consent records, shared email/domain posture, and future shared observability
- `hinto-prod`: HINTO API, RDS database, media buckets, app-specific queues, app secrets, and production budgets
- `nonprod`: optional shared development/staging account while the team is small

HINTO production should not be placed into the same workload account as the existing project unless setup speed is more important than isolation. AWS account boundaries give cleaner cost reporting, quota separation, access control, and blast-radius limits than tags alone.

Mandatory cost allocation tags:

- `App=HINTO`
- `Environment=prod|staging|dev`
- `CostCenter=consumer-wellness`
- `Owner=<team-or-person>`

Use AWS Budgets per workload account and Cost Categories to group `shared-platform-*`, `hinto-*`, and future app accounts.

## Runtime Distribution

API:

- Build `Dockerfile` from the repo root.
- Push the image to ECR.
- Deploy it as an ECS Express Mode public HTTPS service.
- Start with one small Fargate task and conservative autoscaling.
- Move to standard ECS/Fargate IaC only if Express Mode defaults block a real need such as custom networking, advanced scaling, private service-to-service routing, or lower-level cost tuning.

Web:

- Keep the current web app static for MVP.
- Publish built web assets to S3.
- Serve `hnnt.app` and `www.hnnt.app` through CloudFront.
- Add a separate ECS/Next SSR service only if the product needs server-rendered dynamic pages.

Media:

- Store avatars, share assets, and future uploaded media in S3.
- Serve public/signed media through CloudFront.
- Keep upload policy in the API through presigned upload/download routes.

iOS:

- The SwiftUI app should talk to `https://api.hnnt.app`.
- OAuth callbacks and universal links should route through stable `hnnt.app` / `api.hnnt.app` URLs.

## Data And Auth Direction

RDS PostgreSQL is the production database. The current Supabase migrations remain valuable schema history, but new production work should not add Supabase-only behavior.

The auth direction is platform-owned:

- no Cognito
- no Supabase Auth as the production session issuer
- backend-owned OAuth flows for Apple, Meta/Facebook, Snapchat, and TikTok
- short-lived HINTO JWT access tokens
- hashed refresh tokens stored in Postgres
- explicit platform/app user mapping

Minimum shared platform tables are defined in [001_platform_identity.sql](/Users/benjamincox/Downloads/HINTO/db/migrations/001_platform_identity.sql):

- `platform_users`
- `app_users`
- `auth_identities`
- `auth_sessions`
- `auth_login_events`
- `oauth_states`
- `email_magic_links`
- `user_consents`
- `data_sharing_grants`

HINTO product data stays app-owned by default: profiles, situationships, voting sessions, votes, AI conversations/messages, blocks, reports, usage, and media metadata.

## Platform Posture

Treat HINTO as the first product on a future consumer wellness platform, not as the only product. The platform layer should stay app-neutral and limited to:

- identity
- account linking
- consent
- shared email/notification preferences
- audit events
- scoped future AI-agent access grants

Cross-app insights for HINTO, MicrosTracker, or future wellness apps must require explicit user opt-in through consent and scoped data-sharing grants. Do not give other apps direct reads of HINTO product tables.

## Production Environment Contract

Core runtime:

- `NODE_ENV=production`
- `API_HOST=0.0.0.0`
- `API_PORT=3000`
- `API_CORS_ALLOW_ORIGIN=https://hnnt.app`
- `DATABASE_URL`
- `AUTH_STATE_SECRET`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `JWT_ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_PEPPER`

AWS integrations:

- `AWS_REGION`
- `S3_MEDIA_BUCKET`
- `S3_WEB_BUCKET`
- `CLOUDFRONT_MEDIA_DOMAIN`
- `SES_FROM_EMAIL`
- `APNS_TEAM_ID` (`432862NB9P` for the current Apple developer team)
- `APNS_KEY_ID` (`U5L7DR4AND` for the current `HNNT` Apple key)
- `APNS_BUNDLE_ID` (`app.hnnt`)
- `APNS_PRIVATE_KEY` or `APNS_PRIVATE_KEY_FILE`; do not commit `AuthKey_U5L7DR4AND.p8`

Provider credentials:

- `APPLE_CLIENT_ID` (`app.hnnt` for native iOS Sign in with Apple)
- `APPLE_TEAM_ID` (`432862NB9P` for the current Apple developer team)
- `APPLE_KEY_ID` (`U5L7DR4AND` for the current `HNNT` Apple key)
- `APPLE_PRIVATE_KEY` or `APPLE_PRIVATE_KEY_FILE`; do not commit `AuthKey_U5L7DR4AND.p8`
- `META_CLIENT_ID`
- `META_CLIENT_SECRET`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`
- `SNAPCHAT_CLIENT_ID`
- `SNAPCHAT_CLIENT_SECRET`
- `SNAPCHAT_REDIRECT_URI`

AI:

- `OPENAI_API_KEY`

## Rollout Checklist

Before production traffic:

1. Create AWS Organizations member accounts or confirm the existing organization layout.
2. Activate cost allocation tags and create budgets for `hinto-prod` and `shared-platform-prod`.
3. Create RDS PostgreSQL and apply `db/migrations`.
4. Create ECR repo and push the API image.
5. Deploy ECS Express Mode staging.
6. Verify `/health` and `/v1/health`.
7. Verify RDS migration status from the container.
8. Verify SES sandbox exit or approved sender/domain posture.
9. Verify S3 presigned media flow once storage routes exist.
10. Verify OAuth redirect URLs for Apple, Meta/Facebook, Snapchat, and TikTok.
11. Verify voting invite load, vote submit, and owner results.
12. Verify AI daily quota enforcement.

## Source Notes

- AWS App Runner availability change: <https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html>
- ECS Express Mode overview: <https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html>
- ECS Express Mode launch notes: <https://aws.amazon.com/blogs/aws/build-production-ready-applications-without-infrastructure-complexity-using-amazon-ecs-express-mode/>
- AWS multi-account guidance: <https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/benefits-of-using-multiple-aws-accounts.html>
- AWS cost allocation guidance: <https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/building-a-cost-allocation-strategy.html>
