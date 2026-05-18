# iOS UI/UX Iteration Notes

## Coordination

- This worktree is for iOS UI/UX iteration on `codex/ios-ui-iteration`.
- Treat changes under `services/api`, `packages/contracts`, `packages/domain`, database migrations, or feed routing as shared work. Push or rebase early and check for conflicts with the active web UI tree before relying on those changes.
- Keep backend/API edits small and explicit. UI-only changes should stay in `apps/ios` unless the feed contract forces a shared decision.

## Feed Decisions To Resolve

- Feed source: decide whether friend feed items come only from explicit feed submissions, accepted friends' active situationships, or a blended transition model.
- Ranking: define the first ordering rule for MVP, likely active submissions first, unexpired only by default, then recent activity or expiration urgency.
- Removal: specify whether items leave the feed at expiration, when the author deletes/deactivates the situationship, when the friendship ends, or when access is revoked.
- Distribution: define the audience primitive before adding more UI, starting with accepted friends and leaving room for per-submission allowlists or close-friends groups.
- Access controls: make the API enforce viewer eligibility on list, vote, image upload/read, and detail routes rather than relying on client filtering.

## Rank Feed Vote/Comment Semantics

- This branch now includes shared API/schema work for repeated rank-feed votes, so coordinate before rebasing or merging with web/API work.
- Feed votes are event-style rows. The API accepts `count` on vote requests and caps each voter at 99 total votes per feed submission.
- Comment display should include the commenter's vote type and total vote count on that feed submission.
