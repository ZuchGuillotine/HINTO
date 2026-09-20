# iOS UI/UX Iteration Notes

## Feed Decisions To Resolve

- Feed source: decide whether friend feed items come only from explicit feed submissions, accepted friends' active situationships, or a blended transition model.
- Ranking: define the first ordering rule for MVP, likely active submissions first, unexpired only by default, then recent activity or expiration urgency.
- Removal: specify whether items leave the feed at expiration, when the author deletes/deactivates the situationship, when the friendship ends, or when access is revoked.
- Distribution: define the audience primitive before adding more UI, starting with accepted friends and leaving room for per-submission allowlists or close-friends groups.
- Access controls: make the API enforce viewer eligibility on list, vote, image upload/read, and detail routes rather than relying on client filtering.

## Rank Feed Vote/Comment Semantics

- Feed votes are event-style rows. The API accepts `count` on vote requests and caps each voter at 99 total votes per feed submission.
- Comment display should include the commenter's vote type and total vote count on that feed submission.
