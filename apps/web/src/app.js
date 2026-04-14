import { api } from './api.js';

const SESSION_KEY = 'hinto_web_access_token';

const state = {
  activePanel: 'situationships',
  editorMode: 'create',
  editingId: null,
  isLoading: false,
  me: null,
  notice: null,
  situationships: [],
  token: localStorage.getItem(SESSION_KEY),
};

const root = document.querySelector('#app');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setToken(token) {
  state.token = token;
  if (token) {
    localStorage.setItem(SESSION_KEY, token);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function resetEditor() {
  state.editorMode = 'create';
  state.editingId = null;
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
    render();
    return;
  }

  state.isLoading = true;
  render();

  try {
    const [meResponse, situationshipResponse] = await Promise.all([
      api.getMe(state.token),
      api.getSituationships(state.token),
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
    const response = await api.createDevelopmentSession({
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

  const formData = new FormData(form);
  const payload = {
    username: formData.get('username')?.toString().trim() || undefined,
    displayName: formData.get('displayName')?.toString().trim() || undefined,
    bio: formData.get('bio')?.toString().trim() || null,
    privacy: formData.get('privacy')?.toString() || undefined,
  };

  try {
    const response = await api.updateMe(state.token, payload);
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

  const formData = new FormData(form);
  const payload = {
    name: formData.get('name')?.toString().trim() || '',
    emoji: formData.get('emoji')?.toString().trim() || null,
    category: formData.get('category')?.toString().trim() || null,
    description: formData.get('description')?.toString().trim() || null,
  };

  try {
    if (state.editorMode === 'edit' && state.editingId) {
      const response = await api.updateSituationship(state.token, state.editingId, payload);
      state.situationships = state.situationships.map((item) =>
        item.situationshipId === state.editingId ? response.data.situationship : item,
      );
      state.notice = { type: 'success', message: 'Situationship updated.' };
    } else {
      const response = await api.createSituationship(state.token, payload);
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
    await api.deleteSituationship(state.token, id);
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
    const response = await api.reorderSituationships(
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
          <p>Voting and AI are surfaced as staged shells until their backend routes land.</p>
        </article>
      </section>
    </main>
  `;
}

function renderProfilePanel() {
  const profile = state.me?.profile;
  const auth = state.me?.auth;

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
          <h3>${escapeHtml((auth?.linkedProviders ?? ['development']).join(', '))}</h3>
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
          <h3>UI staged</h3>
          <p>Swift and web now expose the owner-facing foundation needed before session creation and vote submission routes land.</p>
        </article>
        <article class="meta-card">
          <div class="eyebrow">Results</div>
          <h3>Backend pending</h3>
          <p>Result aggregation is still a backlog item, so the web shell keeps this honest instead of mocking a shared contract that does not exist yet.</p>
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

root.addEventListener('click', async (event) => {
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
    render();
    return;
  }

  if (action === 'sign-out') {
    setToken(null);
    state.me = null;
    state.situationships = [];
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

  if ((action === 'move-up' || action === 'move-down') && id) {
    await handleReorder(id, action === 'move-up' ? 'up' : 'down');
  }
});

root.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (event.target instanceof HTMLFormElement === false) {
    return;
  }

  if (event.target.id === 'profile-form') {
    await handleProfileSave(event.target);
    return;
  }

  if (event.target.id === 'situationship-form') {
    await handleSituationshipSave(event.target);
  }
});

render();
bootstrapSession();
