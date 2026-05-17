# HINTO Staging AWS Resources

*Created: 2026-05-05*

Account:

- `881490119784`

Region:

- `us-west-2`

Credential profile used:

- `HNNT`

Access rules, GitHub OIDC behavior, and credential hygiene are documented in
[`access-and-workflows.md`](/Users/benjamincox/Downloads/HINTO/infra/aws/access-and-workflows.md).

## Network

- VPC: `vpc-0cdf884e294156ef2`
- CIDR: `10.20.0.0/16`
- Public subnets:
  - `subnet-0c33fb699c0a1cfa6` (`us-west-2a`, `10.20.0.0/24`)
  - `subnet-0b9a57ad96c26869d` (`us-west-2b`, `10.20.1.0/24`)
- Private DB subnets:
  - `subnet-0323b2dbfe2f4f3d1` (`us-west-2a`, `10.20.10.0/24`)
  - `subnet-05f4a26738b854dd2` (`us-west-2b`, `10.20.11.0/24`)

No NAT Gateway was created. This is intentional for MVP cost control. API tasks can run in public subnets with public IP assignment, while RDS remains private.

## Security Groups

- ALB security group: `sg-0bd45fac3df9f8749`
  - inbound `80` and `443` from internet
- API task security group: `sg-09f8e92276f4bd55b`
  - inbound `3000` from ALB security group
- RDS security group: `sg-0b9560bd659f12f3f`
  - inbound `5432` from API task security group

## Database

- RDS identifier: `hinto-staging-db`
- Engine: PostgreSQL
- Class: `db.t4g.micro`
- Storage: `20 GB`, encrypted, `gp3`
- Public access: disabled
- Multi-AZ: disabled
- Backups: `7` days
- Subnet group: `hinto-staging-db-subnets`
- Master user: `hinto_admin`
- Master password: RDS-managed Secrets Manager secret
- Endpoint: `hinto-staging-db.clcggkmq0zdo.us-west-2.rds.amazonaws.com`
- Port: `5432`
- Master secret ARN: `arn:aws:secretsmanager:us-west-2:881490119784:secret:rds!db-c093ce20-41d7-4066-85a3-f6ef8ed5a262-4BDVQj`

## Containers

- ECS cluster: `hinto-staging-cluster`
- ECR repository: `881490119784.dkr.ecr.us-west-2.amazonaws.com/hinto-api`
- Log group: `/ecs/hinto-staging-api`
- Task execution role: `hinto-staging-ecs-task-execution-role`
- API task role: `hinto-staging-api-task-role`
- Task definition (latest): `arn:aws:ecs:us-west-2:881490119784:task-definition/hinto-staging-api:2`
  - v2 corrects `API_CORS_ALLOW_ORIGIN` from `https://hinto.app` (typo) to `https://hnnt.app`
- GitHub deploy role: `arn:aws:iam::881490119784:role/hinto-staging-github-deploy-role`
- ECS service: `hinto-staging-api`
  - Launch type: Fargate, platform `LATEST`
  - Desired count: **0** (will be bumped to 1 after the first image is pushed; image `hinto-api:latest` does not yet exist in ECR)
  - Network: public subnets, public IP assigned, API task SG `sg-09f8e92276f4bd55b`
  - Load balancer: target group `hinto-staging-api-tg` on container `api`/port 3000
  - Deployment circuit breaker enabled with rollback; min healthy 100%, max 200%
  - Health check grace period: 60s

## Buckets

- Static web bucket: `hinto-staging-web-881490119784-us-west-2`
- Media bucket: `hinto-staging-media-881490119784-us-west-2`

Both buckets currently have:

- public access blocked
- AES256 default encryption
- HINTO staging cost tags

## CDN And TLS (Web Landing)

- CloudFront distribution: `E2B8ASG16MNZ4F`
  - Distribution domain: `d2t823dyxow063.cloudfront.net`
  - Aliases: `hnnt.app`, `www.hnnt.app`
  - Default root object: `index.html`
  - Origin: `hinto-staging-web-881490119784-us-west-2` via Origin Access Control
  - Price class: `PriceClass_100` (NA + EU edges)
  - HTTP/2 + HTTP/3, IPv6 enabled, viewer protocol `redirect-to-https`
  - 403/404 → `/index.html` 200 (SPA-friendly fallback; harmless for the landing page)
- Origin Access Control: `E2B5PXCVGNQ0N2` (`hnnt-app-web-oac`)
- ACM certificate (us-east-1, CloudFront): `arn:aws:acm:us-east-1:881490119784:certificate/3afd6043-d45c-4a65-a045-8cbbc4d3ea23`
  - SANs: `hnnt.app`, `www.hnnt.app`
  - DNS-validated via Route 53; renews automatically

The S3 bucket policy on `hinto-staging-web-881490119784-us-west-2` allows `s3:GetObject` only when the request `SourceArn` matches the distribution above. Direct S3 URL access remains blocked.

## API Load Balancer (api.hnnt.app)

