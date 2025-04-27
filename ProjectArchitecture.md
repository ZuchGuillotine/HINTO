src/
├── App.tsx
├── assets/
│   ├── images/
│   └── icons/
├── components/
│   ├── SituationshipCard.tsx       # Card UI for displaying a situationship entry
│   ├── SituationshipList.tsx       # Container for owner/guest list modes
│   ├── SituationshipListView.tsx   # Pure presentational list component
│   ├── VotingControls.tsx          # Guest-mode voting UI (buttons, polls)
│   ├── Header.tsx                  # App header/navigation bar
│   ├── Button.tsx                  # Reusable button component
│   └── ChatBubble.tsx              # UI bubble for AI chat messages
├── navigation/
│   ├── AppNavigator.tsx           # Main app navigation (Tab + Stack)
│   ├── AuthNavigator.tsx          # Authentication flow (Onboarding & Login)
│   └── ShareNavigator.tsx         # Handles deep links and shared list flows
├── screens/
│   ├── OnboardingScreen.tsx       # Social login, avatar import
│   ├── ProfileScreen.tsx          # User profile and privacy settings
│   ├── SituationshipListScreen.tsx# Owner's list with drag-and-drop ranking
│   ├── SharedListScreen.tsx       # Guest view of someone else's list for voting
│   ├── SituationshipDetailScreen.tsx # Detail + AI Chat for a selected person
│   ├── ChatScreen.tsx             # Generic AI chat interface screen
│   ├── ShareScreen.tsx            # Social share / invite friends UI
│   ├── VoteResultScreen.tsx       # Aggregated feedback display
│   └── SettingsScreen.tsx         # App settings (privacy, notifications)
├── context/
│   ├── useSituationships.ts       # Hook for list state & permissions
│   └── useVoting.ts               # Hook for vote submission and live updates
├── styles/
│   ├── colors.ts                  # Design system color palette
│   ├── typography.ts              # Font sizes, weights
│   └── spacing.ts                 # Layout spacing constants
└── utils/
    ├── api.ts                     # GraphQL/Apollo client setup
    ├── auth.ts                    # OAuth social login helpers (SnapKit, TikTok)
    └── permissions.ts             # Feature flags (canShare, canVoteAnonymously)