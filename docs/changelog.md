# Changelog

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