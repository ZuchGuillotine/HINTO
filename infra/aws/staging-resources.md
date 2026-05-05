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
- Task definition: `arn:aws:ecs:us-west-2:881490119784:task-definition/hinto-staging-api:1`
- GitHub deploy role: `arn:aws:iam::881490119784:role/hinto-staging-github-deploy-role`

No ECS service has been created yet. The GitHub Actions workflow can build/push the API image and register a new task definition revision before the service exists.

## Buckets

- Static web bucket: `hinto-staging-web-881490119784-us-west-2`
- Media bucket: `hinto-staging-media-881490119784-us-west-2`

Both buckets currently have:

- public access blocked
- AES256 default encryption
- HINTO staging cost tags

CloudFront distributions have not been created yet.

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

1. Run the GitHub Actions staging workflow to build/push the API image to ECR.
2. Create the ECS service/ALB target group/listener.
3. Run RDS migrations from inside the VPC.
4. Configure SES sender/domain and production OAuth callback URLs.
5. Add budget notifications once a recipient email is chosen.
