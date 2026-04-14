import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVotingResultsAggregate,
  generateInviteCode,
  normalizeInviteCode,
  resolveVotingSessionStatus,
  validateVoteSubmission,
} from './voting-shared.js';

test('normalizeInviteCode trims and uppercases values', () => {
  assert.equal(normalizeInviteCode(' ab12cd '), 'AB12CD');
});

test('resolveVotingSessionStatus distinguishes active, closed, and expired sessions', () => {
  const now = new Date('2026-04-14T10:00:00.000Z');

  assert.equal(
    resolveVotingSessionStatus({
      isActive: true,
      expiresAt: '2026-04-15T10:00:00.000Z',
      now,
    }),
    'active',
  );

  assert.equal(
    resolveVotingSessionStatus({
      isActive: false,
      expiresAt: '2026-04-15T10:00:00.000Z',
      now,
    }),
    'closed',
  );

  assert.equal(
    resolveVotingSessionStatus({
      isActive: true,
      expiresAt: '2026-04-13T10:00:00.000Z',
      now,
    }),
    'expired',
  );
});

test('validateVoteSubmission rejects duplicate selections', () => {
  assert.throws(
    () => validateVoteSubmission(['one', 'two'], 'one', 'one'),
    /must be different/u,
  );
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

  assert.equal(aggregate.totalVotes, 2);
  assert.equal(aggregate.totalVoters, 1);
  assert.equal(aggregate.results[0]?.situationshipId, 'one');
  assert.equal(aggregate.comments[0]?.voterLabel, null);
});

test('generateInviteCode returns eight uppercase characters', () => {
  const inviteCode = generateInviteCode();

  assert.match(inviteCode, /^[A-Z0-9]{8}$/u);
});
