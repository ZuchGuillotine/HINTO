# HINTO Schema Entity Mapping

*Created: 2026-03-27*

## Purpose

This document maps the legacy Amplify GraphQL schema in this repo to the donor Supabase schema that is the current restart baseline.

It is intended to unblock:

- EX-20 donor schema capture
- EX-21 Amplify-to-Supabase entity mapping
- EX-22 canonical domain model definition
- EX-23 schema gap identification
- EX-24 follow-up migration planning

## Inputs Reviewed

- `amplify/backend/api/hinto/schema.graphql`
- donor repo migrations:
  - `001_initial_schema.sql`
  - `003_voting_functions.sql`
  - `004_create_profiles_table.sql`
  - `006_image_storage_system.sql`
  - `009_friends_contacts_system.sql`
- legacy app coupling signals from codegraph:
  - `useAuth`
  - `useSituationships`
  - `fetchSituationships`
  - `reorder`
  - `submitVote`

## Donor Migration Inventory

Baseline donor tables:

- `profiles`
- `situationships`
- `voting_sessions`
- `votes`
- `ai_conversations`
- `ai_messages`
- `blocks`
- `reports`
- `daily_usage`

Later-phase donor tables and storage support:

- `images`
- `image_attachments`
- `friendships`
- `contacts`
- `friend_groups`
- `friend_group_members`

Useful donor function groups:

- profile bootstrap and updated-at triggers
- invite-code generation
- vote/result aggregation helpers
- AI usage tracking helpers
- storage/image helper functions

## Mapping Table

| Legacy Amplify Entity | Current Shape | Donor Supabase Mapping | Canonical MVP Direction | Notes |
| --- | --- | --- | --- | --- |
| `User` | app-owned user/profile document with privacy and subscription fields | `profiles` | `Profile` domain entity backed by `profiles` plus provider-link metadata | Most direct mapping. Legacy `socialLinks` should not stay embedded blindly; provider linkage should likely move to dedicated auth/account-linking records. |
| `Situationship` | owner-linked ranked item with simple sharing fields | `situationships` | `Situationship` domain entity | Strong mapping. Donor schema is richer and already supports rank/order and validation. |
| `Vote` | one record containing `bestId`, `worstId`, `targetUserId`, comment | split across `voting_sessions` and `votes` | `VotingSession` plus `VoteSubmission` / `Vote` domain entities | Legacy vote model is too compressed for public session flows. Donor structure is a better MVP base. |
| `Report` | minimal moderation record | `reports` | `Report` domain entity | Donor schema is stronger and already includes moderation status lifecycle. |
| `InviteToken` | owner-owned token with expiry | `voting_sessions.invite_code` plus expiry fields | `VotingSessionShare` behavior on `VotingSession` | Do not preserve as a separate top-level entity unless business needs demand it later. |
| `SocialLinks` | embedded profile fields | no direct donor equivalent | account-link/provider-link tables outside `profiles` | Keep profile-facing display fields separate from auth/provider linkage. |
| custom query `getUserSituationships` | user-scoped read helper | direct read on `situationships` or API route | `GET /v1/me/situationships` or equivalent | Better implemented in the TypeScript API rather than DB/vendor-specific function names. |
| custom query `getSituationshipVotes` | situationship vote read helper | derived from `votes` + `voting_sessions` + results helpers | owner-facing aggregation route | Should become an owner-only results contract, not a direct table mirror. |
| custom query `searchUsers` | username search | `profiles` search, possibly constrained | likely defer or keep minimal for MVP | Not on the first vertical-slice critical path. |
| custom mutation `reorderSituationships` | bulk rank mutation | `situationships.rank` plus reorder logic | dedicated reorder command in API/domain layer | Preserve behavior, but move it out of Amplify GraphQL. |

## Entity-Level Notes

### Profile

Legacy `User` and donor `profiles` are clearly the same product concept, but the canonical model should separate:

- profile attributes
- authentication identity
- provider linkage

The donor `profiles` table is a viable storage baseline, but the restart should expect follow-up auth tables such as:

- `auth_identities`
- `auth_provider_links`
- optional auth/session audit tables

Read this alongside `docs/Auth_Model.md`:

- `auth.users` is the canonical auth identity
- `public.profiles` is the app-facing profile record
- provider linkage should be modeled in app-owned records such as `public.auth_identities`

