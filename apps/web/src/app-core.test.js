/* eslint-env jest */

import {
  SESSION_KEY,
  VOTER_IDENTITY_KEY,
  createApp,
  createInitialState,
  createMemoryStorage,
} from './app-core.js';

class FakeFormData {
  constructor(values = {}) {
    this.values = values;
  }

  get(key) {
    return this.values[key] ?? null;
  }
}

function createRoot() {
  return {
    innerHTML: '',
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
  };
}

function createMe() {
  return {
    profile: {
      profileId: 'dev-user-001',
      username: 'local_dev',
      displayName: 'Local Dev',
      bio: 'Testing the restart shell.',
      privacy: 'private',
      subscriptionTier: 'free',
    },
    auth: {
      primaryProvider: 'development',
      linkedProviders: ['development'],
    },
  };
}

function createSituationships() {
  return [
    {
      situationshipId: 'ship-1',
      name: 'Avery',
      emoji: '💖',
      category: 'Crush',
      description: 'Promising.',
      rank: 0,
      status: 'active',
    },
    {
      situationshipId: 'ship-2',
      name: 'Blake',
      emoji: '✨',
      category: 'Friend',
      description: 'Complicated.',
      rank: 1,
      status: 'active',
    },
  ];
}

function createPublicVotingSession() {
  return {
    session: {
      votingSessionId: 'session-1',
      inviteCode: 'ABC123',
      title: 'Rate my situationships',
    },
    ownerProfile: {
      profileId: 'dev-user-001',
      username: 'local_dev',
      displayName: 'Local Dev',
    },
    items: createSituationships(),
    capabilities: {
      canVote: true,
      canComment: true,
    },
    audience: {
      mode: 'session_link',
    },
    viewerContext: {
      mode: 'public_session_viewer',
    },
  };
}

function createApi(overrides = {}) {
  return {
    createDevelopmentSession: jest.fn(),
    getMe: jest.fn(),
    updateMe: jest.fn(),
    getSituationships: jest.fn(),
    createSituationship: jest.fn(),
    updateSituationship: jest.fn(),
    deleteSituationship: jest.fn(),
    reorderSituationships: jest.fn(),
    getVotingSessions: jest.fn(),
    createVotingSession: jest.fn(),
    getVotingResults: jest.fn(),
    getPublicVotingSession: jest.fn(),
    submitVote: jest.fn(),
    ...overrides,
  };
}

