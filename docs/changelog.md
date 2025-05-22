# Changelog

## [Week 0, Day 3] (S3 Setup)

- Added S3 storage (`HITNOmedia`) for media assets using Amplify CLI.
  - Configured bucket `hitnomediamvp8595d-dev`.
  - Set permissions for authenticated users (CRUD).
  - Updated `HITNOauthPostConfirmation` Lambda function IAM policy to allow S3 actions on the bucket.
- Resolved naming inconsistencies between S3 resources and other Amplify resources.
- Successfully pushed S3 and Lambda permission updates to AWS environment.

## [Week 0, Day 2]

- Initialized AWS Amplify environment with Cognito user pool
- Configured custom authentication flow:
  - Set up email/password authentication
  - Prepared OAuth integration (Google, Snapchat, TikTok)
  - Added custom attributes for age verification and invite codes
  - Created Lambda triggers for user validation and profile management
- Established hosted UI with custom domain (auth-hnnt-app)
- Created Lambda functions for:
  - Pre-signup validation (age, invite code)
  - Post-confirmation profile setup
  - Pre-token generation with custom claims
- Set up redirect URIs for mobile and web platforms

## [Week 0, Day 1]

- Set up ESLint, Prettier, Husky, and lint-staged for code quality and pre-commit checks.
- Added scripts for linting and formatting in package.json.
- Installed EAS CLI and created initial eas.json build configuration.
- Added AWS Amplify dependencies for core, auth, storage, and API.
- Updated Sprint_TODO.md to reflect progress on Sprint 0 tasks.
- Created progress_summary.md and changelog.md in docs.
- Set up web build configuration for Amplify deployment
- Added build script to package.json for web export
- Successfully tested web build output in web-build directory
- Installed @expo/webpack-config for web platform support

## [Week 0, Day 4] (Snap OAuth Setup)

- Created Lambda function `HITNOauthSnapAuth-dev` for handling Snap OAuth flow:
  - Implemented OAuth initiation and callback handlers
  - Set up secure credential storage in SSM Parameter Store
  - Configured IAM roles and permissions for Lambda execution
  - Added Cognito integration for user creation/authentication
- Set up infrastructure for Snap authentication:
  - Created IAM role `HITNOauthSnapAuth-dev-role` with necessary permissions
  - Configured SSM parameters for Snap credentials
  - Integrated with existing Cognito user pool (us-west-2_G1vzYe7Fm)
- Next steps:
  - Set up API Gateway endpoints for OAuth flow
  - Configure custom domain for API Gateway
  - Update Snap Developer Portal with callback URL
  - Test authentication flow end-to-end 