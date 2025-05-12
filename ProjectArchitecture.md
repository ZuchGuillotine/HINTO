// Front-End Architecture for HNNT MVP (React Native + Expo)

// File Structure

src/
├── App.tsx
├── assets/
│   ├── images/
│   └── icons/
├── components/
│   ├── Header.tsx                  # App header/navigation bar with back/menu/add/share/notify/save/dark toggle
│   ├── SituationshipCard.tsx       # Card UI for displaying a situationship entry (avatar/emoji, name, subtext, rank)
│   ├── SituationshipList.tsx       # Container combining draggable and static list modes
│   ├── SituationshipListView.tsx   # Pure presentational list item wrapper around SituationshipCard
│   ├── VotingControls.tsx          # UI for guest voting, shows vote counters and purchase CTA
│   ├── ChatInput.tsx               # Chat input with text, camera/gallery attach, thumbnail previews
│   ├── ImageAttachment.tsx         # Thumbnail preview with remove button for chat attachments
│   └── ChatBubble.tsx              # UI bubble for AI chat messages
├── navigation/
│   ├── AppNavigator.tsx           # Main app navigation (Tab + Stack)
│   ├── AuthNavigator.tsx          # Authentication flow (Onboarding & Login)
│   └── ShareNavigator.tsx         # Handles deep links and shared list flows (/shared/:ownerId/:token)
├── screens/
│   ├── OnboardingScreen.tsx       # First-run onboarding UI (social login, avatars)
│   ├── ProfileScreen.tsx          # User profile and privacy settings
│   ├── SituationshipListScreen.tsx# Owner’s list with drag-and-drop ranking
│   ├── SharedListScreen.tsx       # Guest view of someone else’s list for voting
│   ├── SituationshipDetailScreen.tsx # Detail + AI Chat for a selected person
│   ├── ChatScreen.tsx             # Generic AI chat interface screen
│   ├── ShareScreen.tsx            # Social share / invite friends UI
│   ├── VoteResultScreen.tsx       # Aggregated feedback display
│   └── SettingsScreen.tsx         # App settings (privacy, notifications)
├── context/
│   ├── useSituationships.ts       # Hook for list state, permissions, optimistic reorders
│   ├── useVoting.ts               # Hook for vote submission and real-time subscriptions
│   ├── useAttachments.ts          # Hook for managing image attachments in ChatInput
│   └── useOCR.ts                  # Hook for sending images to OCR and returning parsed text
├── styles/
│   ├── colors.ts                  # Design system color palette
│   ├── typography.ts              # Font sizes, weights
│   └── spacing.ts                 # Layout spacing constants
└── utils/
    ├── api.ts                     # GraphQL/Apollo client setup (queries, mutations, subscriptions)
    ├── auth.ts                    # OAuth social login helpers (SnapKit, TikTok)
    └── permissions.ts             # Feature flags (canShare, canVoteAnonymously)

// Senior Dev Recommendations  
1. Abstract list logic into owner/guest modes via SituationshipList props.  
2. Introduce Context Providers for state & access control (`useSituationships`, `useVoting`).  
3. Implement optimistic UI with GraphQL queries/mutations and subscriptions.  
4. Deep-Linking for shared lists using ShareNavigator and route params.  
5. Add ChatInput with image attach & OCR hooks (`useAttachments`, `useOCR`).  
6. Modularize components: `ImageAttachment`, `ChatInput`, `SituationCard`, etc.  
7. Include ErrorBoundaries and loading skeletons around critical screens.  
8. Centralize permissions/feature flags (`utils/permissions.ts`) for paywall gating.  

// Next Steps  
- Generate boilerplate for context hooks and connect to GraphQL layer.  
- Flesh out ChatScreen with ChatInput and streaming AI responses via subscriptions.  
- Integrate Header into screen layouts with proper prop configurations per screen.  
- Set up navigation deep links and token validation in ShareNavigator.  
- Write unit and integration tests for drag-and-drop and voting flows.  
