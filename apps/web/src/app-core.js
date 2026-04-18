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
    situationships: [],
    token: resolvedStorage.getItem(SESSION_KEY),
    voterIdentity: existingVoterIdentity,
    votingSessions: [],
    selectedVotingSessionId: null,
    selectedVotingResults: null,
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
    state.publicVotingInviteCode = '';
    state.publicVotingSession = null;
    state.publicVoteSubmitted = false;
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
      resetVotingState();
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
      state.notice = state.notice ?? {
        type: 'success',
        message: 'Connected to the shared restart API.',
      };
    } catch (error) {
      console.error(error);
      setToken(null);
      state.me = null;
      state.situationships = [];
      state.notice = {
        type: 'error',
        message: error.message ?? 'Failed to restore the local session.',
      };
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function handleDevelopmentSignIn() {
    state.isLoading = true;
    render();

    try {
      const response = await apiClient.createDevelopmentSession({
        profileId: 'dev-user-001',
        username: 'local_dev',
        displayName: 'Local Dev',
        email: 'dev@hinto.app',
        privacy: 'private',
      });
      setToken(response.data.accessToken);
      state.me = response.data.me;
      state.notice = {
        type: 'success',
        message: 'Development session created against the shared backend.',
      };
      await bootstrapSession();
    } catch (error) {
      state.notice = {
        type: 'error',
        message: error.message ?? 'Failed to create the development session.',
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

  function renderOnboarding() {
    return `
      <main class="shell shell--welcome">
        <section class="hero-card">
          <div class="eyebrow">Canonical restart slice</div>
          <h1>SwiftUI and web now point at the same local API.</h1>
          <p>
            This web shell mirrors the restart-era onboarding, profile, and situationship flows
            without reviving the Expo or Amplify stack.
          </p>
          <div class="hero-actions">
            <button class="primary-button" data-action="local-sign-in" type="button">
              Use Local API
            </button>
            <button class="secondary-button" type="button" disabled>
              Apple Sign In Soon
            </button>
          </div>
        </section>

        <section class="feature-grid">
          <article class="feature-card">
            <div class="feature-index">01</div>
            <h2>Profile contract</h2>
            <p>Editable username, display name, bio, and privacy settings against <code>/v1/me</code>.</p>
          </article>
          <article class="feature-card">
            <div class="feature-index">02</div>
            <h2>Situationship management</h2>
            <p>Create, edit, delete, and reorder entries against the shared API surface.</p>
          </article>
          <article class="feature-card">
            <div class="feature-index">03</div>
            <h2>Roadmap honesty</h2>
            <p>Voting is now wired to the shared backend, while AI remains an intentionally staged shell.</p>
          </article>
        </section>
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
            <h2>Owner settings</h2>
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
            <p>Primary provider for the restored session.</p>
          </article>
          <article class="meta-card">
            <div class="eyebrow">Linked providers</div>
            <h3>${escapeHtml(linkedProviders.join(', '))}</h3>
            <p>Additional provider linking remains staged behind restart auth work.</p>
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
            <h2>Ranked list owner view</h2>
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
                <p>Create the first entry, then reorder it from the same shared API surface the SwiftUI app uses.</p>
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

  function renderRoadmapPanel() {
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Next slice</div>
            <h2>Voting and AI shells</h2>
          </div>
        </div>

        <div class="meta-grid">
          <article class="meta-card">
            <div class="eyebrow">Voting</div>
            <h3>Backend live</h3>
            <p>The shared API now supports session creation, public vote submission, duplicate-vote rejection, and owner results aggregation.</p>
          </article>
          <article class="meta-card">
            <div class="eyebrow">Results</div>
            <h3>Client wiring ongoing</h3>
            <p>The current task is moving Swift and web screens from placeholder copy into real session, submission, and results flows.</p>
          </article>
          <article class="meta-card">
            <div class="eyebrow">AI coach</div>
            <h3>Prompt package next</h3>
            <p>The interface is intentionally deferred until <code>/packages/prompts</code> and the conversation routes are ready.</p>
          </article>
        </div>
      </section>
    `;
  }

  function renderVotingPanel() {
    const selectedResults = state.selectedVotingResults;
    const publicSession = state.publicVotingSession;

    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Voting</div>
            <h2>Session creation, public submission, and owner results</h2>
          </div>
          <button class="secondary-button" data-action="create-voting-session" type="button">Create Session</button>
        </div>

        <div class="meta-grid">
          <article class="meta-card">
            <div class="eyebrow">Owner sessions</div>
            <h3>${state.votingSessions.length}</h3>
            <p>Sessions created from the shared backend contract.</p>
          </article>
          <article class="meta-card">
            <div class="eyebrow">Public tester</div>
            <h3>${escapeHtml(state.publicVotingInviteCode || 'None')}</h3>
            <p>Load a public invite code and submit a real vote from this shell.</p>
          </article>
        </div>

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

          <aside class="workspace__side">
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
          </aside>
        </div>
      </section>
    `;
  }

  function renderAuthenticated() {
    const profile = state.me?.profile;

    return `
      <main class="shell">
        <section class="topbar">
          <div>
            <div class="eyebrow">HINTO restart web</div>
            <h1>${escapeHtml(profile?.displayName ?? 'Owner view')}</h1>
          </div>
          <div class="topbar__actions">
            <button class="ghost-button" data-action="set-panel" data-panel="situationships" type="button">Situationships</button>
            <button class="ghost-button" data-action="set-panel" data-panel="profile" type="button">Profile</button>
            <button class="ghost-button" data-action="set-panel" data-panel="voting" type="button">Voting</button>
            <button class="ghost-button" data-action="set-panel" data-panel="roadmap" type="button">Roadmap</button>
            <button class="ghost-button ghost-button--danger" data-action="sign-out" type="button">Sign Out</button>
          </div>
        </section>

        ${renderNotice()}

        <section class="hero-card hero-card--compact">
          <div>
            <div class="eyebrow">Shared contract</div>
            <h2>@${escapeHtml(profile?.username ?? 'local_dev')}</h2>
            <p>${escapeHtml(profile?.bio ?? 'Use this shell to validate the restart-era profile and situationship slice.')}</p>
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
                : state.activePanel === 'roadmap'
                  ? renderRoadmapPanel()
                  : renderSituationshipPanel()}
          </div>
          <aside class="workspace__side">
            ${renderSituationshipEditor()}
          </aside>
        </section>
      </main>
    `;
  }

  function render() {
    root.innerHTML = `
      <div class="app-frame">
        ${state.isLoading ? '<div class="loading-bar"></div>' : ''}
        ${state.token ? renderAuthenticated() : `${renderNotice()}${renderOnboarding()}`}
      </div>
    `;
  }

  async function handleClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) {
      return;
    }

    if (action === 'local-sign-in') {
      await handleDevelopmentSignIn();
      return;
    }

    if (action === 'dismiss-notice') {
      state.notice = null;
      render();
      return;
    }

    if (action === 'set-panel') {
      state.activePanel = event.target.closest('[data-panel]')?.dataset.panel ?? 'situationships';
      if (state.activePanel === 'voting') {
        await handleLoadVotingPanel();
        return;
      }
      render();
      return;
    }

    if (action === 'sign-out') {
      setToken(null);
      state.me = null;
      state.situationships = [];
      resetVotingState();
      resetEditor();
      state.notice = { type: 'success', message: 'Local session cleared.' };
      render();
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

    if (action === 'load-voting-results' && id) {
      await handleSelectVotingSession(id);
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

    if (event.target.id === 'public-session-form') {
      await handleLoadPublicVotingSession(event.target);
      return;
    }

    if (event.target.id === 'public-vote-form') {
      await handleSubmitPublicVote(event.target);
    }
  }

  let mounted = false;

  function mount() {
    if (!mounted) {
      root.addEventListener('click', handleClick);
      root.addEventListener('submit', handleSubmit);
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
    handleDevelopmentSignIn,
    handleProfileSave,
    handleSituationshipSave,
    handleDeleteSituationship,
    handleReorder,
    handleCreateVotingSession,
    handleLoadVotingPanel,
    handleSelectVotingSession,
    handleLoadPublicVotingSession,
    handleSubmitPublicVote,
    setToken,
    resetEditor,
    resetVotingState,
  };
}