- ALB: `hinto-staging-api-alb`
  - ARN: `arn:aws:elasticloadbalancing:us-west-2:881490119784:loadbalancer/app/hinto-staging-api-alb/a1c0d3eb9a4756e5`
  - DNS: `hinto-staging-api-alb-699272350.us-west-2.elb.amazonaws.com` (use `dualstack.<dns>` form for Route 53 aliases)
  - Canonical hosted zone (for Route 53 alias `HostedZoneId`): `Z1H1FL5HABSF5`
  - Scheme: `internet-facing`, IPv4 (target group health checks operate over IPv4; AAAA records on `api.hnnt.app` still resolve through the dualstack DNS)
  - Subnets: `subnet-0c33fb699c0a1cfa6`, `subnet-0b9a57ad96c26869d`
  - Security group: `sg-0bd45fac3df9f8749` (ALB SG, inbound 80/443 from internet)
- Target group: `hinto-staging-api-tg`
  - ARN: `arn:aws:elasticloadbalancing:us-west-2:881490119784:targetgroup/hinto-staging-api-tg/08c29dd7d7461345`
  - Protocol/port: HTTP/3000, target type `ip` (required for Fargate awsvpc tasks)
  - Health check: HTTP `GET /health`, interval 30s, timeout 5s, healthy=2, unhealthy=3, matcher `200`
  - Deregistration delay: 20s
- Listeners:
  - HTTPS:443 → forward to target group; TLS policy `ELBSecurityPolicy-TLS13-1-2-2021-06`; cert below
  - HTTP:80 → 301 redirect to HTTPS (preserves host/path/query)
- ACM certificate (us-west-2, regional, ALB): `arn:aws:acm:us-west-2:881490119784:certificate/a3d05361-dbb8-4a19-8acf-f4734c68d8dd`
  - Domain: `api.hnnt.app`
  - DNS-validated via Route 53; renews automatically
  - Note: this is a *separate* cert from the CloudFront cert in us-east-1. CloudFront requires us-east-1; ALBs require the cert in the same region as the load balancer.

## DNS

- Public hosted zone: `Z051205036XUDYVK1UKX6` (`hnnt.app.`)
- Registrar: iwantmyname.com (manual delegation; not registered with Route 53 Domains)
- Delegated nameservers:
  - `ns-927.awsdns-51.net`
  - `ns-1487.awsdns-57.org`
  - `ns-1929.awsdns-49.co.uk`
  - `ns-68.awsdns-08.com`

Records:

- `hnnt.app` A + AAAA ALIAS → CloudFront `d2t823dyxow063.cloudfront.net`
- `www.hnnt.app` A + AAAA ALIAS → CloudFront `d2t823dyxow063.cloudfront.net`
- `api.hnnt.app` A + AAAA ALIAS → ALB `dualstack.hinto-staging-api-alb-699272350.us-west-2.elb.amazonaws.com`
- ACM validation CNAMEs for both certs (long random `_*.hnnt.app` and `_*.api.hnnt.app` names; required for cert renewal — do not delete)

`hnnt.app` is the canonical apex; `www.hnnt.app` is an alias of the apex. `api.hnnt.app` serves the HINTO API via the ALB above.

## SSM Parameters

Created under `/hinto/staging/infra/`:

- `vpc-id`
- `public-subnet-ids`
- `private-subnet-ids`
- `alb-security-group-id`
- `api-security-group-id`
- `rds-security-group-id`
- `rds-endpoint`
- `rds-port`
- `rds-master-secret-arn`
- `database-url-secret-arn`
- `jwt-secret-arn`
- `refresh-token-pepper-secret-arn`
- `auth-state-secret-arn`
- `github-deploy-role-arn`
- `web-bucket`
- `media-bucket`
- `ecs-cluster`
- `ecr-repository`

## Next Steps

The ALB, target group, listeners, ECS service, regional cert, and DNS alias all exist. To take the API live:

1. Trigger the staging GitHub Actions workflow to build and push the first API image to ECR. The workflow registers a new task definition revision (templated off `:2`, so the CORS fix is preserved) and updates the service.
   ```bash
   gh workflow run deploy-api-staging.yml -R ZuchGuillotine/HINTO
   ```
2. Bump the ECS service from 0 to 1 desired task.
   ```bash
   aws ecs update-service --cluster hinto-staging-cluster \
     --service hinto-staging-api --desired-count 1 \
     --profile HNNT --region us-west-2
   ```
3. Watch the target turn healthy and smoke-test the endpoint.
   ```bash
   aws elbv2 describe-target-health \
     --target-group-arn arn:aws:elasticloadbalancing:us-west-2:881490119784:targetgroup/hinto-staging-api-tg/08c29dd7d7461345 \
     --profile HNNT --region us-west-2 \
     --query 'TargetHealthDescriptions[].TargetHealth.State'
   curl -sS https://api.hnnt.app/health
   ```
4. Run RDS migrations from inside the VPC (one-shot Fargate task on `hinto-staging-cluster` or via a bastion).
5. Configure SES sender/domain (DKIM, mail-from, sandbox exit if needed).
6. Register OAuth callback URLs in the Apple/Meta/Snapchat/TikTok dev portals once the API is live.
7. Add budget notifications once a recipient email is chosen.

If the first task fails to become healthy, the deployment circuit breaker will roll it back rather than loop. Most likely causes: (a) missing RDS schema (step 4), or (b) Secrets Manager read permission gap on the task execution role for any new secret added to the task def. Logs land in CloudWatch group `/ecs/hinto-staging-api`.
