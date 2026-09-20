import { queryRows } from '../db';
import { createTestConfig } from '../__tests__/helpers/config';
import { listFeedSubmissions } from './postgres-core';

jest.mock('../db', () => ({
  queryOne: jest.fn(),
  queryRows: jest.fn(),
  withTransaction: jest.fn(),
}));

const mockedQueryRows = queryRows as jest.MockedFunction<typeof queryRows>;
const config = createTestConfig({ databaseUrl: 'postgres://test' });

describe('listFeedSubmissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('derives comment vote badges from the comment author net votes on the same submission', async () => {
    mockedQueryRows.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await listFeedSubmissions(config, '55555555-5555-4555-8555-555555555555');

    const feedQuery = mockedQueryRows.mock.calls[1]?.[1] as string;

    expect(feedQuery).toContain("'voteType', commenter_vote_context.vote_type");
    expect(feedQuery).toContain("'voterVoteCount', commenter_vote_context.vote_count");
    expect(feedQuery).toContain(
      "COUNT(*) FILTER (WHERE commenter_vote.vote_type = 'best_fit')",
    );
    expect(feedQuery).toContain(
      "COUNT(*) FILTER (WHERE commenter_vote.vote_type = 'not_the_one')",
    );
    expect(feedQuery).toContain('commenter_vote.feed_submission_id = fs.id');
    expect(feedQuery).toContain(
      'commenter_vote.voter_profile_id = commented.commenter_profile_id',
    );
    expect(feedQuery).toContain('best_fit_count > not_the_one_count');
    expect(feedQuery).toContain('not_the_one_count > best_fit_count');
    expect(feedQuery).toContain('ABS(best_fit_count - not_the_one_count)');
    expect(feedQuery).not.toContain("'voteType', commented.vote_type");
    expect(feedQuery).not.toContain('commented.vote_type IS NULL');
    expect(feedQuery).not.toContain('latest_commenter_vote');
  });
});
