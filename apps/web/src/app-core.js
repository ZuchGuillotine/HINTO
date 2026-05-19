export const SESSION_KEY = 'hinto_web_access_token';
export const VOTER_IDENTITY_KEY = 'hinto_web_voter_identity';

export function createMemoryStorage(initialEntries = {}) {
  const store = new Map(Object.entries(initialEntries));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function resolveStorage(storage) {
  return storage &&
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function'
    ? storage
    : createMemoryStorage();
}

export function createVoterIdentity(cryptoImpl = typeof crypto !== 'undefined' ? crypto : undefined) {
  if (cryptoImpl && typeof cryptoImpl.randomUUID === 'function') {
    return cryptoImpl.randomUUID();
  }

  return `web-voter-${Date.now()}`;
}

export function createInitialState({
  storage,
  cryptoImpl = typeof crypto !== 'undefined' ? crypto : undefined,
} = {}) {
  const resolvedStorage = resolveStorage(storage);
  const existingVoterIdentity =
    resolvedStorage.getItem(VOTER_IDENTITY_KEY) ?? createVoterIdentity(cryptoImpl);

  resolvedStorage.setItem(VOTER_IDENTITY_KEY, existingVoterIdentity);

  return {
    activePanel: 'situationships',
    editorMode: 'create',
    editingId: null,
    isLoading: false,
    me: null,
    notice: null,
    friendsFeed: [],
    friends: {
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
    },
    friendSuggestions: [],
    situationships: [],
    token: resolvedStorage.getItem(SESSION_KEY),
    voterIdentity: existingVoterIdentity,
    votingSessions: [],
    selectedVotingSessionId: null,
    selectedVotingResults: null,
    lastVotingShare: null,
    publicVotingInviteCode: '',
    publicVotingSession: null,
    publicVoteSubmitted: false,
  };
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createApp({
  apiClient,
  root,
  storage,
  location = typeof window !== 'undefined' ? window.location : undefined,
  history = typeof window !== 'undefined' ? window.history : undefined,
  windowRef = typeof window !== 'undefined' ? window : undefined,
  cryptoImpl = typeof crypto !== 'undefined' ? crypto : undefined,
  FormDataCtor = typeof FormData !== 'undefined' ? FormData : undefined,
  HtmlFormElementCtor = typeof HTMLFormElement !== 'undefined' ? HTMLFormElement : undefined,
} = {}) {
  if (!apiClient) {
    throw new Error('createApp requires an apiClient.');
  }

  if (!root || typeof root.addEventListener !== 'function') {
    throw new Error('createApp requires a root element with addEventListener.');
  }

  if (typeof FormDataCtor !== 'function') {
    throw new Error('createApp requires a FormData constructor.');
  }

  const resolvedStorage = resolveStorage(storage);
  const state = createInitialState({
    storage: resolvedStorage,
    cryptoImpl,
  });
  state.route = normalizeRoute(location?.pathname);

  function normalizeRoute(pathname = '/') {
    const path = pathname || '/';
    if (path === '/app') {
      return '/app/situationships';
    }
    return path;
  }

  function routeToPanel(route) {
    if (route === '/app/rank') {
      return 'feed';
    }
    if (route === '/app/friends') {
      return 'friends';
    }
    if (route === '/app/hnnt' || route === '/app/coach') {
      return 'coach';
    }
    if (route === '/app/profile') {
      return 'profile';
    }
    if (route === '/app/settings') {
      return 'settings';
    }
    if (route === '/app/voting') {
      return 'voting';
    }
    return 'situationships';
  }

  function panelToRoute(panel) {
    const routes = {
      situationships: '/app/situationships',
      feed: '/app/rank',
      friends: '/app/friends',
      coach: '/app/hnnt',
      profile: '/app/profile',
      settings: '/app/settings',
      voting: '/app/voting',
    };
    return routes[panel] ?? '/app/situationships';
  }

  function isAppRoute(route = state.route) {
    return route.startsWith('/app');
  }

  function navigate(route, { replace = false } = {}) {
    const normalized = normalizeRoute(route);
    state.route = normalized;

    if (isAppRoute(normalized)) {
      state.activePanel = routeToPanel(normalized);
    }

    if (history && location?.pathname !== normalized) {
      const method = replace ? 'replaceState' : 'pushState';
      history[method]?.call(history, {}, '', normalized);
    }

    render();
  }

  function setToken(token) {
    state.token = token;
    if (token) {
      resolvedStorage.setItem(SESSION_KEY, token);
    } else {
      resolvedStorage.removeItem(SESSION_KEY);
    }
  }

  function resetEditor() {
    state.editorMode = 'create';
    state.editingId = null;
  }

  function resetVotingState() {
    state.votingSessions = [];
    state.selectedVotingSessionId = null;
    state.selectedVotingResults = null;
    state.lastVotingShare = null;
    state.publicVotingInviteCode = '';
    state.publicVotingSession = null;
    state.publicVoteSubmitted = false;
  }

  function resetSocialState() {
    state.friendsFeed = [];
    state.friends = {
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
    };
    state.friendSuggestions = [];
  }

  function getEditingSituationship() {
    return state.situationships.find((item) => item.situationshipId === state.editingId) ?? null;
  }

  function summarizeSituationships() {
    const total = state.situationships.length;
    const active = state.situationships.filter((item) => item.status === 'active').length;
    const archived = total - active;
    return { total, active, archived };
  }

  async function bootstrapSession() {
    if (!state.token) {
      state.me = null;
      state.situationships = [];
      resetSocialState();
      resetVotingState();
      if (isAppRoute()) {
        navigate('/signin', { replace: true });
        return;
      }
      render();
      return;
    }

    state.isLoading = true;
    render();

    try {
      const [meResponse, situationshipResponse] = await Promise.all([
        apiClient.getMe(state.token),
        apiClient.getSituationships(state.token),
      ]);
      state.me = meResponse.data;
      state.situationships = situationshipResponse.data.items;
      if (typeof apiClient.getFriendsFeed === 'function') {
        const feedResponse = await apiClient.getFriendsFeed(state.token);
        state.friendsFeed = feedResponse.data.items;
      }
      if (!isAppRoute()) {
        navigate('/app/situationships', { replace: true });
      } else {
        state.activePanel = routeToPanel(state.route);
      }
      state.notice = state.notice ?? {
        type: 'success',
        message: 'Signed in.',
      };
    } catch (error) {
      console.error(error);
      setToken(null);
      state.me = null;
      state.situationships = [];
      resetSocialState();
      state.notice = {
        type: 'error',
        message: error.message ?? 'Failed to restore the local session.',
      };
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function handlePasswordAuth(form, intent) {
    const formData = new FormDataCtor(form);
    const email = formData.get('email')?.toString().trim().toLowerCase() ?? '';
    const password = formData.get('password')?.toString() ?? '';
    const username = formData.get('username')?.toString().trim() ?? '';
    const displayName = formData.get('displayName')?.toString().trim() ?? '';

    state.isLoading = true;
    render();

    try {
      const response =
        intent === 'signup'
          ? await apiClient.signUpWithEmailPassword({
              email,
              password,
              username,
              displayName,
            })
          : await apiClient.signInWithEmailPassword({
              email,
              password,
            });
      setToken(response.data.accessToken);
      state.me = response.data.me;
      state.notice = {
        type: 'success',
        message: intent === 'signup' ? 'Account created.' : 'Signed in.',
      };
      navigate('/app/situationships', { replace: true });
      await bootstrapSession();
    } catch (error) {
      state.notice = {
        type: 'error',
        message:
          error.message ??
          (intent === 'signup' ? 'Account creation failed.' : 'Sign in failed.'),
      };
      state.isLoading = false;
      render();
    }
  }

  async function handleProfileSave(form) {
    if (!state.token) {
      return;
    }

    state.isLoading = true;
    render();

    const formData = new FormDataCtor(form);
    const payload = {
      username: formData.get('username')?.toString().trim() || undefined,
      displayName: formData.get('displayName')?.toString().trim() || undefined,
      bio: formData.get('bio')?.toString().trim() || null,
      privacy: formData.get('privacy')?.toString() || undefined,
    };

    try {
      const response = await apiClient.updateMe(state.token, payload);
      state.me = response.data;
      state.notice = { type: 'success', message: 'Profile saved.' };
    } catch (error) {
      state.notice = { type: 'error', message: error.message ?? 'Profile update failed.' };
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function handleSituationshipSave(form) {
    if (!state.token) {
      return;
    }

    state.isLoading = true;
    render();

    const formData = new FormDataCtor(form);
    const payload = {
      name: formData.get('name')?.toString().trim() || '',
      emoji: formData.get('emoji')?.toString().trim() || null,
      category: formData.get('category')?.toString().trim() || null,
      description: formData.get('description')?.toString().trim() || null,
    };

    try {
      if (state.editorMode === 'edit' && state.editingId) {
        const response = await apiClient.updateSituationship(state.token, state.editingId, payload);
        state.situationships = state.situationships.map((item) =>
          item.situationshipId === state.editingId ? response.data.situationship : item,
        );
        state.notice = { type: 'success', message: 'Situationship updated.' };
      } else {
        const response = await apiClient.createSituationship(state.token, payload);
        state.situationships = [...state.situationships, response.data.situationship].sort(
          (left, right) => left.rank - right.rank,
        );
        state.notice = { type: 'success', message: 'Situationship created.' };
      }

      resetEditor();
    } catch (error) {
      state.notice = { type: 'error', message: error.message ?? 'Situationship save failed.' };
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function handleDeleteSituationship(id) {
    if (!state.token) {
      return;
    }

    state.isLoading = true;
    render();

    try {
      await apiClient.deleteSituationship(state.token, id);
      state.situationships = state.situationships.filter((item) => item.situationshipId !== id);
      if (state.editingId === id) {
        resetEditor();
      }
      state.notice = { type: 'success', message: 'Situationship deleted.' };
    } catch (error) {
      state.notice = { type: 'error', message: error.message ?? 'Delete failed.' };
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function handleReorder(id, direction) {
    if (!state.token) {
      return;
    }

    const currentIndex = state.situationships.findIndex((item) => item.situationshipId === id);
    if (currentIndex < 0) {
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= state.situationships.length) {
      return;
    }

    const reordered = [...state.situationships];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    try {
      const response = await apiClient.reorderSituationships(
        state.token,
        reordered.map((item) => item.situationshipId),
      );
      state.situationships = response.data.items;
      state.notice = { type: 'success', message: 'Order saved.' };
    } catch (error) {
      state.notice = { type: 'error', message: error.message ?? 'Reorder failed.' };
    } finally {
      render();
    }
  }

  async function ensureVotingSessionsLoaded() {
    if (!state.token) {
      return;
    }

    const response = await apiClient.getVotingSessions(state.token);
    state.votingSessions = response.data.sessions;
  }

  async function handleCreateVotingSession() {
    if (!state.token) {
      return;
    }

    state.isLoading = true;
    render();

    try {
      const response = await apiClient.createVotingSession(state.token, {
        title: 'Rate my situationships',
        anonymityMode: 'anonymous',
        expiresInHours: 48,
      });
      state.notice = {
        type: 'success',
        message: `Voting session ${response.data.session.inviteCode} created.`,
      };
      state.lastVotingShare = response.data.share ?? null;
      await ensureVotingSessionsLoaded();
      state.selectedVotingSessionId = response.data.session.votingSessionId;
      const resultsResponse = await apiClient.getVotingResults(
        state.token,
        state.selectedVotingSessionId,
      );
      state.selectedVotingResults = resultsResponse.data;
      state.activePanel = 'voting';
    } catch (error) {
      state.notice = {
        type: 'error',
        message: error.message ?? 'Voting session creation failed.',
      };
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function handleCopyShareOption(copyId) {
    const option = state.lastVotingShare?.copyOptions?.find((item) => item.copyId === copyId);
    if (!option) {
      return;
    }

    try {
      const writeText = windowRef?.navigator?.clipboard?.writeText;
      if (typeof writeText !== 'function') {
        throw new Error('Clipboard unavailable');
      }
      await writeText.call(windowRef.navigator.clipboard, option.fullText);
      state.notice = { type: 'success', message: 'Share copy copied.' };
    } catch {
      state.notice = { type: 'error', message: 'Copy failed. Select the text instead.' };
    } finally {
      render();
    }
  }

  async function handleLoadVotingPanel() {
    if (!state.token) {
      return;
    }

    state.isLoading = true;
    render();

    try {
      await ensureVotingSessionsLoaded();
      if (state.selectedVotingSessionId) {
        const resultsResponse = await apiClient.getVotingResults(
          state.token,
          state.selectedVotingSessionId,
        );
        state.selectedVotingResults = resultsResponse.data;
      } else {
        state.selectedVotingResults = null;
      }
    } catch (error) {
      state.notice = {
        type: 'error',
        message: error.message ?? 'Failed to load voting sessions.',
      };
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function handleLoadFeedPanel() {
    if (!state.token || typeof apiClient.getFriendsFeed !== 'function') {
      return;
    }

    state.isLoading = true;
    render();

    try {
      const response = await apiClient.getFriendsFeed(state.token);
      state.friendsFeed = response.data.items;
    } catch (error) {
      state.notice = {
        type: 'error',
        message: error.message ?? 'Failed to load friends feed.',
      };
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function handleSelectVotingSession(id) {
    if (!state.token) {
      return;
    }

    state.isLoading = true;
    state.selectedVotingSessionId = id;
    render();

    try {
      const response = await apiClient.getVotingResults(state.token, id);
      state.selectedVotingResults = response.data;
    } catch (error) {
      state.notice = {
        type: 'error',
        message: error.message ?? 'Failed to load voting results.',
      };
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function handleLoadFriendsPanel() {
    if (!state.token) {
      return;
    }

    state.isLoading = true;
    render();

    try {
      const [friendsResponse, suggestionsResponse] = await Promise.all([
        apiClient.getFriends(state.token),
        apiClient.getFriendSuggestions(state.token),
      ]);
      state.friends = {
        friends: friendsResponse.data.friends,
        incomingRequests: friendsResponse.data.incomingRequests,
        outgoingRequests: friendsResponse.data.outgoingRequests,
      };
      state.friendSuggestions = suggestionsResponse.data.suggestions;
    } catch (error) {
      state.notice = {
        type: 'error',
        message: error.message ?? 'Failed to load friends.',
      };
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function handleCreateFriendRequest(form) {
    if (!state.token) {
      return;
    }

    const formData = new FormDataCtor(form);
    const username = formData.get('username')?.toString().trim() ?? '';
    if (!username) {
      state.notice = { type: 'error', message: 'Username is required.' };
      render();
      return;
    }

    try {
      await apiClient.createFriendRequest(state.token, { username });
      state.notice = { type: 'success', message: 'Friend request sent.' };
      form.reset();
      await handleLoadFriendsPanel();
    } catch (error) {
      state.notice = {
        type: 'error',
        message: error.message ?? 'Friend request failed.',
      };
      render();
    }
  }

  async function handleFriendAction(action, id) {
    if (!state.token || !id) {
      return;
    }

    try {
      if (action === 'accept-friend-request') {
        await apiClient.acceptFriendRequest(state.token, id);
        state.notice = { type: 'success', message: 'Friend request accepted.' };
      }
      if (action === 'decline-friend-request') {
        await apiClient.declineFriendRequest(state.token, id);
        state.notice = { type: 'success', message: 'Friend request declined.' };
      }
      if (action === 'remove-friend') {
        await apiClient.removeFriend(state.token, id);
        state.notice = { type: 'success', message: 'Friend removed.' };
      }
      if (action === 'dismiss-friend-suggestion') {
        await apiClient.dismissFriendSuggestion(state.token, id);
        state.notice = { type: 'success', message: 'Suggestion dismissed.' };
      }
      await handleLoadFriendsPanel();
    } catch (error) {
      state.notice = {
        type: 'error',
        message: error.message ?? 'Friend action failed.',
      };
      render();
    }
  }

  async function handleRequestSuggestedFriend(profileId) {
    if (!state.token || !profileId) {
      return;
    }

    try {
      await apiClient.createFriendRequest(state.token, { addresseeProfileId: profileId });
      state.notice = { type: 'success', message: 'Friend request sent.' };
      await handleLoadFriendsPanel();
    } catch (error) {
      state.notice = {
        type: 'error',
        message: error.message ?? 'Friend request failed.',
      };
      render();
    }
  }

  async function handleLoadPublicVotingSession(form) {
    const formData = new FormDataCtor(form);
    const inviteCode = formData.get('inviteCode')?.toString().trim().toUpperCase() ?? '';
    if (!inviteCode) {
      state.notice = { type: 'error', message: 'Invite code is required.' };
      render();
      return;
    }

    state.isLoading = true;
    render();

    try {
      const response = await apiClient.getPublicVotingSession(inviteCode);
      state.publicVotingInviteCode = inviteCode;
      state.publicVotingSession = response.data;
      state.publicVoteSubmitted = false;
      state.notice = {
        type: 'success',
        message: `Loaded public voting session ${inviteCode}.`,
      };
    } catch (error) {
      state.publicVotingSession = null;
      state.notice = {
        type: 'error',
        message: error.message ?? 'Failed to load the public voting session.',
      };
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function handleSubmitPublicVote(form) {
    if (!state.publicVotingSession || !state.publicVotingInviteCode) {
      return;
    }

    const formData = new FormDataCtor(form);
    const payload = {
      voterIdentity: state.voterIdentity,
      voterName: formData.get('voterName')?.toString().trim() || null,
      bestSituationshipId: formData.get('bestSituationshipId')?.toString() || '',
      worstSituationshipId: formData.get('worstSituationshipId')?.toString() || '',
      comment: formData.get('comment')?.toString().trim() || null,
    };

    state.isLoading = true;
    render();

    try {
      await apiClient.submitVote(state.publicVotingInviteCode, payload);
      state.publicVoteSubmitted = true;
      state.notice = {
        type: 'success',
        message: 'Vote submitted through the shared backend.',
      };
    } catch (error) {
      state.notice = {
        type: 'error',
        message: error.message ?? 'Vote submission failed.',
      };
    } finally {
      state.isLoading = false;
      render();
    }
  }

  function renderNotice() {
    if (!state.notice) {
      return '';
    }

    return `
      <section class="notice notice--${escapeHtml(state.notice.type)}">
        <span>${escapeHtml(state.notice.message)}</span>
        <button class="ghost-button" data-action="dismiss-notice" type="button">Dismiss</button>
      </section>
    `;
  }

  function renderPublicNav() {
    return `
      <header class="site-nav">
        <button class="brand-mark" data-action="navigate" data-route="/" type="button">hnnt.</button>
        <nav aria-label="Primary">
          <button class="nav-link" data-action="navigate" data-route="/blog" type="button">Blog</button>
          <button class="nav-link" data-action="navigate" data-route="/docs" type="button">Guide</button>
          <button class="nav-link" data-action="navigate" data-route="/signin" type="button">Sign in</button>
          <button class="primary-button primary-button--small" data-action="navigate" data-route="/signup" type="button">Create account</button>
        </nav>
      </header>
    `;
  }

  function renderFooter() {
    return `
      <footer class="site-footer">
        <div>
          <strong>hnnt.app</strong>
          <p>Rank what you can’t say out loud.</p>
        </div>
        <nav aria-label="Footer">
          <button class="footer-link" data-action="navigate" data-route="/terms" type="button">Terms</button>
          <button class="footer-link" data-action="navigate" data-route="/privacy" type="button">Privacy</button>
          <button class="footer-link" data-action="navigate" data-route="/blog" type="button">Blog</button>
          <button class="footer-link" data-action="navigate" data-route="/docs" type="button">Guide</button>
        </nav>
      </footer>
    `;
  }

  function renderLandingPage() {
    return `
      <main class="shell shell--public">
        ${renderPublicNav()}

        <section class="public-hero">
          <div class="public-hero__copy">
            <div class="brand-word">hnnt.</div>
            <h1>Rank what you can’t say out loud.</h1>
            <p>
              Rank the people in your dating life, let trusted friends weigh in, and ask hnnt when you need a second read.
            </p>
            <div class="hero-actions">
              <button class="primary-button" data-action="navigate" data-route="/signup" type="button">Create account</button>
              <button class="secondary-button" data-action="navigate" data-route="/signin" type="button">Sign in</button>
            </div>
          </div>
          <div class="phone-preview" aria-label="HINTO app preview">
            <div class="phone-preview__bar"></div>
            <div class="mini-list">
              <div class="mini-list__header">
                <span>My List</span>
                <strong>4</strong>
              </div>
              ${['Avery', 'Jordan', 'Riley'].map((name, index) => `
                <article class="mini-card">
                  <span>#${index + 1}</span>
                  <strong>${name}</strong>
                  <small>${['Crush', 'Friend', 'Complicated'][index]}</small>
                </article>
              `).join('')}
            </div>
          </div>
        </section>

        <section class="feature-grid feature-grid--public" aria-label="How HINTO works">
          <article class="feature-card">
            <div class="feature-index">01</div>
            <h2>Build your list</h2>
            <p>Add crushes, exes, friends, and complicated almosts. Keep notes and reorder as things change.</p>
          </article>
          <article class="feature-card">
            <div class="feature-index">02</div>
            <h2>Rank with friends</h2>
            <p>Share a vote, post to your friends feed, and see who your people think is the best fit.</p>
          </article>
          <article class="feature-card">
            <div class="feature-index">03</div>
            <h2>Ask hnnt</h2>
            <p>Use hnnt for private reflection, pattern spotting, and next-step prompts.</p>
          </article>
        </section>

        ${renderFooter()}
      </main>
    `;
  }

  function renderAuthOptions(intent) {
    const isSignup = intent === 'signup';
    const heading = isSignup ? 'Create your HINTO account' : 'Welcome back';
    const subheading = isSignup
      ? 'Choose how you want to start. You can link more sign-in options later.'
      : 'Sign in with the method connected to your account.';

    return `
      <main class="shell shell--public shell--auth">
        ${renderPublicNav()}
        <section class="auth-layout">
          <div class="auth-copy">
            <div class="eyebrow">${isSignup ? 'Create account' : 'Sign in'}</div>
            <h1>${heading}</h1>
            <p>${subheading}</p>
          </div>
          <section class="auth-card" aria-label="${heading}">
            <form id="${isSignup ? 'signup-form' : 'signin-form'}" class="stack-form auth-form">
              <label>
                <span>Email address</span>
                <input name="email" type="email" autocomplete="email" required />
              </label>
              <label>
                <span>Password</span>
                <input name="password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" minlength="8" required />
              </label>
              ${isSignup
                ? `
                  <label>
                    <span>Username</span>
                    <input name="username" autocomplete="username" required />
                  </label>
                  <label>
                    <span>Display name</span>
                    <input name="displayName" autocomplete="name" required />
                  </label>
                `
                : ''}
              <button class="primary-button" type="submit">${isSignup ? 'Create account' : 'Sign in'}</button>
            </form>
            <div class="auth-divider">More sign-in options</div>
            <button class="auth-option" type="button" disabled>
              <span>TikTok</span>
              <small>Coming next</small>
            </button>
            <button class="auth-option" type="button" disabled>
              <span>Snapchat</span>
              <small>Coming next</small>
            </button>
            <button class="auth-option" type="button" disabled>
              <span>Meta</span>
              <small>Coming next</small>
            </button>
            <button class="auth-option" type="button" disabled>
              <span>Apple</span>
              <small>Web setup pending</small>
            </button>
            <button class="footer-link auth-swap" data-action="navigate" data-route="${isSignup ? '/signin' : '/signup'}" type="button">
              ${isSignup ? 'Already have an account? Sign in' : 'New to HINTO? Create account'}
            </button>
          </section>
        </section>
        ${renderFooter()}
      </main>
    `;
  }

  function renderContentPage(kind) {
    const content = {
      terms: {
        eyebrow: 'Legal',
        title: 'Terms of Service',
        body: 'This page will host HINTO terms before launch. For now, it marks the route and footer destination for the product site.',
      },
      privacy: {
        eyebrow: 'Legal',
        title: 'Privacy Policy',
        body: 'This page will explain account data, friend voting, hnnt coaching data, and privacy controls before public launch.',
      },
      blog: {
        eyebrow: 'Stories',
        title: 'HINTO Blog',
        body: 'Product updates, dating clarity guides, and launch notes will live here.',
      },
      docs: {
        eyebrow: 'Guide',
        title: 'How HINTO Works',
        body: 'This guide will cover lists, Rank, voting links, privacy settings, and hnnt coaching.',
      },
    }[kind] ?? {
      eyebrow: 'HINTO',
      title: 'Page not found',
      body: 'This page does not exist yet.',
    };

    return `
      <main class="shell shell--public">
        ${renderPublicNav()}
        <section class="content-page">
          <div class="eyebrow">${content.eyebrow}</div>
          <h1>${content.title}</h1>
          <p>${content.body}</p>
        </section>
        ${renderFooter()}
      </main>
    `;
  }

  function renderProfilePanel() {
    const profile = state.me?.profile;
    const auth = state.me?.auth;
    const linkedProviders = Array.isArray(auth?.linkedProviders)
      ? auth.linkedProviders
      : ['development'];

    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Profile</div>
            <h2>Your profile</h2>
          </div>
        </div>

        <form id="profile-form" class="stack-form">
          <label>
            <span>Username</span>
            <input name="username" required value="${escapeHtml(profile?.username ?? '')}" />
          </label>
          <label>
            <span>Display Name</span>
            <input name="displayName" value="${escapeHtml(profile?.displayName ?? '')}" />
          </label>
          <label>
            <span>Bio</span>
            <textarea name="bio" rows="4">${escapeHtml(profile?.bio ?? '')}</textarea>
          </label>
          <label>
            <span>Privacy</span>
            <select name="privacy">
              <option value="private" ${profile?.privacy === 'private' ? 'selected' : ''}>Private</option>
              <option value="mutuals_only" ${profile?.privacy === 'mutuals_only' ? 'selected' : ''}>Mutuals Only</option>
              <option value="public" ${profile?.privacy === 'public' ? 'selected' : ''}>Public</option>
            </select>
          </label>
          <button class="primary-button" type="submit">Save Profile</button>
        </form>

        <div class="meta-grid">
          <article class="meta-card">
            <div class="eyebrow">Identity</div>
            <h3>${escapeHtml(auth?.primaryProvider ?? 'development')}</h3>
            <p>Your current sign-in method.</p>
          </article>
          <article class="meta-card">
            <div class="eyebrow">Linked providers</div>
            <h3>${escapeHtml(linkedProviders.join(', '))}</h3>
            <p>Additional sign-in methods connected to your account.</p>
          </article>
        </div>
      </section>
    `;
  }

  function renderSituationshipEditor() {
    const editing = getEditingSituationship();

    return `
      <section class="panel panel--editor">
        <div class="panel-header">
          <div>
            <div class="eyebrow">${state.editorMode === 'edit' ? 'Edit' : 'Create'}</div>
            <h2>${state.editorMode === 'edit' ? 'Update situationship' : 'Add situationship'}</h2>
          </div>
          ${state.editorMode === 'edit'
            ? '<button class="ghost-button" data-action="cancel-editor" type="button">Cancel</button>'
            : ''}
        </div>

        <form id="situationship-form" class="stack-form">
          <label>
            <span>Name</span>
            <input name="name" required value="${escapeHtml(editing?.name ?? '')}" />
          </label>
          <label>
            <span>Emoji</span>
            <input name="emoji" maxlength="4" value="${escapeHtml(editing?.emoji ?? '💖')}" />
          </label>
          <label>
            <span>Category</span>
            <select name="category">
              ${['Crush', 'Friend', 'Ex', 'Family', 'Work', 'Other']
                .map(
                  (value) =>
                    `<option value="${value}" ${editing?.category === value ? 'selected' : ''}>${value}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label>
            <span>Description</span>
            <textarea name="description" rows="4">${escapeHtml(editing?.description ?? '')}</textarea>
          </label>
          <button class="primary-button" type="submit">
            ${state.editorMode === 'edit' ? 'Save Changes' : 'Create Situationship'}
          </button>
        </form>
      </section>
    `;
  }

  function renderSituationshipPanel() {
    const summary = summarizeSituationships();

    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Situationships</div>
            <h2>My List</h2>
          </div>
          <button class="secondary-button" data-action="new-situationship" type="button">Add New</button>
        </div>

        <div class="stats-row">
          <article class="stat-card">
            <span class="stat-label">Total</span>
            <strong>${summary.total}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">Active</span>
            <strong>${summary.active}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">Archived</span>
            <strong>${summary.archived}</strong>
          </article>
        </div>

        <div class="list-stack">
          ${state.situationships.length === 0
            ? `
              <article class="empty-card">
                <h3>No situationships yet</h3>
                <p>Add someone to your list, then reorder as your read on them changes.</p>
              </article>
            `
            : state.situationships
                .map(
                  (item, index) => `
                    <article class="list-card">
                      <div class="list-card__rank">#${index + 1}</div>
                      <div class="list-card__body">
                        <div class="list-card__title-row">
                          <h3>${escapeHtml(item.emoji ?? '💖')} ${escapeHtml(item.name)}</h3>
                          <span class="pill">${escapeHtml(item.category ?? 'Other')}</span>
                        </div>
                        <p>${escapeHtml(item.description ?? 'No notes yet.')}</p>
                      </div>
                      <div class="list-card__actions">
                        <button class="ghost-button" data-action="move-up" data-id="${escapeHtml(item.situationshipId)}" type="button">Up</button>
                        <button class="ghost-button" data-action="move-down" data-id="${escapeHtml(item.situationshipId)}" type="button">Down</button>
                        <button class="ghost-button" data-action="edit-situationship" data-id="${escapeHtml(item.situationshipId)}" type="button">Edit</button>
                        <button class="ghost-button ghost-button--danger" data-action="delete-situationship" data-id="${escapeHtml(item.situationshipId)}" type="button">Delete</button>
                      </div>
                    </article>
                  `,
                )
                .join('')}
        </div>
      </section>
    `;
  }

  function renderFeedPanel() {
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
              <div class="eyebrow">Rank</div>
              <h2>Rank</h2>
          </div>
          <button class="secondary-button" data-action="refresh-feed" type="button">Refresh</button>
        </div>

        <div class="list-stack">
          ${state.friendsFeed.length === 0
            ? `
              <article class="empty-card">
                <h3>No friend activity yet</h3>
                <p>When friends ask for votes or share updates, they will appear here.</p>
              </article>
            `
            : state.friendsFeed.map((item) => `
                <article class="list-card">
                  <div class="list-card__rank">${escapeHtml(item.situationship?.emoji ?? '💖')}</div>
                  <div class="list-card__body">
                    <div class="list-card__title-row">
                      <h3>${escapeHtml(item.situationship?.name ?? 'Untitled')}</h3>
                      <span class="pill">${escapeHtml(item.situationship?.category ?? 'Other')}</span>
                    </div>
                    <p>${escapeHtml(item.ownerProfile?.displayName ?? 'Friend')} · @${escapeHtml(item.ownerProfile?.username ?? '')}</p>
                  </div>
                </article>
              `).join('')}
        </div>
      </section>
    `;
  }

  function renderFriendshipCard(item, actions = '') {
    return `
      <article class="list-card">
        <div class="list-card__rank">@</div>
        <div class="list-card__body">
          <div class="list-card__title-row">
            <h3>${escapeHtml(item.otherProfile.displayName)}</h3>
            <span class="pill">${escapeHtml(item.status)}</span>
          </div>
          <p>@${escapeHtml(item.otherProfile.username || item.otherProfile.profileId)}</p>
        </div>
        ${actions ? `<div class="list-card__actions">${actions}</div>` : ''}
      </article>
    `;
  }

  function renderFriendsPanel() {
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Friends</div>
            <h2>Friends</h2>
          </div>
          <button class="secondary-button" data-action="refresh-friends" type="button">Refresh</button>
        </div>

        <div class="workspace">
          <div class="workspace__main">
            <section class="panel panel--editor">
              <div class="panel-header">
                <div>
                  <div class="eyebrow">Invite friends to vote</div>
                  <h2>Find someone specific</h2>
                </div>
              </div>
              <form id="friend-request-form" class="stack-form">
                <label>
                  <span>Username</span>
                  <input name="username" placeholder="@maya" autocomplete="off" />
                </label>
                <button class="primary-button" type="submit">Send Request</button>
              </form>
              <p class="form-hint">iPhone contact fuzzy search will sit above suggestions in the native flow; this web shell uses username lookup for now.</p>
            </section>

            <section class="panel panel--editor">
              <div class="panel-header">
                <div>
                  <div class="eyebrow">Your list</div>
                  <h2>${state.friends.friends.length} friend${state.friends.friends.length === 1 ? '' : 's'}</h2>
                </div>
              </div>
              <div class="list-stack">
                ${state.friends.friends.length === 0
                  ? `
                    <article class="empty-card">
                      <h3>No friends yet</h3>
                      <p>Send a request or invite someone from a vote link.</p>
                    </article>
                  `
                  : state.friends.friends.map((item) => renderFriendshipCard(
                      item,
                      `<button class="ghost-button ghost-button--danger" data-action="remove-friend" data-id="${escapeHtml(item.otherProfile.profileId)}" type="button">Remove</button>`,
                    )).join('')}
              </div>
            </section>
          </div>

          <aside class="workspace__side">
            <section class="panel panel--editor">
              <div class="panel-header">
                <div>
                  <div class="eyebrow">Requests</div>
                  <h2>Pending</h2>
                </div>
              </div>
              <div class="list-stack">
                ${state.friends.incomingRequests.length === 0
                  ? '<article class="empty-card"><h3>No incoming requests</h3><p>New friend requests will appear here.</p></article>'
                  : state.friends.incomingRequests.map((item) => renderFriendshipCard(
                      item,
                      `<button class="ghost-button" data-action="accept-friend-request" data-id="${escapeHtml(item.friendshipId)}" type="button">Accept</button>
                       <button class="ghost-button ghost-button--danger" data-action="decline-friend-request" data-id="${escapeHtml(item.friendshipId)}" type="button">Decline</button>`,
                    )).join('')}
                ${state.friends.outgoingRequests.map((item) => renderFriendshipCard(item)).join('')}
              </div>
            </section>

            <section class="panel panel--editor">
              <div class="panel-header">
                <div>
                  <div class="eyebrow">People you may know</div>
                  <h2>Suggestions</h2>
                </div>
              </div>
              <div class="list-stack">
                ${state.friendSuggestions.length === 0
                  ? '<article class="empty-card"><h3>No suggestions yet</h3><p>Suggestions will stay limited and explain why they appear.</p></article>'
                  : state.friendSuggestions.map((item) => `
                    <article class="list-card">
                      <div class="list-card__rank">+</div>
                      <div class="list-card__body">
                        <div class="list-card__title-row">
                          <h3>${escapeHtml(item.profile.displayName)}</h3>
                          <span class="pill">${escapeHtml(item.reasonCode)}</span>
                        </div>
                        <p>@${escapeHtml(item.profile.username || item.profile.profileId)}${item.mutualCount ? ` · ${escapeHtml(item.mutualCount)} mutual` : ''}</p>
                      </div>
                      <div class="list-card__actions">
                        <button class="ghost-button" data-action="request-suggested-friend" data-id="${escapeHtml(item.profile.profileId)}" type="button">Add</button>
                        <button class="ghost-button" data-action="dismiss-friend-suggestion" data-id="${escapeHtml(item.suggestionId)}" type="button">Dismiss</button>
                      </div>
                    </article>
                  `).join('')}
              </div>
            </section>
          </aside>
        </div>
      </section>
    `;
  }

  function renderCoachPanel() {
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
              <div class="eyebrow">hnnt</div>
              <h2>Ask hnnt</h2>
          </div>
        </div>

        <div class="meta-grid">
          <article class="meta-card">
            <div class="eyebrow">Private</div>
            <h3>Ask for a read</h3>
            <p>Use coaching for reflection, red flags, next texts, and pattern spotting.</p>
          </article>
          <article class="meta-card">
            <div class="eyebrow">Contextual</div>
            <h3>Built around your list</h3>
            <p>Coaching should eventually reference your profile, situationships, and vote results.</p>
          </article>
          <article class="meta-card">
            <div class="eyebrow">Status</div>
            <h3>Chat UI pending</h3>
            <p>The API routes exist, and the next pass should wire the full conversation interface here.</p>
          </article>
        </div>
      </section>
    `;
  }

  function renderSettingsPanel() {
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Settings</div>
            <h2>Account and safety</h2>
          </div>
        </div>

        <div class="settings-list">
          <button class="settings-row" data-action="set-panel" data-panel="profile" type="button">
            <span>Edit profile</span>
            <small>Username, bio, privacy</small>
          </button>
          <button class="settings-row" data-action="navigate" data-route="/privacy" type="button">
            <span>Privacy Policy</span>
            <small>Public page placeholder</small>
          </button>
          <button class="settings-row" data-action="navigate" data-route="/terms" type="button">
            <span>Terms of Service</span>
            <small>Public page placeholder</small>
          </button>
          <button class="settings-row settings-row--danger" data-action="sign-out" type="button">
            <span>Sign out</span>
            <small>Clear this browser session</small>
          </button>
        </div>
      </section>
    `;
  }

  function renderAppSupportPanel() {
    return `
      <section class="panel panel--editor">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Quick actions</div>
            <h2>Keep moving</h2>
          </div>
        </div>
        <div class="list-stack">
          <button class="settings-row" data-action="set-panel" data-panel="situationships" type="button">
            <span>Add or rank someone</span>
            <small>Manage your list</small>
          </button>
          <button class="settings-row" data-action="set-panel" data-panel="voting" type="button">
            <span>Create a vote</span>
            <small>Ask friends for feedback</small>
          </button>
          <button class="settings-row" data-action="set-panel" data-panel="coach" type="button">
            <span>Ask hnnt</span>
            <small>Talk through what changed</small>
          </button>
        </div>
      </section>
    `;
  }

  function renderVotingShareCard() {
    const share = state.lastVotingShare;
    if (!share) {
      return '';
    }

    return `
      <section class="panel panel--editor">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Invite friends to vote</div>
            <h2>Share this vote</h2>
          </div>
          <a class="secondary-button" href="${escapeHtml(share.shareUrl)}" target="_blank" rel="noreferrer">Open</a>
        </div>
        <div class="share-copy-grid">
          ${share.copyOptions.map((option) => `
            <article class="share-copy-card">
              <p>${escapeHtml(option.text)}</p>
              <button class="ghost-button" data-action="copy-share-text" data-id="${escapeHtml(option.copyId)}" type="button">Copy</button>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderVotingPanel({ publicOnly = false } = {}) {
    const selectedResults = state.selectedVotingResults;
    const publicSession = state.publicVotingSession;
    const isAuthenticated = Boolean(state.token) && !publicOnly;

    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Voting</div>
            <h2>${isAuthenticated ? 'Create votes and review results' : 'Submit your vote'}</h2>
          </div>
          ${isAuthenticated
            ? '<button class="secondary-button" data-action="create-voting-session" type="button">Create Vote</button>'
            : ''}
        </div>

        ${isAuthenticated
          ? `
            <div class="meta-grid">
              <article class="meta-card">
                <div class="eyebrow">Your votes</div>
                <h3>${state.votingSessions.length}</h3>
                <p>Active voting links you have created.</p>
              </article>
              <article class="meta-card">
                <div class="eyebrow">Invite code</div>
                <h3>${escapeHtml(state.publicVotingInviteCode || 'None')}</h3>
                <p>Load a public invite code to preview the voter experience.</p>
              </article>
            </div>
            ${renderVotingShareCard()}
          `
          : ''}

        <div class="workspace">
          <div class="workspace__main">
            <section class="panel panel--editor">
              <div class="panel-header">
                <div>
                  <div class="eyebrow">Public submission</div>
                  <h2>Vote tester</h2>
                </div>
              </div>

              <form id="public-session-form" class="stack-form">
                <label>
                  <span>Invite Code</span>
                  <input name="inviteCode" required value="${escapeHtml(state.publicVotingInviteCode)}" />
                </label>
                <button class="primary-button" type="submit">Load Session</button>
              </form>

              ${publicSession
                ? `
                  <div class="meta-card">
                    <div class="eyebrow">Loaded session</div>
                    <h3>${escapeHtml(publicSession.session.title)}</h3>
                    <p>${escapeHtml(publicSession.ownerProfile.displayName)} · ${escapeHtml(publicSession.session.inviteCode)}</p>
                  </div>

                  ${state.publicVoteSubmitted
                    ? `
                      <article class="empty-card">
                        <h3>Vote submitted</h3>
                        <p>The current browser voter identity has already submitted for this session.</p>
                      </article>
                    `
                    : `
                      <form id="public-vote-form" class="stack-form">
                        <label>
                          <span>Your name (optional)</span>
                          <input name="voterName" value="" />
                        </label>
                        <label>
                          <span>Best Fit</span>
                          <select name="bestSituationshipId" required>
                            ${publicSession.items.map((item) => `<option value="${escapeHtml(item.situationshipId)}">${escapeHtml(item.emoji ?? '💖')} ${escapeHtml(item.name)}</option>`).join('')}
                          </select>
                        </label>
                        <label>
                          <span>Not the One</span>
                          <select name="worstSituationshipId" required>
                            ${publicSession.items.map((item) => `<option value="${escapeHtml(item.situationshipId)}">${escapeHtml(item.emoji ?? '💖')} ${escapeHtml(item.name)}</option>`).join('')}
                          </select>
                        </label>
                        <label>
                          <span>Comment</span>
                          <textarea name="comment" rows="3"></textarea>
                        </label>
                        <button class="primary-button" type="submit">Submit Vote</button>
                      </form>
                    `}
                `
                : `
                  <article class="empty-card">
                    <h3>No public session loaded</h3>
                    <p>Enter an invite code to verify the public vote submission screen against the shared API.</p>
                  </article>
                `}
            </section>
          </div>

          ${isAuthenticated
            ? `<aside class="workspace__side">
            <section class="panel panel--editor">
              <div class="panel-header">
                <div>
                  <div class="eyebrow">Owner results</div>
                  <h2>Session results</h2>
                </div>
              </div>

              <div class="list-stack">
                ${state.votingSessions.length === 0
                  ? `
                    <article class="empty-card">
                      <h3>No sessions yet</h3>
                      <p>Create a voting session to load owner-facing results here.</p>
                    </article>
                  `
                  : state.votingSessions.map((session) => `
                      <article class="list-card">
                        <div class="list-card__body">
                          <div class="list-card__title-row">
                            <h3>${escapeHtml(session.title)}</h3>
                            <span class="pill">${escapeHtml(session.status)}</span>
                          </div>
                          <p>${escapeHtml(session.inviteCode)} · ${escapeHtml(session.expiresAt)}</p>
                        </div>
                        <div class="list-card__actions">
                          <button class="ghost-button" data-action="load-voting-results" data-id="${escapeHtml(session.votingSessionId)}" type="button">Open</button>
                        </div>
                      </article>
                    `).join('')}
              </div>

              ${selectedResults
                ? `
                  <div class="meta-card">
                    <div class="eyebrow">Selected results</div>
                    <h3>${escapeHtml(selectedResults.session.title)}</h3>
                    <p>${selectedResults.totalVoters} voters · ${selectedResults.totalVotes} votes</p>
                  </div>
                  <div class="list-stack">
                    ${selectedResults.results.map((result) => `
                      <article class="list-card">
                        <div class="list-card__rank">#${escapeHtml(result.rank)}</div>
                        <div class="list-card__body">
                          <div class="list-card__title-row">
                            <h3>${escapeHtml(result.emoji ?? '💖')} ${escapeHtml(result.name)}</h3>
                            <span class="pill">score ${escapeHtml(result.score)}</span>
                          </div>
                          <p>${escapeHtml(result.bestVotes)} best · ${escapeHtml(result.worstVotes)} worst · ${escapeHtml(result.totalVotes)} total</p>
                        </div>
                      </article>
                    `).join('')}
                  </div>
                `
                : ''}
            </section>
          </aside>`
            : ''}
        </div>
      </section>
    `;
  }

  function renderAuthenticated() {
    const profile = state.me?.profile;
    const navItems = [
      ['situationships', 'My List'],
      ['feed', 'Rank'],
      ['friends', 'Friends'],
      ['coach', 'hnnt'],
      ['profile', 'Profile'],
      ['settings', 'Settings'],
    ];

    return `
      <main class="shell">
        <section class="topbar">
          <div>
            <div class="eyebrow">hnnt.</div>
            <h1>${escapeHtml(profile?.displayName ?? 'My account')}</h1>
          </div>
          <nav class="topbar__actions" aria-label="App">
            ${navItems.map(([panel, label]) => `
              <button class="ghost-button ${state.activePanel === panel ? 'ghost-button--active' : ''}" data-action="set-panel" data-panel="${panel}" type="button">
                ${label}
              </button>
            `).join('')}
          </nav>
        </section>

        ${renderNotice()}

        <section class="hero-card hero-card--compact">
          <div>
            <div class="eyebrow">Profile</div>
            <h2>@${escapeHtml(profile?.username ?? 'local_dev')}</h2>
            <p>${escapeHtml(profile?.bio ?? 'Rank your situationships, ask friends, and ask hnnt when you need clarity.')}</p>
          </div>
          <div class="hero-summary">
            <div>
              <span>Privacy</span>
              <strong>${escapeHtml(profile?.privacy ?? 'private')}</strong>
            </div>
            <div>
              <span>Tier</span>
              <strong>${escapeHtml(profile?.subscriptionTier ?? 'free')}</strong>
            </div>
          </div>
        </section>

        <section class="workspace">
          <div class="workspace__main">
            ${state.activePanel === 'profile'
              ? renderProfilePanel()
              : state.activePanel === 'voting'
                ? renderVotingPanel()
                : state.activePanel === 'feed'
                  ? renderFeedPanel()
                  : state.activePanel === 'friends'
                    ? renderFriendsPanel()
                    : state.activePanel === 'coach'
                      ? renderCoachPanel()
                      : state.activePanel === 'settings'
                        ? renderSettingsPanel()
                        : renderSituationshipPanel()}
          </div>
          <aside class="workspace__side">
            ${state.activePanel === 'situationships' ? renderSituationshipEditor() : renderAppSupportPanel()}
          </aside>
        </section>
      </main>
    `;
  }

  function renderPublicVotingPage() {
    const inviteCodeFromRoute = state.route.split('/').filter(Boolean)[1] ?? '';
    if (!state.publicVotingInviteCode && inviteCodeFromRoute) {
      state.publicVotingInviteCode = inviteCodeFromRoute.toUpperCase();
    }

    return `
      <main class="shell shell--public">
        ${renderPublicNav()}
        <section class="content-page content-page--wide">
          <div class="eyebrow">Friend vote</div>
          <h1>Vote on this HINTO list</h1>
          <p>Pick who feels like the best fit and who does not. Your vote is submitted to the same results flow used in the app.</p>
          ${renderVotingPanel({ publicOnly: true })}
        </section>
        ${renderFooter()}
      </main>
    `;
  }

  function renderPublicRoute() {
    if (state.route === '/signup') {
      return renderAuthOptions('signup');
    }
    if (state.route === '/signin') {
      return renderAuthOptions('signin');
    }
    if (state.route === '/terms') {
      return renderContentPage('terms');
    }
    if (state.route === '/privacy') {
      return renderContentPage('privacy');
    }
    if (state.route === '/blog') {
      return renderContentPage('blog');
    }
    if (state.route === '/docs') {
      return renderContentPage('docs');
    }
    if (state.route.startsWith('/vote/')) {
      return renderPublicVotingPage();
    }
    return renderLandingPage();
  }

  function render() {
    root.innerHTML = `
      <div class="app-frame">
        ${state.isLoading ? '<div class="loading-bar"></div>' : ''}
        ${state.token && isAppRoute() ? renderAuthenticated() : `${renderNotice()}${renderPublicRoute()}`}
      </div>
    `;
  }

  async function handleClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) {
      return;
    }

    if (action === 'navigate') {
      const route = event.target.closest('[data-route]')?.dataset.route ?? '/';
      navigate(route);
      return;
    }

    if (action === 'dismiss-notice') {
      state.notice = null;
      render();
      return;
    }

    if (action === 'set-panel') {
      state.activePanel = event.target.closest('[data-panel]')?.dataset.panel ?? 'situationships';
      navigate(panelToRoute(state.activePanel));
      if (state.activePanel === 'voting') {
        await handleLoadVotingPanel();
        return;
      }
      if (state.activePanel === 'feed') {
        await handleLoadFeedPanel();
        return;
      }
      if (state.activePanel === 'friends') {
        await handleLoadFriendsPanel();
        return;
      }
      render();
      return;
    }

    if (action === 'sign-out') {
      setToken(null);
      state.me = null;
      state.situationships = [];
      resetSocialState();
      resetVotingState();
      resetEditor();
      state.notice = { type: 'success', message: 'Signed out.' };
      navigate('/');
      return;
    }

    const id = event.target.closest('[data-id]')?.dataset.id ?? null;

    if (action === 'new-situationship') {
      resetEditor();
      render();
      return;
    }

    if (action === 'cancel-editor') {
      resetEditor();
      render();
      return;
    }

    if (action === 'edit-situationship' && id) {
      state.editorMode = 'edit';
      state.editingId = id;
      render();
      return;
    }

    if (action === 'delete-situationship' && id) {
      await handleDeleteSituationship(id);
      return;
    }

    if (action === 'create-voting-session') {
      await handleCreateVotingSession();
      return;
    }

    if (action === 'refresh-feed') {
      await handleLoadFeedPanel();
      return;
    }

    if (action === 'refresh-friends') {
      await handleLoadFriendsPanel();
      return;
    }

    if (action === 'load-voting-results' && id) {
      await handleSelectVotingSession(id);
      return;
    }

    if (action === 'copy-share-text' && id) {
      await handleCopyShareOption(id);
      return;
    }

    if (action === 'request-suggested-friend' && id) {
      await handleRequestSuggestedFriend(id);
      return;
    }

    if (
      action === 'accept-friend-request' ||
      action === 'decline-friend-request' ||
      action === 'remove-friend' ||
      action === 'dismiss-friend-suggestion'
    ) {
      await handleFriendAction(action, id);
      return;
    }

    if ((action === 'move-up' || action === 'move-down') && id) {
      await handleReorder(id, action === 'move-up' ? 'up' : 'down');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (HtmlFormElementCtor && event.target instanceof HtmlFormElementCtor === false) {
      return;
    }

    if (event.target.id === 'profile-form') {
      await handleProfileSave(event.target);
      return;
    }

    if (event.target.id === 'situationship-form') {
      await handleSituationshipSave(event.target);
      return;
    }

    if (event.target.id === 'friend-request-form') {
      await handleCreateFriendRequest(event.target);
      return;
    }

    if (event.target.id === 'public-session-form') {
      await handleLoadPublicVotingSession(event.target);
      return;
    }

    if (event.target.id === 'public-vote-form') {
      await handleSubmitPublicVote(event.target);
      return;
    }

    if (event.target.id === 'signup-form') {
      await handlePasswordAuth(event.target, 'signup');
      return;
    }

    if (event.target.id === 'signin-form') {
      await handlePasswordAuth(event.target, 'signin');
    }
  }

  let mounted = false;

  function mount() {
    if (!mounted) {
      root.addEventListener('click', handleClick);
      root.addEventListener('submit', handleSubmit);
      windowRef?.addEventListener?.('popstate', () => {
        state.route = normalizeRoute(location?.pathname);
        if (isAppRoute()) {
          state.activePanel = routeToPanel(state.route);
        }
        render();
      });
      mounted = true;
    }

    render();
    return bootstrapSession();
  }

  return {
    state,
    render,
    mount,
    bootstrapSession,
    handlePasswordAuth,
    handleProfileSave,
    handleSituationshipSave,
    handleDeleteSituationship,
    handleReorder,
    handleCreateVotingSession,
    handleLoadVotingPanel,
    handleLoadFeedPanel,
    handleSelectVotingSession,
    handleLoadPublicVotingSession,
    handleSubmitPublicVote,
    setToken,
    resetEditor,
    resetVotingState,
  };
}
