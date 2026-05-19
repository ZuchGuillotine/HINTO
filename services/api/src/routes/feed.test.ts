import { toFeedSubmissionDto } from './feed';
import { FeedSubmissionAggregateRow } from '../repositories/postgres-core';

const baseFeedRow: FeedSubmissionAggregateRow = {
  id: '11111111-1111-4111-8111-111111111111',
  author_profile_id: '22222222-2222-4222-8222-222222222222',
  situationship_id: '33333333-3333-4333-8333-333333333333',
  body: 'Need opinions',
  image_media_id: null,
  image_url: null,
  expires_at: '2099-01-01T00:00:00.000Z',
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  author_username: 'mira',
  author_name: 'Mira',
  author_avatar_url: null,
  situationship_name: 'Coffee date',
  situationship_emoji: '☕',
  situationship_category: 'Crush',
  situationship_description: null,
  situationship_rank: 1,
  situationship_is_active: true,
  situationship_created_at: '2026-01-01T00:00:00.000Z',
  situationship_updated_at: '2026-01-01T00:00:00.000Z',
  situationship_primary_image_id: null,
  situationship_primary_image_url: null,
  situationship_image_count: 0,
  situationship_has_images: false,
  best_fit_count: 2,
  not_the_one_count: 7,
  viewer_vote_type: 'not_the_one',
  viewer_vote_count: 7,
  viewer_best_fit_count: 0,
  viewer_not_the_one_count: 7,
  feed_comments: [
    {
      commentId: '44444444-4444-4444-8444-444444444444',
      parentCommentId: null,
      voterProfile: {
        profileId: '55555555-5555-4555-8555-555555555555',
        username: 'nora',
        displayName: 'Nora',
        avatarUrl: null,
      },
      voteType: 'not_the_one',
      voterVoteCount: 7,
      comment: 'The math is not mathing.',
      createdAt: '2026-01-02T00:00:00.000Z',
    },
  ],
};

test('toFeedSubmissionDto includes repeated vote counts and comment vote context', () => {
  const dto = toFeedSubmissionDto(
    baseFeedRow,
    '55555555-5555-4555-8555-555555555555',
  );

  expect(dto.voteSummary).toEqual({
    bestFitCount: 2,
    notTheOneCount: 7,
    totalCount: 9,
  });
  expect(dto.viewerVote).toBe('not_the_one');
  expect(dto.viewerVoteCount).toBe(7);
  expect(dto.viewerVoteSummary).toEqual({
    bestFitCount: 0,
    notTheOneCount: 7,
    totalCount: 7,
  });
  expect(dto.comments).toEqual([
    {
      commentId: '44444444-4444-4444-8444-444444444444',
      parentCommentId: null,
      voterProfile: {
        profileId: '55555555-5555-4555-8555-555555555555',
        username: 'nora',
        displayName: 'Nora',
        avatarUrl: null,
      },
      voteType: 'not_the_one',
      voterVoteCount: 7,
      comment: 'The math is not mathing.',
      createdAt: '2026-01-02T00:00:00.000Z',
    },
  ]);
});
