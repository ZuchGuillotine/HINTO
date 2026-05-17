# AWS Deployment Notes

This directory documents the target AWS deployment path for HINTO. It is intentionally lightweight until the AWS account structure and IaC tool choice are confirmed.

## Target Shape

- AWS Organizations with consolidated billing
- Separate `hinto-prod` workload account
- Separate `shared-platform-prod` account for cross-app identity and consent services
- ECS Express Mode on Fargate for the API
- ECR for container images
- RDS PostgreSQL for production data
- S3 + CloudFront for static web and media
- SES for transactional email
- SSM Parameter Store by default, Secrets Manager only when rotation/audit requirements justify the extra cost

## API Image

Build from the repo root:

```bash
docker build -t hinto-api:local .
```

Run locally:

```bash
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e API_HOST=0.0.0.0 \
  -e API_PORT=3000 \
  hinto-api:local
```

The production image starts `node services/api/dist/server.js` and exposes port `3000`.

## GitHub To ECR Flow

The low-cost replacement for App Runner's GitHub source build is GitHub Actions:

1. GitHub Actions checks out the repo.
2. A GitHub OIDC token assumes `hinto-staging-github-deploy-role`.
3. The workflow builds `Dockerfile`.
4. The image is pushed to ECR as both `latest` and the commit SHA.
5. A new ECS task definition revision is registered.
6. If the ECS service already exists, the workflow updates it; otherwise the image and task definition are ready for the first service creation.

Workflow:

- `.github/workflows/deploy-api-staging.yml`

AWS role:

- `arn:aws:iam::881490119784:role/hinto-staging-github-deploy-role`

This avoids long-lived AWS access keys in GitHub and does not require CodeBuild or CodePipeline. The main recurring cost is GitHub Actions minutes plus ECR image storage.

Access and credential-handling rules are documented in
[`access-and-workflows.md`](/Users/benjamincox/Downloads/HINTO/infra/aws/access-and-workflows.md).

## ECS Express Mode Inputs

The first ECS Express service should be configured with:

- container image: ECR image for `hinto-api`
- container port: `3000`
- health check path: `/health`
- CPU/memory: smallest production-safe Fargate size, then adjust from metrics
- public HTTPS service for `api.hnnt.app`
- environment variables from `docs/AWS_Infrastructure_Plan.md`
- secrets from SSM/Secrets Manager
- task role permissions only for needed resources: S3 media bucket, SES send, CloudWatch logs, and parameter/secret reads

## Mandatory Tags

Apply these tags to all supported resources:

- `App=HINTO`
- `Environment=prod|staging|dev`
- `CostCenter=consumer-wellness`
- `Owner=<team-or-person>`

## IaC Boundary

Do not hand-create production resources beyond initial exploration. Once account IDs, domains, and preferred IaC tooling are confirmed, codify:

- ECR
- ECS Express Mode service
- RDS PostgreSQL
- S3 buckets
- CloudFront distributions
- SES identity configuration
- budgets and alarms
- IAM roles/policies

Use ECS Express Mode first. Convert to standard ECS/Fargate only when there is a concrete limitation.
