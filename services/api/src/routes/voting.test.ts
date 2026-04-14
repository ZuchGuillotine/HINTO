import {
  buildVotingResultsAggregate,
  generateInviteCode,
  normalizeInviteCode,
  resolveVotingSessionStatus,
  validateVoteSubmission,
} from './voting-shared';

test('normalizeInviteCode trims and uppercases values', () => {
  expect(normalizeInviteCode(' ab12cd ')).toBe('AB12CD');
});

test('resolveVotingSessionStatus distinguishes active, closed, and expired sessions', () => {
  const now = new Date('2026-04-14T10:00:00.000Z');

  expect(
    resolveVotingSessionStatus({
      isActive: true,
      expiresAt: '2026-04-15T10:00:00.000Z',
      now,
    }),
  ).toBe('active');

  expect(
    resolveVotingSessionStatus({
      isActive: false,
      expiresAt: '2026-04-15T10:00:00.000Z',
      now,
    }),
  ).toBe('closed');

  expect(
    resolveVotingSessionStatus({
      isActive: true,
      expiresAt: '2026-04-13T10:00:00.000Z',
      now,
    }),
  ).toBe('expired');
});

test('validateVoteSubmission rejects duplicate selections', () => {
  expect(() => validateVoteSubmission(['one', 'two'], 'one', 'one')).toThrow(/must be different/u);
});

test('buildVotingResultsAggregate ranks by score and preserves anonymous comments', () => {
  const aggregate = buildVotingResultsAggregate(
    [
      { situationshipId: 'one', name: 'Alex', emoji: 'A', rank: 0 },
      { situationshipId: 'two', name: 'Blake', emoji: 'B', rank: 1 },
    ],
    [
      {
        situationshipId: 'one',
        voteType: 'best_fit',
        voterIdentity: 'device-001',
        voterId: null,
        voterName: 'Taylor',
        comment: 'Clearly the best',
        createdAt: '2026-04-14T10:00:00.000Z',
      },
      {
        situationshipId: 'two',
        voteType: 'not_the_one',
        voterIdentity: 'device-001',
        voterId: null,
        voterName: 'Taylor',
        comment: null,
        createdAt: '2026-04-14T10:00:00.000Z',
      },
    ],
    { isAnonymous: true },
  );

  expect(aggregate.totalVotes).toBe(2);
  expect(aggregate.totalVoters).toBe(1);
  expect(aggregate.results[0]?.situationshipId).toBe('one');
  expect(aggregate.comments[0]?.voterLabel).toBeNull();
});

test('generateInviteCode returns eight uppercase characters', () => {
  const inviteCode = generateInviteCode();

  expect(inviteCode).toMatch(/^[A-Z0-9]{8}$/u);
});
