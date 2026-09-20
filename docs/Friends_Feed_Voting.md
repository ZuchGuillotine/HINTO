# Friends Feed Voting

*Updated: 2026-06-25*

## Scope

This document describes the current Rank feed voting behavior for explicit feed
submissions. It is separate from legacy public voting sessions under
`/v1/voting-sessions/:inviteCode`.

The active Rank feed path is:

1. A signed-in user creates a feed submission from one of their situationships.
2. Friends see that submission in `GET /v1/me/feed`.
3. Friends can cast one or more votes on the same submission.
4. Friends can comment on the submission.
5. The feed shows post-level aggregate voting and per-comment author vote
   context as separate displays.

## Storage Model

The RDS tables are defined by the feed migrations:

- `db/migrations/005_feed_submissions.sql`
- `db/migrations/006_feed_multi_votes.sql`
- `db/migrations/008_feed_submission_comments.sql`

`feed_submission_votes` is append-only for voting behavior:

- every vote is one row
- `vote_type` is either `best_fit` or `not_the_one`
- a profile can cast many votes on the same `feed_submission_id`
- each row counts as one vote for quota/rate enforcement
- `006_feed_multi_votes.sql` removes the old unique constraint on
  `(feed_submission_id, voter_profile_id)` so repeat votes are valid

`feed_submission_comments` stores comment text and a snapshot of the author's
vote context at creation time for compatibility. Feed reads recompute current
comment badge data from `feed_submission_votes`, so comment badges stay correct
if the author votes again after commenting.

## API Contract

Current feed routes:

- `GET /v1/me/feed`
- `POST /v1/me/feed/submissions`
- `POST /v1/me/feed/submissions/:id/image`
- `POST /v1/me/feed/submissions/:id/votes`
- `POST /v1/me/feed/submissions/:id/comments`

Vote requests accept:

```json
{
  "voteType": "best_fit",
  "count": 1,
  "comment": null
}
```

`count` is optional and defaults to `1`. The API inserts `count` vote rows in a
transaction and currently caps a profile at 99 total votes per submission.

`GET /v1/me/feed` returns two distinct voting views:

- `voteSummary`: post-level aggregate counts across all vote rows
- `viewerVoteSummary`: the current viewer's own counts, used only for viewer UI
  state such as selected button tint
- `comments[].voteType` plus `comments[].voterVoteCount`: the comment author's
  net vote context on that post

## Post Aggregate Display

The post aggregate display uses `voteSummary` only:

- button counts show directional aggregate counts:
  - best-fit button: `bestFitCount`
  - not-the-one button: `notTheOneCount`
- the summary line shows total volume and net score:
  - total votes: `bestFitCount + notTheOneCount`
  - net score: `bestFitCount - notTheOneCount`

Signal color:

- green when net score is positive
- yellow when net score is zero or no worse than 20% below total volume
- red when net score is worse than 20% below total volume

Examples:

- `10` best-fit and `2` not-the-one shows `votes 12` and `+8` with a green flag
- `10` best-fit and `12` not-the-one shows `votes 22` and `-2` with a yellow flag
- `4` best-fit and `10` not-the-one shows `votes 14` and `-6` with a red flag

## Per-Comment Badge Display

Comment badges show the comment author's individual net vote score on that same
post. They do not show:

- the viewing user's vote count
- the post aggregate count
- the latest vote row alone
- the count for only the most recent direction

For each comment author and feed submission, the backend computes:

```text
author_net = author_best_fit_count - author_not_the_one_count
```

The API maps that net to the existing response shape:

- positive net: `voteType = best_fit`, `voterVoteCount = abs(author_net)`
- negative net: `voteType = not_the_one`, `voterVoteCount = abs(author_net)`
- zero net or no votes: `voteType = null`, `voterVoteCount = 0`

iOS renders this as:

- up arrow `+N` for positive net
- down arrow `-N` for negative net
- no badge for zero or absent vote context

Example: if a commenter has cast 5 best-fit votes and 1 not-the-one vote on the
post, their comment line shows an up arrow and `+4`.

## Implementation Notes

Backend:

- `services/api/src/repositories/postgres-core.ts`
  - `voteOnFeedSubmission` inserts repeated vote rows.
  - `listFeedSubmissions` computes post aggregate counts, viewer-specific
    counts, and comment-author net vote badges.
  - `createFeedSubmissionComment` stores a compatibility snapshot, but feed
    reads are authoritative for current badge display.
- `services/api/src/routes/feed.ts`
  - exposes feed submission, vote, image, and comment routes.

iOS:

- `apps/ios/HINTO/Sources/Views/Feed/FriendsFeedView.swift`
  - uses post aggregate counts for vote button numbers.
  - uses viewer counts only to tint selected vote buttons.
  - renders the summary line as total votes plus net signal.
  - renders comment-author net badges as signed arrow counts.

Tests:

- `services/api/src/repositories/postgres-core.test.ts`
- `services/api/src/routes/feed.test.ts`

Manual RDS smoke verification covered:

- repeated votes by the same profile on one post
- aggregate up/down counts
- comment-author net badge after mixed-direction voting
- API health and iOS simulator build