EX-23 should treat provider linkage as an explicit schema and API requirement, not a detail to rediscover during auth implementation.

### Situationship

This is the strongest salvage candidate across the legacy repo and donor repo.

Codegraph shows `useSituationships` and its `fetchSituationships`, `reorder`, and `submitVote` paths as central to current product behavior. That supports making situationships part of the first vertical slice.

Important constraint from the legacy schema:

- `sharedWith` is not only stored data
- it also participates in the Amplify authorization model through `@auth(... groupsField: "sharedWith" ...)`

The restart therefore needs to replace both:

- the sharing or audience-selection data shape
- the read-access semantics implied by that field

### Voting

The legacy `Vote` entity does not model a shareable/public voting session cleanly. The donor split between `voting_sessions` and `votes` is a better fit for:

- invite-code sharing
- expiration
- anonymous vs identified votes
- owner-facing aggregation

Even if storage remains normalized underneath, EX-22 and EX-23 should still decide whether the canonical API accepts a single submission containing:

- `best`
- `worst`
- optional `comment`

That is a contract question, not only a storage question.

### AI

There is no explicit legacy Amplify AI schema entity in `schema.graphql`, but the donor repo already models:

- `ai_conversations`
- `ai_messages`
- `daily_usage`

These should be carried into the canonical domain model as first-class but not first-slice entities.

### Moderation

The donor `reports` and `blocks` tables exceed the legacy schema and are a better MVP safety baseline than the current Amplify model.

## Mismatches And Gaps

### Legacy-to-Donor mismatches

- Legacy `Vote` stores best and worst picks in one row, while donor `votes` is per-situationship vote entry.
- Legacy `InviteToken` is a standalone entity, while donor invite behavior is embedded in `voting_sessions`.
- Legacy `User.socialLinks` mixes display and provider concepts; donor schema does not encode those links directly.
- Legacy sharing uses `sharedWith` on `Situationship`; donor schema leans toward voting sessions, contacts, and friendships instead.

### Canonical gaps still to define

- account-link tables for Apple, Meta/Facebook, Snapchat, and TikTok
- canonical session/user resolution contract in the API layer
- explicit audit fields and ownership rules for public voting access
- storage model for share assets and situation/profile images
- moderation event and abuse-handling contract boundaries between DB and API
- explicit disposition of legacy `searchUsers`: defer, replace, or redesign for MVP
- explicit replacement for `sharedWith` authorization semantics

## Recommended Canonical MVP Baseline

Use these as the canonical MVP domain/storage baseline:

- `profiles`
- `situationships`
- `voting_sessions`
- `votes`
- `reports`
- `blocks`
- `ai_conversations`
- `ai_messages`
- `daily_usage`

Treat these as likely Phase 2 or conditional:

- `friendships`
- `contacts`
- `friend_groups`
- `friend_group_members`
- `images`
- `image_attachments`

## Follow-Up Tasks

### EX-22

Define domain entities independent of storage:

- `Profile`
- `Situationship`
- `VotingSession`
- `Vote`
- `Report`
- `Block`
- `AiConversation`
- `AiMessage`
- `DailyUsage`
- auth/provider-link entities

### EX-23

Document schema and contract gaps for:

- provider-linked authentication
- public voting session retrieval and submission
- results aggregation and anonymity rules
- image/share asset support
- audit fields and moderation actions
- whether invite/result flows require storage-backed share assets in MVP
- whether legacy user search is deferred or preserved in reduced form

### EX-24

After EX-22 and EX-23, propose migrations for:

- auth/provider-link tables
- voting/public access refinements
- image/share storage fields if retained for MVP
- any profile or situationship fields needed to preserve legacy product behavior

## Assumptions

- The donor Supabase schema is the best available storage baseline, but not the final contract.
- The first vertical slice is profile + situationship CRUD/reorder, not voting or AI.
- Social provider linkage should be modeled outside the base profile table.

## Risks

- The donor migrations show some iterative repair history, especially around `profiles`; importing blindly would carry historical baggage.
- The legacy schema is much thinner than the donor voting model, so contract design work is still needed before implementation.
- The repo does not yet contain a canonical backend contract layer, so entity naming can still drift if EX-22 is not done promptly.
