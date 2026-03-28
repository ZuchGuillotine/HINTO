# HINTO Canonical Domain Model

*Created: 2026-03-27*

## Purpose

This document is the EX-22 / EX-23 handoff artifact for the restart.

It defines the canonical domain model independent of storage vendor details and identifies the schema and contract gaps that must be resolved before the first backend slice is implemented.

Use this alongside:

- `docs/Schema_Entity_Mapping.md`
- `docs/Auth_Model.md`
- `docs/Canonical_Architecture.md`
- `docs/Execution_Backlog.md`

## Design Constraints

- Domain entities must not be shaped directly around Amplify GraphQL models.
- Domain entities must not be shaped directly around donor Supabase table history either.
- The first vertical slice is profile plus situationship CRUD and reorder.
- Legacy custom behaviors still matter even if the exact transport is discarded.
- `sharedWith` is not only data. In the legacy schema it also encodes read-access semantics and must be replaced as an authorization design.

## Legacy Behavior Surface That Must Be Accounted For

These behaviors exist today and must be preserved, explicitly replaced, or explicitly deferred:

- `getUserSituationships`
  - user-scoped situationship listing
- `reorderSituationships`
  - bulk reorder mutation that updates rank ordering
- `getSituationshipVotes`
  - owner-facing vote lookup and results behavior
- `searchUsers`
  - user discovery by username
- `sharedWith`
  - both audience-selection data and read authorization semantics

Codegraph and code inspection confirm that the current app also depends on:

- owner vs viewer mode in `useSituationships`
- `canEdit` and `canVote` as first-class behavior flags
- a compressed vote submission flow that accepts `best` or `worst`

## Canonical Domain Entities

### Profile

Represents the app-facing person record.

Core fields:

- `profileId`
- `username`
- `displayName`
- `email`
- `bio`
- `avatar`
- `privacy`
- `subscriptionTier`
- `createdAt`
- `updatedAt`

Notes:

- `Profile` is not the auth identity.
- Privacy should be modeled explicitly, not as leftover Cognito or Amplify rules.

### AuthIdentity

Represents the canonical authenticated user identity and provider linkage.

Core fields:

- `authUserId`
- `profileId`
- `primaryProvider`
- `linkedProviders`
- `providerSubject`
- `status`
- `createdAt`
- `updatedAt`

Notes:

- This aligns with `docs/Auth_Model.md`.
- Provider linkage must live outside `Profile`.

### Situationship

Represents one ranked romantic option or relationship state for a profile owner.

Core fields:

- `situationshipId`
- `ownerProfileId`
- `name`
- `emoji`
- `category`
- `description`
- `rank`
- `status`
- `createdAt`
- `updatedAt`

Notes:

- The canonical model should use a stable rank concept, not transport-specific `rankIndex`.
- Sharing and read access should not be encoded as a raw `sharedWith` array on the entity.

### SituationshipAudience

Represents who may view or participate in a situationship-related sharing context.

Core fields:

- `resourceType`
- `resourceId`
- `audienceMode`
- `viewerIdentity`
- `grantedByProfileId`
- `createdAt`

Notes:

- This is the canonical replacement area for the legacy `sharedWith` behavior.
- It may end up being realized through session-level sharing rather than direct situationship ACL rows.
- The important point is explicit authorization semantics, not field parity.

### VotingSession

Represents a shareable voting context for one owner and a set of situationships.

Core fields:

- `votingSessionId`
- `ownerProfileId`
- `inviteCode`
- `status`
- `expiresAt`
- `visibility`
- `anonymityMode`
- `createdAt`
- `updatedAt`

Notes:

- This replaces the legacy standalone `InviteToken` concept as the canonical MVP share object.

### VoteSubmission

Represents the API-facing command payload for a voter response.

Core fields:

- `votingSessionId`
- `voterIdentity`
- `bestSituationshipId`
- `worstSituationshipId`
- `comment`

Notes:

- The API may continue accepting a single submission with `best` and `worst` even if storage is normalized beneath it.
- This preserves the current user-facing voting mental model while allowing better backend structure.

### VoteRecord

Represents normalized stored vote data used for tallying and auditability.

Core fields:

- `voteRecordId`
- `votingSessionId`
- `situationshipId`
- `voterIdentity`
- `voteKind`
- `commentGroupId`
- `createdAt`

### VoteResults

Represents owner-facing aggregation, not a primary write model.

Core fields:

- `votingSessionId`
- `totalsBySituationship`
- `rankedResults`
- `commentSummary`
- `visibilityRules`

### Report

Represents a moderation or abuse report.

Core fields:

- `reportId`
- `reporterProfileId`
- `targetType`
- `targetId`
- `reason`
- `description`
- `status`
- `resolvedAt`

### Block

Represents a user-level safety boundary.

Core fields:

- `blockId`
- `blockerProfileId`
- `blockedProfileId`
- `createdAt`

### AiConversation

Represents a coaching conversation.

### AiMessage

Represents one message within a coaching conversation.

### DailyUsage

Represents quota and policy tracking for AI and other rate-limited features.

## First-Slice API Aggregates

The first backend slice should expose aggregates that match product behavior, not table boundaries.

### MeAggregate

Used for `GET /v1/me`.

Contains:

- `profile`
- `auth`
- `capabilities`

