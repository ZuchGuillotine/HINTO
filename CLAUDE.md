# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build & Development
- `npm start` - Start Expo development server
- `npm run android` - Run on Android emulator
- `npm run ios` - Run on iOS simulator  
- `npm run web` - Run web version
- `npm run build` - Export web build

### Code Quality
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier

### Testing
- Run tests with Jest framework (no specific test command defined in package.json)
- Unit tests should use @testing-library/react-native

## Architecture Overview

### Project Structure
This is a React Native/Expo monorepo for HNNT (He's Not Not Taken), a dating advice app with AWS Amplify backend:

```
/
├── apps/hnnt-app/src/          # Main React Native application
│   ├── components/             # Reusable UI components
│   ├── screens/               # Screen-level components
│   ├── navigation/            # React Navigation setup
│   ├── context/               # React Context providers
│   ├── hooks/                 # Custom React hooks
│   ├── utils/                 # Utility functions
│   ├── styles/                # Design tokens & styling
│   └── types/                 # TypeScript type definitions
├── amplify/                   # AWS Amplify backend configuration
│   ├── backend/api/           # GraphQL schema & resolvers
│   ├── backend/auth/          # Cognito authentication
│   ├── backend/function/      # Lambda functions
│   └── backend/storage/       # S3 storage configuration
└── docs/                      # Project documentation
```

### Key Technologies
- **Frontend**: React Native 0.79, Expo 53, TypeScript
- **Navigation**: React Navigation v7 (native stack, bottom tabs)
- **State Management**: React Context + custom hooks
- **Backend**: AWS Amplify (AppSync GraphQL, Cognito, DynamoDB, S3)
- **Authentication**: Cognito with federated OAuth (Google, Snapchat, Instagram)
- **Styling**: React Native StyleSheet with design tokens
- **Data Fetching**: AWS Amplify GraphQL client

### Core Data Models (GraphQL Schema)
- **User**: Profile with social links, privacy settings, subscription plan
- **Situationship**: Dating situations with ranking, sharing capabilities
- **Vote**: Friend voting system (best/worst rankings)
- **Report**: Content moderation system
- **InviteToken**: Temporary sharing tokens with expiration

### Authentication Flow
- Multi-provider OAuth via AWS Cognito (Google, Snapchat, Instagram)
- JWT tokens for API access
- Owner-based authorization rules in GraphQL schema
- Auth state managed via `useAuth` hook in `apps/hnnt-app/src/hooks/useAuth.tsx`

### State Management Pattern
- React Context providers for business logic (e.g., `SituationshipsProvider`)
- Custom hooks expose data and actions to components
- Optimistic updates for better UX
- Error boundaries for graceful error handling

## Important Notes

### Current Technical Debt
- **Reanimated Compatibility**: Drag-and-drop ranking is temporarily disabled due to React Native Reanimated 3 Babel plugin conflicts. Standard FlatList is used instead of DraggableFlatList.
- **Missing Features**: Some Sprint TODO items are in progress, particularly AI chat integration and social sharing features.

### Development Workflow
1. **Before making changes**: Check `docs/Sprint_TODO.md` for current priorities
2. **Code style**: Follow existing patterns in `apps/hnnt-app/src/`
3. **Testing**: Write unit tests for new utilities and components
4. **GraphQL**: Use `amplify codegen` to regenerate types after schema changes
5. **Authentication**: Always check user permissions before API calls

### AWS Amplify Specifics
- Backend environment: Production deployment via Amplify CLI
- GraphQL endpoint: Auto-generated via Amplify
- File uploads: Use S3 via `@aws-amplify/storage`
- Lambda functions: Located in `amplify/backend/function/`

### Best Practices
- Use TypeScript strictly (strict mode enabled)
- Follow React Native performance guidelines
- Implement proper error handling in async operations
- Use Amplify GraphQL client for all API calls
- Keep components small and focused
- Use React Context sparingly (mainly for business logic)
- Follow existing naming conventions (PascalCase for components, camelCase for functions)

### When Adding New Features
1. Check if GraphQL schema needs updates (`amplify/backend/api/hinto/schema.graphql`)
2. Create/update context providers for complex state management
3. Add proper TypeScript types in `apps/hnnt-app/src/types/`
4. Follow the existing screen/component/hook pattern
5. Update navigation types if adding new screens
6. Consider impact on authentication and authorization rules