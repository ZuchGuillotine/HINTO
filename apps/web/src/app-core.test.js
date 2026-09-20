/* eslint-env jest */

import {
  REFRESH_KEY,
  SESSION_KEY,
  VOTER_IDENTITY_KEY,
  createApp,
  createInitialState,
  createMemoryStorage,
  describeCoachError,
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

function createFriendsFeed() {
  return [
    {
      feedItemId: 'friend-1:ship-1',
      ownerProfile: {
        profileId: 'friend-1',
        username: 'mira',
        displayName: 'Mira',
        avatarUrl: null,
      },
      viewerContext: {
        mode: 'authorized_viewer',
        viewerProfileId: 'dev-user-001',
      },
      situationship: {
        situationshipId: 'ship-1',
        name: 'Avery',
        emoji: '💖',
        category: 'Crush',
        description: 'Promising.',
        rank: 0,
        status: 'active',
      },
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
    signUpWithEmailPassword: jest.fn(),
    signInWithEmailPassword: jest.fn(),
    getMe: jest.fn(),
    getFriendsFeed: jest.fn().mockResolvedValue({ data: { items: [] } }),
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
    configureSession: jest.fn(),
    deleteMe: jest.fn(),
    getConversations: jest.fn().mockResolvedValue({ data: { conversations: [] } }),
    createConversation: jest.fn(),
    getConversation: jest.fn(),
    deleteConversation: jest.fn(),
    sendCoachMessage: jest.fn(),
    createReport: jest.fn(),
    getBlocks: jest.fn().mockResolvedValue({ data: { blocks: [] } }),
    deleteBlock: jest.fn(),
    ...overrides,
  };
}

function createCapableMe() {
  const me = createMe();
  me.capabilities = { canEditProfile: true, canCreateSituationship: true, canUseAiCoach: true };
  return me;
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

  test('handlePasswordAuth signs up with email and loads the shared owner slice', async () => {
    const me = createMe();
    const apiClient = createApi({
      signUpWithEmailPassword: jest.fn().mockResolvedValue({
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

    await app.handlePasswordAuth(
      {
        email: ' DEV@HINTO.APP ',
        password: 'password123',
        username: 'local_dev',
        displayName: 'Local Dev',
      },
      'signup',
    );

    expect(storage.getItem(SESSION_KEY)).toBe('token-abc');
    expect(apiClient.signUpWithEmailPassword).toHaveBeenCalledWith({
      email: 'dev@hinto.app',
      password: 'password123',
      username: 'local_dev',
      displayName: 'Local Dev',
    });
    expect(apiClient.getMe).toHaveBeenCalledWith('token-abc');
    expect(apiClient.getSituationships).toHaveBeenCalledWith('token-abc');
    expect(app.state.me).toEqual(me);
    expect(app.state.situationships).toHaveLength(2);
    expect(app.state.notice).toEqual({
      type: 'success',
      message: 'Account created.',
    });
  });

  test('handlePasswordAuth signs in with email/password', async () => {
    const me = createMe();
    const apiClient = createApi({
      signInWithEmailPassword: jest.fn().mockResolvedValue({
        data: {
          accessToken: 'token-signin',
          me,
        },
      }),
      getMe: jest.fn().mockResolvedValue({ data: me }),
      getSituationships: jest.fn().mockResolvedValue({
        data: {
          items: [],
        },
      }),
    });
    const storage = createMemoryStorage();
    const app = createApp({
      apiClient,
      root: createRoot(),
      storage,
      cryptoImpl: { randomUUID: () => 'voter-signin' },
      FormDataCtor: FakeFormData,
    });

    await app.handlePasswordAuth(
      {
        email: 'LOCAL@HINTO.APP',
        password: 'password123',
      },
      'signin',
    );

    expect(storage.getItem(SESSION_KEY)).toBe('token-signin');
    expect(apiClient.signInWithEmailPassword).toHaveBeenCalledWith({
      email: 'local@hinto.app',
      password: 'password123',
    });
    expect(app.state.notice).toEqual({
      type: 'success',
      message: 'Signed in.',
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

  test('handleLoadFeedPanel loads accepted friends feed items', async () => {
    const feed = createFriendsFeed();
    const apiClient = createApi({
      getFriendsFeed: jest.fn().mockResolvedValue({
        data: {
          viewerProfileId: 'dev-user-001',
          items: feed,
        },
      }),
    });

    const app = createApp({
      apiClient,
      root: createRoot(),
      storage: createMemoryStorage({
        [SESSION_KEY]: 'token-feed',
      }),
      cryptoImpl: { randomUUID: () => 'voter-feed' },
      FormDataCtor: FakeFormData,
    });

    await app.handleLoadFeedPanel();

    expect(apiClient.getFriendsFeed).toHaveBeenCalledWith('token-feed');
    expect(app.state.friendsFeed).toEqual(feed);
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

  test('handlePasswordAuth stores the refresh token and registers session handlers', async () => {
    const me = createMe();
    const apiClient = createApi({
      signInWithEmailPassword: jest.fn().mockResolvedValue({
        data: { accessToken: 'token-a', refreshToken: 'refresh-a', me },
      }),
      getMe: jest.fn().mockResolvedValue({ data: me }),
      getSituationships: jest.fn().mockResolvedValue({ data: { items: [] } }),
    });
    const storage = createMemoryStorage();
    const app = createApp({
      apiClient,
      root: createRoot(),
      storage,
      cryptoImpl: { randomUUID: () => 'voter-r' },
      FormDataCtor: FakeFormData,
    });

    expect(apiClient.configureSession).toHaveBeenCalledTimes(1);
    const handlers = apiClient.configureSession.mock.calls[0][0];

    await app.handlePasswordAuth({ email: 'a@b.co', password: 'password123' }, 'signin');

    expect(storage.getItem(SESSION_KEY)).toBe('token-a');
    expect(storage.getItem(REFRESH_KEY)).toBe('refresh-a');
    expect(handlers.getRefreshToken()).toBe('refresh-a');

    handlers.onSessionRefreshed({ accessToken: 'token-b', refreshToken: 'refresh-b' });
    expect(app.state.token).toBe('token-b');
    expect(storage.getItem(SESSION_KEY)).toBe('token-b');
    expect(storage.getItem(REFRESH_KEY)).toBe('refresh-b');
  });

  test('bootstrapSession keeps the stored session on a network error', async () => {
    const networkError = Object.assign(new Error('Could not reach hnnt.'), { isNetworkError: true });
    const apiClient = createApi({
      getMe: jest.fn().mockRejectedValue(networkError),
      getSituationships: jest.fn().mockRejectedValue(networkError),
    });
    const storage = createMemoryStorage({
      [SESSION_KEY]: 'token-keep',
      [REFRESH_KEY]: 'refresh-keep',
    });
    const app = createApp({
      apiClient,
      root: createRoot(),
      storage,
      cryptoImpl: { randomUUID: () => 'voter-n' },
      FormDataCtor: FakeFormData,
    });

    await app.bootstrapSession();

    expect(app.state.token).toBe('token-keep');
    expect(storage.getItem(SESSION_KEY)).toBe('token-keep');
    expect(storage.getItem(REFRESH_KEY)).toBe('refresh-keep');
    expect(app.state.notice).toEqual({ type: 'error', message: 'Could not reach hnnt.' });
  });

  test('bootstrapSession clears the session only on an auth failure', async () => {
    const authError = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const apiClient = createApi({
      getMe: jest.fn().mockRejectedValue(authError),
      getSituationships: jest.fn().mockRejectedValue(authError),
    });
    const storage = createMemoryStorage({
      [SESSION_KEY]: 'token-stale',
      [REFRESH_KEY]: 'refresh-stale',
    });
    const app = createApp({
      apiClient,
      root: createRoot(),
      storage,
      cryptoImpl: { randomUUID: () => 'voter-x' },
      FormDataCtor: FakeFormData,
    });

    await app.bootstrapSession();

    expect(app.state.token).toBeNull();
    expect(storage.getItem(SESSION_KEY)).toBeNull();
    expect(storage.getItem(REFRESH_KEY)).toBeNull();
  });

  test('coach: sends a message, creating a conversation first, and records daily usage', async () => {
    const apiClient = createApi({
      createConversation: jest.fn().mockResolvedValue({
        data: {
          conversation: { conversationId: 'conv-1', title: null, createdAt: '2026-09-20T10:00:00.000Z' },
        },
      }),
      sendCoachMessage: jest.fn().mockResolvedValue({
        data: {
          userMessage: { messageId: 'm1', conversationId: 'conv-1', content: 'Is Avery into me?', isUser: true },
          assistantMessage: { messageId: 'm2', conversationId: 'conv-1', content: 'Here is a read.', isUser: false },
          dailyUsage: { aiMessagesUsed: 1, limit: 30 },
        },
      }),
    });
    const app = createApp({
      apiClient,
      root: createRoot(),
      storage: createMemoryStorage({ [SESSION_KEY]: 'token-coach' }),
      cryptoImpl: { randomUUID: () => 'voter-c' },
      FormDataCtor: FakeFormData,
    });
    app.state.me = createCapableMe();

    await app.handleSendCoachMessage({ content: '  Is Avery into me?  ' });

    expect(apiClient.createConversation).toHaveBeenCalledWith('token-coach', {});
    expect(apiClient.sendCoachMessage).toHaveBeenCalledWith('token-coach', 'conv-1', 'Is Avery into me?');
    expect(app.state.coach.activeConversationId).toBe('conv-1');
    expect(app.state.coach.messages.map((m) => m.messageId)).toEqual(['m1', 'm2']);
    expect(app.state.coach.dailyUsage).toEqual({ aiMessagesUsed: 1, limit: 30 });
    expect(app.state.coach.draft).toBe('');
    expect(app.state.coach.error).toBeNull();
  });

  test('coach: quota and rate-limit errors become friendly copy and keep the draft', async () => {
    const quotaError = Object.assign(new Error('Daily AI message limit of 30 reached'), {
      statusCode: 429,
      code: 'quota_exceeded',
    });
    const apiClient = createApi({
      sendCoachMessage: jest.fn().mockRejectedValue(quotaError),
    });
    const app = createApp({
      apiClient,
      root: createRoot(),
      storage: createMemoryStorage({ [SESSION_KEY]: 'token-coach' }),
      cryptoImpl: { randomUUID: () => 'voter-q' },
      FormDataCtor: FakeFormData,
    });
    app.state.me = createCapableMe();
    app.state.coach.activeConversationId = 'conv-9';
    app.state.coach.dailyUsage = { aiMessagesUsed: 29, limit: 30 };

    await app.handleSendCoachMessage({ content: 'one more' });

    expect(app.state.coach.error).toBe(
      "You've used all of today's coach messages. Your limit resets tomorrow.",
    );
    expect(app.state.coach.draft).toBe('one more');
    expect(app.state.coach.dailyUsage).toEqual({ aiMessagesUsed: 30, limit: 30 });
    expect(app.state.coach.sending).toBe(false);

    expect(describeCoachError({ code: 'rate_limited' })).toBe(
      'Slow down a little. Give it a few seconds and send again.',
    );
  });

  test('coach: renders the unavailable state and skips API calls when the capability is off', async () => {
    const apiClient = createApi();
    const root = createRoot();
    const app = createApp({
      apiClient,
      root,
      storage: createMemoryStorage({ [SESSION_KEY]: 'token-coach' }),
      cryptoImpl: { randomUUID: () => 'voter-u' },
      FormDataCtor: FakeFormData,
    });
    app.state.me = createMe();
    app.state.me.capabilities = { canUseAiCoach: false };
    app.state.route = '/app/hnnt';
    app.state.activePanel = 'coach';

    await app.handleLoadCoachPanel();

    expect(apiClient.getConversations).not.toHaveBeenCalled();
    expect(root.innerHTML).toContain('Coach unavailable');
    expect(root.innerHTML).toContain('call or text 988');
  });

  test('handleDeleteAccount calls DELETE /v1/me, clears the session, and routes home', async () => {
    const apiClient = createApi({
      deleteMe: jest.fn().mockResolvedValue({ data: { deleted: true, profileId: 'dev-user-001' } }),
    });
    const storage = createMemoryStorage({
      [SESSION_KEY]: 'token-del',
      [REFRESH_KEY]: 'refresh-del',
    });
    const history = { replaceState: jest.fn(), pushState: jest.fn() };
    const app = createApp({
      apiClient,
      root: createRoot(),
      storage,
      history,
      location: { pathname: '/app/settings' },
      cryptoImpl: { randomUUID: () => 'voter-d' },
      FormDataCtor: FakeFormData,
    });
    app.state.me = createMe();
    app.state.confirmDeleteAccount = true;

    await app.handleDeleteAccount();

    expect(apiClient.deleteMe).toHaveBeenCalledWith('token-del');
    expect(app.state.token).toBeNull();
    expect(app.state.me).toBeNull();
    expect(storage.getItem(SESSION_KEY)).toBeNull();
    expect(storage.getItem(REFRESH_KEY)).toBeNull();
    expect(app.state.route).toBe('/');
    expect(history.replaceState).toHaveBeenCalledWith({}, '', '/');
    expect(app.state.notice).toEqual({
      type: 'success',
      message: 'Your account and data have been deleted.',
    });
  });

  test('settings: loads blocked users and unblocks by profile id', async () => {
    const apiClient = createApi({
      getBlocks: jest.fn().mockResolvedValue({
        data: {
          blocks: [
            { blockId: 'b1', blockerProfileId: 'dev-user-001', blockedProfileId: 'bad-1', reason: null },
          ],
        },
      }),
      deleteBlock: jest.fn().mockResolvedValue({ data: { blockedProfileId: 'bad-1', removed: true } }),
    });
    const app = createApp({
      apiClient,
      root: createRoot(),
      storage: createMemoryStorage({ [SESSION_KEY]: 'token-blocks' }),
      cryptoImpl: { randomUUID: () => 'voter-b' },
      FormDataCtor: FakeFormData,
    });

    await app.handleLoadSettingsPanel();
    expect(app.state.blocks).toHaveLength(1);

    await app.handleUnblock('bad-1');
    expect(apiClient.deleteBlock).toHaveBeenCalledWith('token-blocks', 'bad-1');
    expect(app.state.blocks).toEqual([]);
  });

  test('report: prefilled from a feed post and submitted to POST /v1/reports', async () => {
    const apiClient = createApi({
      createReport: jest.fn().mockResolvedValue({ data: { report: { reportId: 'r1' } } }),
    });
    const app = createApp({
      apiClient,
      root: createRoot(),
      storage: createMemoryStorage({ [SESSION_KEY]: 'token-report' }),
      cryptoImpl: { randomUUID: () => 'voter-rep' },
      FormDataCtor: FakeFormData,
    });
    app.state.me = createMe();

    app.openReport({
      contentType: 'situationship',
      contentId: 'ship-1',
      reportedProfileId: 'friend-1',
      context: 'Feed post by @mira: Avery',
    });

    expect(app.state.activePanel).toBe('settings');
    expect(app.state.report.open).toBe(true);
    expect(app.state.report.contentId).toBe('ship-1');

    await app.handleSubmitReport({
      contentType: 'situationship',
      contentId: 'ship-1',
      reportedProfileId: 'friend-1',
      reason: 'harassment',
      description: ' Keeps posting about me. ',
    });

    expect(apiClient.createReport).toHaveBeenCalledWith('token-report', {
      contentType: 'situationship',
      contentId: 'ship-1',
      reportedProfileId: 'friend-1',
      reason: 'harassment',
      description: 'Keeps posting about me.',
    });
    expect(app.state.report.open).toBe(false);
    expect(app.state.notice.type).toBe('success');
  });

  test('legal routes render inline without a fetch implementation by linking out', () => {
    const root = createRoot();
    const app = createApp({
      apiClient: createApi(),
      root,
      storage: createMemoryStorage(),
      location: { pathname: '/privacy' },
      cryptoImpl: { randomUUID: () => 'voter-l' },
      FormDataCtor: FakeFormData,
    });

    app.render();

    expect(root.innerHTML).toContain('Privacy Policy');
    expect(root.innerHTML).toContain('href="/legal/privacy.html"');
    expect(root.innerHTML).toContain('data-route="/data-deletion"');
    expect(root.innerHTML).toContain('data-route="/support"');
  });
});
