# Progress Summary

## Sprint 0 (Setup) Progress

- **Mono-repo, lint & Husky hooks:**
  - ESLint, Prettier, Husky, and lint-staged configured for code quality and pre-commit checks.
- **Expo + EAS build pipeline:**
  - EAS CLI installed and `eas.json` build config scaffolded.
- **AWS Amplify env:**
  - AWS Amplify dependencies added
  - Web build configuration set up with web-build output directory
  - Build script added and tested successfully
  - Cognito user pool created with custom authentication flow
  - Lambda functions scaffolded for user management
  - Hosted UI configured with custom domain
  - S3 storage (`HITNOmedia`, bucket `hitnomediamvp8595d-dev`) configured for media assets (e.g., avatars)
    - Authenticated user access with CRUD permissions.
    - `HITNOauthPostConfirmation` Lambda function updated with S3 permissions.
  - Authentication flow ready for:
    - Email/password login
    - OAuth providers (Google, Snapchat, TikTok)
    - Custom validation (age, invite code)
    - Profile management
  - Snap OAuth implementation in progress:
    - Lambda function `HITNOauthSnapAuth-dev` created with OAuth flow handlers
    - Secure credential management via SSM Parameter Store
    - IAM roles and permissions configured
    - Integration with Cognito user pool established
  - Next steps:
    - Complete API Gateway setup for Snap OAuth endpoints
    - Configure custom domain for API Gateway
    - Implement remaining social provider integrations
    - Set up AppSync GraphQL API and DynamoDB tables
    - Define S3 bucket folder structure (e.g., for avatars) and CORS configuration

---

*Last updated: Week 0, Day 4 (Snap OAuth Setup)* 