describe('web app core', () => {
  test('createInitialState restores token and persists a voter identity', () => {
    const storage = createMemoryStorage({
      [SESSION_KEY]: 'token-123',
    });

    const state = createInitialState({
      storage,
      cryptoImpl: { randomUUID: () => 'voter-123' },
    });

    expect(state.token).toBe('token-123');
    expect(state.voterIdentity).toBe('voter-123');
    expect(storage.getItem(VOTER_IDENTITY_KEY)).toBe('voter-123');
  });

  test('handleDevelopmentSignIn stores the token and loads the shared owner slice', async () => {
    const me = createMe();
    const apiClient = createApi({
      createDevelopmentSession: jest.fn().mockResolvedValue({
        data: {
          accessToken: 'token-abc',
          me,
        },
      }),
      getMe: jest.fn().mockResolvedValue({ data: me }),
      getSituationships: jest.fn().mockResolvedValue({
        data: {
          items: createSituationships(),
        },
      }),
    });
    const storage = createMemoryStorage();
    const app = createApp({
      apiClient,
      root: createRoot(),
      storage,
      cryptoImpl: { randomUUID: () => 'voter-abc' },
      FormDataCtor: FakeFormData,
    });

    await app.handleDevelopmentSignIn();

    expect(storage.getItem(SESSION_KEY)).toBe('token-abc');
    expect(apiClient.getMe).toHaveBeenCalledWith('token-abc');
    expect(apiClient.getSituationships).toHaveBeenCalledWith('token-abc');
    expect(app.state.me).toEqual(me);
    expect(app.state.situationships).toHaveLength(2);
    expect(app.state.notice).toEqual({
      type: 'success',
      message: 'Development session created against the shared backend.',
    });
  });

  test('handleCreateVotingSession selects the new session and loads results', async () => {
    const apiClient = createApi({
      createVotingSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            votingSessionId: 'session-1',
            inviteCode: 'ABC123',
          },
        },
      }),
      getVotingSessions: jest.fn().mockResolvedValue({
        data: {
          sessions: [
            {
              votingSessionId: 'session-1',
              title: 'Rate my situationships',
              inviteCode: 'ABC123',
              status: 'active',
              expiresAt: '2026-04-17T00:00:00.000Z',
            },
          ],
        },
      }),
      getVotingResults: jest.fn().mockResolvedValue({
        data: {
          session: {
            votingSessionId: 'session-1',
            title: 'Rate my situationships',
          },
          totalVotes: 4,
          totalVoters: 2,
          results: [],
          comments: [],
        },
      }),
    });

    const app = createApp({
      apiClient,
      root: createRoot(),
      storage: createMemoryStorage({
        [SESSION_KEY]: 'token-xyz',
      }),
      cryptoImpl: { randomUUID: () => 'voter-xyz' },
      FormDataCtor: FakeFormData,
    });

    await app.handleCreateVotingSession();

    expect(apiClient.createVotingSession).toHaveBeenCalledWith('token-xyz', {
      title: 'Rate my situationships',
      anonymityMode: 'anonymous',
      expiresInHours: 48,
    });
    expect(apiClient.getVotingResults).toHaveBeenCalledWith('token-xyz', 'session-1');
    expect(app.state.activePanel).toBe('voting');
    expect(app.state.selectedVotingSessionId).toBe('session-1');
    expect(app.state.selectedVotingResults.totalVotes).toBe(4);
  });

  test('handleLoadPublicVotingSession normalizes invite codes and resets submit state', async () => {
    const apiClient = createApi({
      getPublicVotingSession: jest.fn().mockResolvedValue({
        data: createPublicVotingSession(),
      }),
    });

    const app = createApp({
      apiClient,
      root: createRoot(),
      storage: createMemoryStorage(),
      cryptoImpl: { randomUUID: () => 'voter-public' },
      FormDataCtor: FakeFormData,
    });
    app.state.publicVoteSubmitted = true;

    await app.handleLoadPublicVotingSession({
      inviteCode: 'abc123',
    });

    expect(apiClient.getPublicVotingSession).toHaveBeenCalledWith('ABC123');
    expect(app.state.publicVotingInviteCode).toBe('ABC123');
    expect(app.state.publicVoteSubmitted).toBe(false);
    expect(app.state.publicVotingSession.session.inviteCode).toBe('ABC123');
  });

  test('handleSubmitPublicVote submits the browser voter identity payload', async () => {
    const apiClient = createApi({
      submitVote: jest.fn().mockResolvedValue({
        data: {
          accepted: true,
        },
      }),
    });

    const app = createApp({
      apiClient,
      root: createRoot(),
      storage: createMemoryStorage(),
      cryptoImpl: { randomUUID: () => 'browser-voter-1' },
      FormDataCtor: FakeFormData,
    });
    app.state.publicVotingInviteCode = 'ABC123';
    app.state.publicVotingSession = createPublicVotingSession();

    await app.handleSubmitPublicVote({
      voterName: 'Taylor',
      bestSituationshipId: 'ship-1',
      worstSituationshipId: 'ship-2',
      comment: 'Avery is clearly the best fit.',
    });

    expect(apiClient.submitVote).toHaveBeenCalledWith('ABC123', {
      voterIdentity: 'browser-voter-1',
      voterName: 'Taylor',
      bestSituationshipId: 'ship-1',
      worstSituationshipId: 'ship-2',
      comment: 'Avery is clearly the best fit.',
    });
    expect(app.state.publicVoteSubmitted).toBe(true);
    expect(app.state.notice).toEqual({
      type: 'success',
      message: 'Vote submitted through the shared backend.',
    });
  });
});
