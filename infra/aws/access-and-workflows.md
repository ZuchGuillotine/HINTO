# AWS Access And Deployment Workflows

*Created: 2026-05-05*

This document explains how collaborators and automation should access HINTO AWS resources.

## Access Principles

- Do not commit AWS access keys, `.env` files, provider private keys, database URLs, or exported credential CSV files.
- Do not store long-lived AWS keys in GitHub repository secrets.
- Prefer GitHub OIDC for CI/CD access to AWS.
- Keep runtime secrets in AWS Secrets Manager.
- Keep non-secret resource identifiers in SSM Parameter Store.
- Use the `HNNT` IAM user only for local administrative/bootstrap work until a better role-based operator workflow is codified.
- Treat resource IDs, ARNs, bucket names, and endpoints as non-secret operational metadata. They can be documented, but they do not grant access without IAM permission.

## Local AWS Profile

Current local bootstrap profile:

- profile name: `HNNT`
- account: `881490119784`
- region: `us-west-2`
- IAM user: `arn:aws:iam::881490119784:user/HNNT`

The local profile should be used only from trusted developer machines. The access-key CSV export is intentionally ignored by `.gitignore` via:

- `*_accessKeys.csv`
- `*AccessKeys.csv`
- `*accessKeys.csv`
- `credentials.csv`

Before committing, verify credential exports are ignored:

```bash
git check-ignore -v HNNT_accessKeys.csv
```

## IAM Group

IAM group:

- `arn:aws:iam::881490119784:group/HNNT`

Managed policies currently attached:

- `AmazonRoute53FullAccess`
- `AmazonEC2ContainerRegistryFullAccess`
- `CloudFrontFullAccess`
- `AmazonSSMFullAccess`
- `AmazonRDSFullAccess`
- `IAMFullAccess`
- `SecretsManagerReadWrite`
- `AmazonECS_FullAccess`
- `AmazonSESFullAccess`
- `AWSBudgetsReadOnlyAccess`

Inline policy:

- `HNNTInfraBootstrap`

The inline policy fills bootstrap gaps for EC2/VPC, S3, CloudWatch logs, ELB, CloudWatch, and budgets. This is broader than the final desired posture and should be replaced by narrower role-based policies once the infrastructure shape stabilizes.

## GitHub OIDC Deployment Access

GitHub repository:

- `ZuchGuillotine/HINTO`

AWS OIDC provider:

- `arn:aws:iam::881490119784:oidc-provider/token.actions.githubusercontent.com`

GitHub deploy role:

- `arn:aws:iam::881490119784:role/hinto-staging-github-deploy-role`

Trust policy scope:

- `repo:ZuchGuillotine/HINTO:ref:refs/heads/main`
- `repo:ZuchGuillotine/HINTO:environment:staging`

The workflow uses short-lived credentials through `aws-actions/configure-aws-credentials`. No AWS access key should be added to GitHub secrets.

Workflow:

- `.github/workflows/deploy-api-staging.yml`

What it does:

1. Checks out the repo.
2. Assumes `hinto-staging-github-deploy-role` through GitHub OIDC.
3. Builds `Dockerfile`.
4. Pushes the API image to ECR as `latest` and the commit SHA.
5. Registers a new ECS task definition revision.
6. Updates the ECS service if `hinto-staging-api` exists.

The ECS service does not exist yet. Until it does, the workflow prepares the ECR image and task definition only.

## Secret Storage

Runtime secrets live in Secrets Manager:

- `/hinto/staging/api/DATABASE_URL`
- `/hinto/staging/api/JWT_ACCESS_TOKEN_SECRET`
- `/hinto/staging/api/REFRESH_TOKEN_PEPPER`
- `/hinto/staging/api/AUTH_STATE_SECRET`

Do not copy secret values into documentation, tickets, pull requests, screenshots, or local shell history.

Secret ARNs are recorded in SSM as operational pointers:

- `/hinto/staging/infra/database-url-secret-arn`
- `/hinto/staging/infra/jwt-secret-arn`
- `/hinto/staging/infra/refresh-token-pepper-secret-arn`
- `/hinto/staging/infra/auth-state-secret-arn`

## Resource Inventory

Non-secret staging resource IDs are recorded in:

- `infra/aws/staging-resources.md`
- SSM path `/hinto/staging/infra/`

To list the SSM inventory:

```bash
aws ssm get-parameters-by-path \
  --profile HNNT \
  --region us-west-2 \
  --path /hinto/staging/infra \
  --recursive \
  --query 'Parameters[].{Name:Name,Value:Value}' \
  --output table
```

## Deployment Workflow

Current low-cost App Runner replacement:

```text
GitHub push or manual workflow dispatch
  -> GitHub Actions runner
  -> Docker build
  -> ECR push
  -> ECS task definition revision
  -> ECS service update when service exists
```

Why this path:

- no CodeBuild or CodePipeline required
- no long-lived GitHub AWS keys
- no always-on build infrastructure
- cost is mostly GitHub Actions minutes and ECR image storage

## Remaining Bootstrap Work

The staging foundation exists, but these steps remain:

1. Push the workflow to GitHub.
2. Run the staging workflow once to push the first API image.
3. Create an ALB target group/listener and ECS service.
4. Run RDS migrations from inside the VPC.
5. Configure SES sender/domain settings.
6. Configure provider OAuth callback URLs.
7. Add budget notifications once an email recipient is chosen.

## Credential Review Checklist

Run before commit/push:

```bash
git status --short
git check-ignore -v HNNT_accessKeys.csv .env
rg --hidden --glob '!node_modules/**' --glob '!HNNT_accessKeys.csv' --glob '!.env' '<project-secret-patterns>'
```

Expected result:

- credential CSV and `.env` are ignored
- no AWS access keys or private keys appear in tracked files
- only non-secret ARNs/resource IDs appear in infra docs