`capabilities` should expose stable booleans or enums for the client, for example:

- `canEditProfile`
- `canCreateSituationship`
- `canUseAiCoach`

### SituationshipListAggregate

Used for `GET /v1/me/situationships`.

Contains:

- `ownerProfile`
- `viewerContext`
- `items`
- `ordering`
- `capabilities`

`viewerContext` should distinguish:

- owner view
- authorized viewer view
- public voting-session view

`capabilities` should include:

- `canEdit`
- `canReorder`
- `canVote`

This is the canonical replacement for the current `canEdit` and `canVote` logic in `useSituationships`.

### SituationshipDetailAggregate

Used for create, edit, and detail screens.

Contains:

- `situationship`
- `viewerContext`
- `capabilities`
- `attachments` if media is retained in MVP

### ReorderSituationshipsCommand

Canonical replacement for legacy `reorderSituationships`.

Payload:

- ordered list of `situationshipId`

Behavior requirements:

- atomic reorder semantics
- owner-only authorization
- deterministic rank assignment
- stable response with updated ordering metadata

### VotingSessionView

Used later for public or semi-public voting.

Contains:

- `ownerProfileSummary`
- `session`
- `situationshipChoices`
- `viewerContext`
- `capabilities`

### VoteResultsAggregate

Canonical replacement area for `getSituationshipVotes`.

Contains:

- results by situationship
- comments or comment summaries
- anonymity rules
- owner-only visibility flags

## Preserve, Replace, Defer Decisions

### Preserve As Product Behavior

- owner-scoped situationship listing
- bulk reorder behavior
- simple best/worst voting mental model
- viewer capability flags such as edit vs vote

### Replace Architecturally

- Amplify `@auth` rules
- `sharedWith` as an authorization mechanism
- GraphQL function names as the primary contract surface
- Cognito-shaped user identity inside app state

### Defer Unless Product Scope Forces It In

- `searchUsers`
- friends/contacts/group features
- rich media/image attachment model beyond what the MVP share flow truly needs

## Schema Gaps

### Authorization And Audience Modeling

Missing canonical support for:

- owner vs authorized viewer vs public-session viewer
- share-link access rules
- explicit replacement of `sharedWith` read-access semantics

### Auth And Provider Linking

Missing canonical support for:

- provider-linked identity records
- backend-owned subject mapping
- auth-to-profile linkage beyond vendor auth tables

### Reorder Semantics

Need an explicit backend rule for:

- rank uniqueness
- conflict handling
- atomic reorder updates

### Voting Contract

Need an explicit decision on:

- whether the external API accepts combined `best` plus `worst` submission
- anonymous vs identified vote visibility
- idempotency and repeat-vote handling

### Results Aggregation

Need explicit owner-facing contracts for:

- ranked results
- comments
- anonymity filtering
- aggregation refresh behavior

### Search

Need an explicit MVP decision for:

- defer entirely
- minimal username search
- invitation-only lookup flow

### Media And Share Assets

Need explicit MVP decisions for:

- profile avatars
- situationship images
- share cards or share-image generation

## Contract Gaps For Web And Swift

Both clients will need stable contracts for:

- session bootstrap and `me` response
- profile update payloads
- situationship list/detail/create/update/delete
- reorder command and response
- audience and viewer-capability metadata
- validation and machine-readable error codes

Swift-specific pressure:

- explicit JSON envelope stability
- enum-safe values for privacy, audience, vote types, and status fields

Web-specific pressure:

- public voting-session retrieval without app-owned auth state leakage
- clear anonymous-session vs signed-in-session handling

## Follow-Up Task Breakdown

### EX-24

Create migrations only after the contract decisions above settle:

- auth/provider-link tables
- audience or share-access modeling for `sharedWith` replacement
- reorder support fields or constraints
- voting-session and results-support refinements

### EX-35

Design middleware around:

- authenticated owner session
- authorized viewer session
- public voting-session access

This task must consume the replacement model for `sharedWith`, not invent a transport-only auth check.

### EX-40

Profile routes/services should target:

- `GET /v1/me`
- `PATCH /v1/me`

And return `MeAggregate`, not raw storage rows.

### EX-41

Situationship routes/services should target:

- `GET /v1/me/situationships`
- `POST /v1/me/situationships`
- `PATCH /v1/me/situationships/:id`
- `DELETE /v1/me/situationships/:id`
- `POST /v1/me/situationships:reorder`

These routes should preserve the behavior previously carried by `getUserSituationships` and `reorderSituationships`.

### EX-50

Contracts should define:

- domain enums
- request/response DTOs
- `MeAggregate`
- `SituationshipListAggregate`
- `SituationshipDetailAggregate`
- reorder command DTO

### EX-51

Domain rules should define:

- rank and reorder invariants
- viewer capability resolution
- audience/access policy resolution
- vote submission normalization
- profile and situationship validation rules

## Recommended Immediate Next Tasks

1. Accept this document as the EX-22 / EX-23 baseline.
2. Add a contract-scaffold task packet for `MeAggregate` and situationship DTOs.
3. Add a backend task packet for reorder invariants and owner-only authorization.
4. Start a focused design task on `sharedWith` replacement and session/viewer authorization semantics.
5. Defer `searchUsers` unless the human owner explicitly pulls it into MVP.
