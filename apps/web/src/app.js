/*
 * HINTO web app (owner experience).
 *
 * Plain ES modules, no bundler. Routing:
 *   /vote/:code  -> public voting page (see vote-page.js, no sign-in)
 *   everything else -> the signed-in app (email code sign-in, age check,
 *                      ranked list, votes, coach, settings)
 */

import { api, ApiError, session } from './api.js';
import { mountVotePage } from './vote-page.js';
import {
  copyToClipboard,
  escapeHtml,
  formatDateTime,
  formatRelativeExpiry,
  readLocal,
  renderBrand,
  renderFooter,
  renderNotice,
  writeLocal,
} from './ui.js';

const VOTING_SESSION_KEY = 'hinto_web_voting_session';
const MIN_AGE = 16;
const CATEGORIES = ['Crush', 'Talking stage', 'Dating', 'Ex', 'Friend', 'Other'];
const REPORT_REASONS = [
  ['harassment', 'Harassment or bullying'],
  ['hate', 'Hate or discrimination'],
  ['sexual', 'Sexual content'],
  ['underage', 'Someone under 16'],
  ['impersonation', 'Impersonation'],
  ['spam', 'Spam'],
  ['other', 'Something else'],
];

const root = document.querySelector('#app');

// ── Routing ────────────────────────────────────────────────────

const voteMatch = window.location.pathname.match(/^\/vote(?:\/([A-Za-z0-9]*))?\/?$/);
if (voteMatch) {
  mountVotePage(root, voteMatch[1] ?? '');
} else {
  mountApp();
}

// ── Owner app ──────────────────────────────────────────────────

function mountApp() {
  const state = {
    view: 'list',
    isLoading: false,
    notice: null,
    connectionError: false,
    bootstrapped: false,
    me: null,
    situationships: [],
    auth: { step: 'email', email: '', busy: false },
    editor: { mode: 'create', editingId: null },
    voting: {
      session: null,
      results: null,
      loading: false,
      copied: false,
    },
    coach: {
      loaded: false,
      loading: false,
      conversations: [],
      usage: null,
      activeId: null,
      messages: [],
      sending: false,
      draft: '',
    },
    settings: {
      blocks: [],
      blocksLoaded: false,
      report: null, // { contentType, contentId, reportedProfileId, description }
      reportSent: false,
      confirmDelete: false,
    },
  };

  const isLocal = Boolean(window.HINTO_IS_LOCAL);
  const appleEnabled = window.HINTO_APPLE_WEB_ENABLED === true;

  function setNotice(type, message, extra = {}) {
    state.notice = { type, message, ...extra };
  }

  function errorNotice(error, fallback) {
    if (error instanceof ApiError && error.isNetworkError) {
      setNotice('error', error.message);
      return;
    }
    setNotice('error', error?.message ?? fallback);
  }

  function resetForSignedOut() {
    state.me = null;
    state.situationships = [];
    state.bootstrapped = false;
    state.connectionError = false;
    state.view = 'list';
    state.editor = { mode: 'create', editingId: null };
    state.voting = { session: null, results: null, loading: false, copied: false };
    state.coach = {
      loaded: false,
      loading: false,
      conversations: [],
      usage: null,
      activeId: null,
      messages: [],
      sending: false,
      draft: '',
    };
    state.settings = {
      blocks: [],
      blocksLoaded: false,
      report: null,
      reportSent: false,
      confirmDelete: false,
    };
    state.auth = { step: 'email', email: state.auth.email ?? '', busy: false };
  }

  session.onLost(() => {
    resetForSignedOut();
    setNotice('error', 'Your session ended. Please sign in again.');
    render();
  });

  // ── Bootstrap ────────────────────────────────────────────────

  async function bootstrap() {
    if (!session.isSignedIn()) {
      render();
      return;
    }

    state.isLoading = true;
    state.connectionError = false;
    render();

    try {
      const [meResponse, listResponse] = await Promise.all([api.getMe(), api.getSituationships()]);
      state.me = meResponse.data;
      state.situationships = listResponse.data.items ?? [];
      state.bootstrapped = true;
      restoreVotingSession();
    } catch (error) {
      if (error instanceof ApiError && error.isNetworkError) {
        state.connectionError = true;
      } else if (session.isSignedIn()) {
        errorNotice(error, "We couldn't load your account.");
      }
    } finally {
      state.isLoading = false;
      render();
    }
  }

  function restoreVotingSession() {
    const stored = readLocal(VOTING_SESSION_KEY, null);
    const myId = state.me?.profile?.profileId;
    if (stored?.session && stored.ownerProfileId === myId) {
      state.voting.session = stored.session;
    } else {
      state.voting.session = null;
    }

    // Prefer the server's view so sessions created on another device show up.
    api
      .listVotingSessions()
      .then(response => {
        const sessions = response?.data?.sessions ?? [];
        const active = sessions.find(session => session.status === 'active') ?? sessions[0] ?? null;
        if (active && active.votingSessionId !== state.voting.session?.votingSessionId) {
          state.voting.session = active;
          state.voting.results = null;
          persistVotingSession();
          render();
        }
      })
      .catch(() => {
        // Keep whatever was restored locally; the results view surfaces errors itself.
      });
  }

  function persistVotingSession() {
    if (state.voting.session && state.me?.profile?.profileId) {
      writeLocal(VOTING_SESSION_KEY, {
        ownerProfileId: state.me.profile.profileId,
        session: state.voting.session,
      });
    } else {
      writeLocal(VOTING_SESSION_KEY, null);
    }
  }

  // ── Auth ─────────────────────────────────────────────────────

  async function handleEmailSubmit(form) {
    const email = new FormData(form).get('email')?.toString().trim().toLowerCase() ?? '';
    if (!email) {
      return;
    }
    state.auth.email = email;
    state.auth.busy = true;
    state.notice = null;
    render();

    try {
      await api.requestEmailCode(email);
      state.auth.step = 'code';
      setNotice('success', `We sent a 6-digit code to ${email}.`);
    } catch (error) {
      errorNotice(error, "We couldn't send the code. Try again in a moment.");
    } finally {
      state.auth.busy = false;
      render();
    }
  }

  async function handleCodeSubmit(form) {
    const token = new FormData(form).get('token')?.toString().replace(/\s+/g, '') ?? '';
    if (!token) {
      return;
    }
    state.auth.busy = true;
    state.notice = null;
    render();

    try {
      const response = await api.verifyEmailCode(state.auth.email, token);
      session.set(response.data);
      state.me = response.data.me;
      state.auth = { step: 'email', email: '', busy: false };
      await bootstrap();
      return;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        setNotice('error', "That code didn't work. Check it and try again, or request a new one.");
      } else {
        errorNotice(error, "We couldn't verify the code.");
      }
    }
    state.auth.busy = false;
    render();
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
      session.set({ accessToken: response.data.accessToken, refreshToken: null, expiresAt: null });
      state.me = response.data.me;
      await bootstrap();
    } catch (error) {
      errorNotice(error, 'Local sign-in failed. Is the API running with API_ENABLE_DEV_AUTH=true?');
      state.isLoading = false;
      render();
    }
  }

  async function handleAppleSignIn() {
    // Sign in with Apple on the web needs an Apple Services ID, a verified
    // domain and return URL in the Apple developer portal, and Apple's JS SDK
    // (appleid.auth.js) initialised with that Services ID. None of that exists
    // yet, so this path only runs when the host page has loaded and configured
    // `window.AppleID`. We do not fake the flow.
    if (!window.AppleID?.auth?.signIn) {
      setNotice(
        'error',
        "Sign in with Apple isn't set up on this site yet. Use your email instead."
      );
      render();
      return;
    }

    state.isLoading = true;
    render();
    try {
      const result = await window.AppleID.auth.signIn();
      const identityToken = result?.authorization?.id_token;
      if (!identityToken) {
        throw new Error('Apple did not return an identity token.');
      }
      const response = await api.signInWithApple({
        identityToken,
        nonce: null,
        fullName: result?.user?.name
          ? {
              givenName: result.user.name.firstName ?? null,
              familyName: result.user.name.lastName ?? null,
            }
          : null,
      });
      session.set(response.data);
      state.me = response.data.me;
      await bootstrap();
    } catch (error) {
      errorNotice(error, 'Apple sign-in was cancelled or failed.');
      state.isLoading = false;
      render();
    }
  }

  function signOut(message = "You're signed out.") {
    session.clear();
    resetForSignedOut();
    setNotice('success', message);
    render();
  }

  // ── Age confirmation ─────────────────────────────────────────

  function needsAge() {
    return (
      Boolean(state.me) && (state.me.profile?.age === null || state.me.profile?.age === undefined)
    );
  }

  async function handleAgeSubmit(form) {
    const age = Number.parseInt(new FormData(form).get('age')?.toString() ?? '', 10);
    if (!Number.isFinite(age)) {
      setNotice('error', 'Enter your age as a number.');
      render();
      return;
    }
    if (age < MIN_AGE) {
      setNotice('error', `HINTO is for people ${MIN_AGE} and older. You can't use it yet.`);
      render();
      return;
    }
    state.isLoading = true;
    render();
    try {
      const response = await api.updateMe({ age });
      state.me = response.data;
      state.notice = null;
    } catch (error) {
      errorNotice(error, "We couldn't save your age.");
    } finally {
      state.isLoading = false;
      render();
    }
  }

  // ── Situationships ───────────────────────────────────────────

  function getEditing() {
    return (
      state.situationships.find(item => item.situationshipId === state.editor.editingId) ?? null
    );
  }

  function resetEditor() {
    state.editor = { mode: 'create', editingId: null };
  }

  function activeSituationships() {
    return state.situationships.filter(item => item.status === 'active');
  }

  async function handleSituationshipSave(form) {
    const formData = new FormData(form);
    const payload = {
      name: formData.get('name')?.toString().trim() || '',
      emoji: formData.get('emoji')?.toString().trim() || '💖',
      category: formData.get('category')?.toString().trim() || 'Other',
      description: formData.get('description')?.toString().trim() || null,
    };
    if (!payload.name) {
      return;
    }

    state.isLoading = true;
    render();
    try {
      if (state.editor.mode === 'edit' && state.editor.editingId) {
        const response = await api.updateSituationship(state.editor.editingId, payload);
        state.situationships = state.situationships.map(item =>
          item.situationshipId === state.editor.editingId ? response.data.situationship : item
        );
        setNotice('success', 'Saved.');
      } else {
        const response = await api.createSituationship(payload);
        state.situationships = [...state.situationships, response.data.situationship].sort(
          (left, right) => left.rank - right.rank
        );
        setNotice('success', `${payload.name} added to your list.`);
      }
      resetEditor();
    } catch (error) {
      errorNotice(error, "We couldn't save that.");
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function handleDeleteSituationship(id) {
    const item = state.situationships.find(entry => entry.situationshipId === id);
    if (!item || !window.confirm(`Remove ${item.name} from your list?`)) {
      return;
    }
    state.isLoading = true;
    render();
    try {
      await api.deleteSituationship(id);
      state.situationships = state.situationships.filter(entry => entry.situationshipId !== id);
      if (state.editor.editingId === id) {
        resetEditor();
      }
      setNotice('success', `${item.name} removed.`);
    } catch (error) {
      errorNotice(error, "We couldn't remove that.");
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function handleReorder(id, direction) {
    const currentIndex = state.situationships.findIndex(item => item.situationshipId === id);
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
      const response = await api.reorderSituationships(reordered.map(item => item.situationshipId));
      state.situationships = response.data.items;
    } catch (error) {
      errorNotice(error, "We couldn't save the new order.");
    } finally {
      render();
    }
  }

  // ── Voting (owner) ───────────────────────────────────────────

  function inviteUrl() {
    const code = state.voting.session?.inviteCode;
    return code ? `${window.location.origin}/vote/${code}` : '';
  }

  async function handleCreateVotingSession(form) {
    const formData = new FormData(form);
    const payload = {
      title: formData.get('title')?.toString().trim() || undefined,
      description: formData.get('description')?.toString().trim() || null,
      anonymityMode:
        formData.get('anonymityMode')?.toString() === 'identified' ? 'identified' : 'anonymous',
      expiresInHours: Number.parseInt(formData.get('expiresInHours')?.toString() ?? '48', 10) || 48,
    };

    state.isLoading = true;
    render();
    try {
      const response = await api.createVotingSession(payload);
      state.voting.session = response.data.session;
      state.voting.results = null;
      state.voting.copied = false;
      persistVotingSession();
      setNotice('success', 'Your vote link is ready. Share it with friends you trust.');
      await loadResults();
      return;
    } catch (error) {
      errorNotice(error, "We couldn't open voting.");
    }
    state.isLoading = false;
    render();
  }

  async function loadResults() {
    const votingSessionId = state.voting.session?.votingSessionId;
    if (!votingSessionId) {
      return;
    }
    state.voting.loading = true;
    render();
    try {
      const response = await api.getVotingResults(votingSessionId);
      state.voting.results = response.data;
      state.voting.session = response.data.session;
      persistVotingSession();
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        state.voting.session = null;
        state.voting.results = null;
        persistVotingSession();
      } else {
        errorNotice(error, "We couldn't load results.");
      }
    } finally {
      state.voting.loading = false;
      state.isLoading = false;
      render();
    }
  }

  async function handleEndVoting() {
    const votingSessionId = state.voting.session?.votingSessionId;
    if (
      !votingSessionId ||
      !window.confirm('End voting now? Friends will no longer be able to vote.')
    ) {
      return;
    }
    state.isLoading = true;
    render();
    try {
      const response = await api.expireVotingSession(votingSessionId);
      state.voting.session = response.data.session;
      persistVotingSession();
      setNotice('success', 'Voting ended. Your results are final.');
      await loadResults();
      return;
    } catch (error) {
      errorNotice(error, "We couldn't end voting.");
    }
    state.isLoading = false;
    render();
  }

  async function handleCopyLink() {
    const ok = await copyToClipboard(inviteUrl());
    state.voting.copied = ok;
    setNotice(
      ok ? 'success' : 'error',
      ok ? 'Link copied.' : 'Copy failed. Select the link and copy it manually.'
    );
    render();
  }

  function startNewSession() {
    state.voting.session = null;
    state.voting.results = null;
    persistVotingSession();
    render();
  }

  // ── Coach ────────────────────────────────────────────────────

  function coachAvailable() {
    return state.me?.capabilities?.canUseAiCoach === true;
  }

  async function loadConversations() {
    if (!coachAvailable() || state.coach.loading) {
      return;
    }
    state.coach.loading = true;
    render();
    try {
      const response = await api.listConversations();
      state.coach.conversations = response.data.conversations ?? [];
      state.coach.usage = response.data.usage ?? null;
      state.coach.loaded = true;
    } catch (error) {
      errorNotice(error, "We couldn't load your conversations.");
    } finally {
      state.coach.loading = false;
      render();
    }
  }

  async function openConversation(conversationId) {
    state.coach.activeId = conversationId;
    state.coach.messages = [];
    state.coach.loading = true;
    render();
    try {
      const response = await api.listMessages(conversationId);
      state.coach.messages = response.data.messages ?? [];
    } catch (error) {
      errorNotice(error, "We couldn't load that conversation.");
      state.coach.activeId = null;
    } finally {
      state.coach.loading = false;
      render();
    }
  }

  async function createConversation() {
    state.coach.loading = true;
    render();
    try {
      const response = await api.createConversation({});
      const conversation = response.data.conversation;
      state.coach.conversations = [conversation, ...state.coach.conversations];
      state.coach.activeId = conversation.conversationId;
      state.coach.messages = [];
    } catch (error) {
      errorNotice(error, "We couldn't start a conversation.");
    } finally {
      state.coach.loading = false;
      render();
      root.querySelector('#coach-form textarea')?.focus();
    }
  }

  async function handleSendMessage(form) {
    const content = new FormData(form).get('content')?.toString().trim() ?? '';
    const conversationId = state.coach.activeId;
    if (!content || !conversationId || state.coach.sending) {
      return;
    }
    state.coach.sending = true;
    state.coach.draft = content;
    render();
    try {
      const response = await api.sendMessage(conversationId, content);
      state.coach.messages = [
        ...state.coach.messages,
        response.data.userMessage,
        response.data.assistantMessage,
      ];
      state.coach.usage = response.data.usage ?? state.coach.usage;
      state.coach.conversations = state.coach.conversations.map(item =>
        item.conversationId === conversationId ? response.data.conversation : item
      );
      state.coach.draft = '';
    } catch (error) {
      errorNotice(error, "The coach couldn't reply. Try again.");
    } finally {
      state.coach.sending = false;
      render();
      const thread = root.querySelector('.chat-thread');
      if (thread) {
        thread.scrollTop = thread.scrollHeight;
      }
    }
  }

  // ── Settings ─────────────────────────────────────────────────

  async function handleProfileSave(form) {
    const formData = new FormData(form);
    const ageRaw = formData.get('age')?.toString().trim();
    const payload = {
      username: formData.get('username')?.toString().trim() || undefined,
      displayName: formData.get('displayName')?.toString().trim() || undefined,
      bio: formData.get('bio')?.toString().trim() || null,
      privacy: formData.get('privacy')?.toString() || undefined,
    };
    if (ageRaw) {
      const age = Number.parseInt(ageRaw, 10);
      if (!Number.isFinite(age) || age < MIN_AGE) {
        setNotice('error', `Age must be ${MIN_AGE} or older.`);
        render();
        return;
      }
      payload.age = age;
    }

    state.isLoading = true;
    render();
    try {
      const response = await api.updateMe(payload);
      state.me = response.data;
      setNotice('success', 'Profile saved.');
    } catch (error) {
      errorNotice(error, "We couldn't save your profile.");
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function loadBlocks() {
    try {
      const response = await api.listBlocks();
      state.settings.blocks = response.data.blocks ?? [];
      state.settings.blocksLoaded = true;
    } catch (error) {
      errorNotice(error, "We couldn't load your blocked list.");
    }
    render();
  }

  async function handleBlockSubmit(form) {
    const blockedProfileId = new FormData(form).get('blockedProfileId')?.toString().trim() ?? '';
    if (!blockedProfileId) {
      return;
    }
    state.isLoading = true;
    render();
    try {
      const response = await api.createBlock({ blockedProfileId });
      state.settings.blocks = [
        response.data.block,
        ...state.settings.blocks.filter(b => b.blockedProfileId !== blockedProfileId),
      ];
      setNotice('success', 'Blocked. They can no longer see or vote on your lists.');
    } catch (error) {
      errorNotice(error, "We couldn't block that account.");
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function handleUnblock(profileId) {
    state.isLoading = true;
    render();
    try {
      await api.deleteBlock(profileId);
      state.settings.blocks = state.settings.blocks.filter(b => b.blockedProfileId !== profileId);
      setNotice('success', 'Unblocked.');
    } catch (error) {
      errorNotice(error, "We couldn't unblock that account.");
    } finally {
      state.isLoading = false;
      render();
    }
  }

  function openReport(prefill = {}) {
    state.settings.report = {
      contentType: prefill.contentType ?? 'profile',
      contentId: prefill.contentId ?? '',
      reportedProfileId: prefill.reportedProfileId ?? null,
      description: prefill.description ?? '',
    };
    state.settings.reportSent = false;
    state.view = 'settings';
    render();
    root.querySelector('#report-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleReportSubmit(form) {
    const formData = new FormData(form);
    const payload = {
      contentType: formData.get('contentType')?.toString() ?? 'profile',
      contentId: formData.get('contentId')?.toString().trim() ?? '',
      reportedProfileId: state.settings.report?.reportedProfileId ?? null,
      reason: formData.get('reason')?.toString() ?? 'other',
      description: formData.get('description')?.toString().trim() || null,
    };
    if (!payload.contentId) {
      setNotice(
        'error',
        'Tell us what you are reporting (the ID is filled in automatically from a comment or profile).'
      );
      render();
      return;
    }
    state.isLoading = true;
    render();
    try {
      await api.createReport(payload);
      state.settings.report = null;
      state.settings.reportSent = true;
      setNotice('success', 'Thanks. Our team will review this report.');
    } catch (error) {
      errorNotice(error, "We couldn't send the report.");
    } finally {
      state.isLoading = false;
      render();
    }
  }

  async function handleDeleteAccount() {
    state.isLoading = true;
    render();
    try {
      await api.deleteMe();
      session.clear();
      writeLocal(VOTING_SESSION_KEY, null);
      resetForSignedOut();
      setNotice('success', 'Your account and data have been deleted.');
    } catch (error) {
      errorNotice(
        error,
        "We couldn't delete your account. Email support@hinto.app and we'll do it for you."
      );
    } finally {
      state.isLoading = false;
      render();
    }
  }

  // ── Views: signed out ────────────────────────────────────────

  function renderSignIn() {
    const busy = state.auth.busy;
    const form =
      state.auth.step === 'code'
        ? `
          <form id="code-form" class="stack-form auth-form">
            <p class="auth-form__lead">Enter the 6-digit code we emailed to <strong>${escapeHtml(state.auth.email)}</strong>.</p>
            <label>
              <span>Code</span>
              <input name="token" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" maxlength="12" required autofocus placeholder="123456" />
            </label>
            <button class="primary-button primary-button--wide" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Checking...' : 'Sign in'}</button>
            <div class="auth-form__links">
              <button class="link-button" data-action="resend-code" type="button" ${busy ? 'disabled' : ''}>Send a new code</button>
              <button class="link-button" data-action="change-email" type="button">Use a different email</button>
            </div>
          </form>
        `
        : `
          <form id="email-form" class="stack-form auth-form">
            <label>
              <span>Email</span>
              <input name="email" type="email" autocomplete="email" required autofocus placeholder="you@example.com" value="${escapeHtml(state.auth.email)}" />
            </label>
            <button class="primary-button primary-button--wide" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Sending...' : 'Continue with email'}</button>
            <p class="fine-print">No password. We'll email you a one-time code.</p>
          </form>
          ${
            appleEnabled
              ? `<button class="secondary-button primary-button--wide" data-action="apple-sign-in" type="button"> Sign in with Apple</button>`
              : ''
          }
          ${
            isLocal
              ? `<button class="ghost-button primary-button--wide" data-action="local-sign-in" type="button">Use Local API (dev only)</button>`
              : ''
          }
        `;

    return `
      <main class="shell shell--welcome">
        <header class="vote-header">${renderBrand()}</header>
        ${renderNotice(state.notice)}
        <section class="welcome-grid">
          <div class="hero-card">
            <div class="eyebrow">Private. Honest. Yours.</div>
            <h1>Your list. Their honest take.</h1>
            <p>
              Rank the people you're seeing, share a private link with the friends you trust,
              and get a clear read on what to do next. Nothing is public.
            </p>
            <ul class="hero-points">
              <li>Keep a ranked list only you can see.</li>
              <li>Let close friends vote and leave one honest line.</li>
              <li>Talk it through with a coach that stays on your side.</li>
            </ul>
            <p class="fine-print">For ages ${MIN_AGE}+. By continuing you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</p>
          </div>
          <div class="panel auth-panel">
            <div class="panel-header">
              <div>
                <div class="eyebrow">Sign in</div>
                <h2>${state.auth.step === 'code' ? 'Check your email' : 'Welcome back'}</h2>
              </div>
            </div>
            ${form}
          </div>
        </section>
      </main>
      ${renderFooter()}
    `;
  }

  function renderAgeGate() {
    return `
      <main class="shell shell--narrow">
        <header class="vote-header">${renderBrand()}<button class="ghost-button" data-action="sign-out" type="button">Sign out</button></header>
        ${renderNotice(state.notice)}
        <section class="panel auth-panel">
          <div class="panel-header">
            <div>
              <div class="eyebrow">One quick thing</div>
              <h2>How old are you?</h2>
            </div>
          </div>
          <p>HINTO is for people ${MIN_AGE} and older. We ask once and never show your age to anyone.</p>
          <form id="age-form" class="stack-form auth-form">
            <label>
              <span>Your age</span>
              <input name="age" type="number" inputmode="numeric" min="${MIN_AGE}" max="120" required autofocus placeholder="${MIN_AGE}" />
            </label>
            <button class="primary-button primary-button--wide" type="submit">Continue</button>
          </form>
        </section>
      </main>
      ${renderFooter()}
    `;
  }

  function renderConnectionBanner() {
    if (!state.connectionError) {
      return '';
    }
    return `
      <section class="notice notice--error" role="alert">
        <span>We can't reach HINTO right now. You're still signed in.</span>
        <span class="notice__actions">
          <button class="secondary-button" data-action="retry-bootstrap" type="button">Retry</button>
        </span>
      </section>
    `;
  }

  // ── Views: list ──────────────────────────────────────────────

  function renderEditor() {
    const editing = getEditing();
    const isEdit = state.editor.mode === 'edit';
    return `
      <section class="panel panel--editor">
        <div class="panel-header">
          <div>
            <div class="eyebrow">${isEdit ? 'Edit' : 'Add someone'}</div>
            <h2>${isEdit ? escapeHtml(editing?.name ?? 'Edit') : 'Who are you thinking about?'}</h2>
          </div>
          ${isEdit ? '<button class="ghost-button" data-action="cancel-editor" type="button">Cancel</button>' : ''}
        </div>
        <form id="situationship-form" class="stack-form">
          <label>
            <span>Name or nickname</span>
            <input name="name" required maxlength="80" value="${escapeHtml(editing?.name ?? '')}" placeholder="Gym guy, Jordan, the barista..." />
          </label>
          <div class="form-row">
            <label>
              <span>Emoji</span>
              <input name="emoji" maxlength="4" value="${escapeHtml(editing?.emoji ?? '💖')}" />
            </label>
            <label>
              <span>Where it's at</span>
              <select name="category">
                ${CATEGORIES.map(
                  value =>
                    `<option value="${value}" ${(editing?.category ?? 'Crush') === value ? 'selected' : ''}>${value}</option>`
                ).join('')}
              </select>
            </label>
          </div>
          <label>
            <span>Notes <em>(friends see this when they vote)</em></span>
            <textarea name="description" rows="3" maxlength="500" placeholder="The short version. What's good, what's off.">${escapeHtml(editing?.description ?? '')}</textarea>
          </label>
          <button class="primary-button" type="submit">${isEdit ? 'Save changes' : 'Add to my list'}</button>
        </form>
      </section>
    `;
  }

  function renderListView() {
    const items = state.situationships;
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <div class="eyebrow">My list</div>
            <h2>Ranked by you</h2>
          </div>
          <div class="panel-header__actions">
            ${
              activeSituationships().length >= 2
                ? '<button class="primary-button" data-action="go-share" type="button">Share for votes</button>'
                : ''
            }
            <button class="secondary-button" data-action="new-situationship" type="button">Add</button>
          </div>
        </div>

        ${
          items.length === 0
            ? `
            <article class="empty-card">
              <h3>Your list is empty.</h3>
              <p>Add the people you're weighing up. Only you can see this until you choose to share a vote link.</p>
            </article>
          `
            : `<div class="list-stack">${items
                .map(
                  (item, index) => `
                  <article class="list-card ${item.status === 'archived' ? 'list-card--archived' : ''}">
                    <div class="list-card__rank">${index + 1}</div>
                    <div class="list-card__body">
                      <div class="list-card__title-row">
                        <h3>${escapeHtml(item.emoji ?? '💖')} ${escapeHtml(item.name)}</h3>
                        <span class="pill">${escapeHtml(item.category ?? 'Other')}</span>
                      </div>
                      <p>${escapeHtml(item.description ?? 'No notes yet.')}</p>
                    </div>
                    <div class="list-card__actions">
                      <button class="ghost-button" data-action="move-up" data-id="${escapeHtml(item.situationshipId)}" type="button" ${index === 0 ? 'disabled' : ''} aria-label="Move up">Up</button>
                      <button class="ghost-button" data-action="move-down" data-id="${escapeHtml(item.situationshipId)}" type="button" ${index === items.length - 1 ? 'disabled' : ''} aria-label="Move down">Down</button>
                      <button class="ghost-button" data-action="edit-situationship" data-id="${escapeHtml(item.situationshipId)}" type="button">Edit</button>
                      <button class="ghost-button ghost-button--danger" data-action="delete-situationship" data-id="${escapeHtml(item.situationshipId)}" type="button">Remove</button>
                    </div>
                  </article>
                `
                )
                .join('')}</div>`
        }
      </section>
    `;
  }

  // ── Views: votes ─────────────────────────────────────────────

  function renderShareForm() {
    const active = activeSituationships().length;
    if (active < 2) {
      return `
        <section class="panel">
          <div class="panel-header">
            <div>
              <div class="eyebrow">Votes</div>
              <h2>Share for votes</h2>
            </div>
          </div>
          <article class="empty-card">
            <h3>Add at least two people first.</h3>
            <p>Friends vote for a best fit and a not-the-one, so your list needs two or more entries.</p>
            <button class="secondary-button" data-action="set-view" data-view="list" type="button">Back to my list</button>
          </article>
        </section>
      `;
    }

    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Votes</div>
            <h2>Share for votes</h2>
          </div>
        </div>
        <p>You'll get a private link. Anyone with it can vote once, without an account. You choose whether votes show names.</p>
        <form id="share-form" class="stack-form">
          <label>
            <span>Title</span>
            <input name="title" maxlength="80" value="Rate my situationships" />
          </label>
          <label>
            <span>A note for your friends <em>(optional)</em></span>
            <textarea name="description" rows="2" maxlength="280" placeholder="Be honest, I can take it."></textarea>
          </label>
          <div class="form-row">
            <label>
              <span>Votes are</span>
              <select name="anonymityMode">
                <option value="anonymous" selected>Anonymous</option>
                <option value="identified">Show names</option>
              </select>
            </label>
            <label>
              <span>Open for</span>
              <select name="expiresInHours">
                <option value="24">24 hours</option>
                <option value="48" selected>2 days</option>
                <option value="72">3 days</option>
                <option value="168">1 week</option>
              </select>
            </label>
          </div>
          <button class="primary-button" type="submit">Create vote link</button>
          <p class="fine-print">${active} people on your list will be included.</p>
        </form>
      </section>
    `;
  }

  function renderResults() {
    const votingSession = state.voting.session;
    const results = state.voting.results;
    const status = votingSession?.status ?? 'active';
    const isActive = status === 'active';
    const link = inviteUrl();

    const resultRows = results?.results ?? [];
    const maxVotes = Math.max(1, ...resultRows.map(row => row.totalVotes));

    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <div class="eyebrow">${isActive ? 'Voting open' : status === 'closed' ? 'Voting ended' : 'Voting expired'}</div>
            <h2>${escapeHtml(votingSession?.title ?? 'Results')}</h2>
          </div>
          <div class="panel-header__actions">
            <button class="ghost-button" data-action="refresh-results" type="button" ${state.voting.loading ? 'disabled' : ''}>Refresh</button>
            ${
              isActive
                ? '<button class="ghost-button ghost-button--danger" data-action="end-voting" type="button">End voting</button>'
                : '<button class="secondary-button" data-action="start-new-session" type="button">Start a new vote</button>'
            }
          </div>
        </div>

        ${
          isActive
            ? `
            <div class="share-box">
              <span class="stat-label">Your private link</span>
              <div class="share-box__row">
                <input class="share-box__input" readonly value="${escapeHtml(link)}" onfocus="this.select()" />
                <button class="primary-button" data-action="copy-link" type="button">${state.voting.copied ? 'Copied' : 'Copy'}</button>
              </div>
              <span class="fine-print">${escapeHtml(formatRelativeExpiry(votingSession?.expiresAt))} · ${votingSession?.anonymityMode === 'identified' ? 'names shown' : 'anonymous'}</span>
            </div>
          `
            : ''
        }

        <div class="stats-row">
          <article class="stat-card"><span class="stat-label">Friends voted</span><strong>${results?.totalVoters ?? 0}</strong></article>
          <article class="stat-card"><span class="stat-label">Votes</span><strong>${results?.totalVotes ?? 0}</strong></article>
          <article class="stat-card"><span class="stat-label">Comments</span><strong>${results?.comments?.length ?? 0}</strong></article>
        </div>

        ${
          resultRows.length === 0
            ? `<article class="empty-card"><h3>No votes yet.</h3><p>Share the link and check back. Results update when you refresh.</p></article>`
            : `<div class="list-stack">${resultRows
                .map(
                  row => `
                  <article class="result-card">
                    <div class="list-card__rank">${row.rank}</div>
                    <div class="result-card__body">
                      <div class="list-card__title-row">
                        <h3>${escapeHtml(row.emoji ?? '💖')} ${escapeHtml(row.name)}</h3>
                        <span class="pill ${row.score > 0 ? 'pill--good' : row.score < 0 ? 'pill--bad' : ''}">${row.score > 0 ? '+' : ''}${row.score}</span>
                      </div>
                      <div class="result-bars">
                        <div class="result-bar result-bar--best" style="width:${Math.round((row.bestVotes / maxVotes) * 100)}%"></div>
                        <div class="result-bar result-bar--worst" style="width:${Math.round((row.worstVotes / maxVotes) * 100)}%"></div>
                      </div>
                      <p class="result-card__counts">${row.bestVotes} best fit · ${row.worstVotes} not the one</p>
                    </div>
                  </article>
                `
                )
                .join('')}</div>`
        }

        ${
          results?.comments?.length
            ? `
            <h3 class="section-title">What they said</h3>
            <div class="comment-stack">
              ${results.comments
                .map((comment, index) => {
                  const target = resultRows.find(
                    row => row.situationshipId === comment.situationshipId
                  );
                  return `
                    <article class="comment-card">
                      <div class="comment-card__meta">
                        <strong>${escapeHtml(comment.voterLabel ?? 'Anonymous')}</strong>
                        <span>on ${escapeHtml(target?.name ?? 'someone')} · ${comment.voteType === 'best_fit' ? 'best fit' : 'not the one'} · ${escapeHtml(formatDateTime(comment.createdAt))}</span>
                      </div>
                      <p>${escapeHtml(comment.comment)}</p>
                      <button class="link-button" data-action="report-comment" data-index="${index}" type="button">Report</button>
                    </article>
                  `;
                })
                .join('')}
            </div>
          `
            : ''
        }
      </section>
    `;
  }

  function renderVotesView() {
    return state.voting.session ? renderResults() : renderShareForm();
  }

  // ── Views: coach ─────────────────────────────────────────────

  function renderCoachView() {
    if (!coachAvailable()) {
      return `
        <section class="panel">
          <div class="panel-header">
            <div>
              <div class="eyebrow">Coach</div>
              <h2>Not available yet</h2>
            </div>
          </div>
          <article class="empty-card">
            <h3>The coach isn't available on your account right now.</h3>
            <p>Your list and votes still work. If you think this is a mistake, email <a href="mailto:support@hinto.app">support@hinto.app</a>.</p>
          </article>
        </section>
      `;
    }

    const coach = state.coach;
    const usage = coach.usage;
    const remaining = usage ? usage.remaining : null;
    const outOfMessages = remaining !== null && remaining <= 0;
    const active = coach.conversations.find(item => item.conversationId === coach.activeId) ?? null;

    if (!coach.activeId) {
      return `
        <section class="panel">
          <div class="panel-header">
            <div>
              <div class="eyebrow">Coach</div>
              <h2>Talk it through</h2>
            </div>
            <button class="primary-button" data-action="new-conversation" type="button" ${coach.loading ? 'disabled' : ''}>New conversation</button>
          </div>
          <p>A calm second opinion that knows your list. Not therapy, not a replacement for a real friend.</p>
          ${usage ? `<p class="fine-print">${remaining} of ${usage.limit} messages left today.</p>` : ''}
          ${
            coach.conversations.length === 0
              ? `<article class="empty-card"><h3>No conversations yet.</h3><p>Start one and ask anything. "Should I text him back?" is a perfectly good opener.</p></article>`
              : `<div class="list-stack">${coach.conversations
                  .map(
                    item => `
                    <button class="conversation-card" data-action="open-conversation" data-id="${escapeHtml(item.conversationId)}" type="button">
                      <strong>${escapeHtml(item.title ?? 'Untitled conversation')}</strong>
                      <span>${escapeHtml(formatDateTime(item.updatedAt))}</span>
                    </button>
                  `
                  )
                  .join('')}</div>`
          }
        </section>
      `;
    }

    return `
      <section class="panel panel--chat">
        <div class="panel-header">
          <div>
            <button class="link-button" data-action="back-to-conversations" type="button">&larr; All conversations</button>
            <h2>${escapeHtml(active?.title ?? 'Conversation')}</h2>
          </div>
          ${usage ? `<span class="pill">${remaining} left today</span>` : ''}
        </div>
        <div class="chat-thread">
          ${
            coach.messages.length === 0 && !coach.loading
              ? '<p class="chat-empty">Say what\'s on your mind. The coach has your list for context.</p>'
              : coach.messages
                  .map(
                    message => `
                    <div class="chat-bubble chat-bubble--${message.role === 'user' ? 'user' : 'assistant'}">
                      <p>${escapeHtml(message.content)}</p>
                      ${message.moderationFlagged ? '<span class="fine-print">Adjusted for safety</span>' : ''}
                    </div>
                  `
                  )
                  .join('')
          }
          ${coach.sending ? '<div class="chat-bubble chat-bubble--assistant chat-bubble--pending"><p>Thinking...</p></div>' : ''}
        </div>
        <form id="coach-form" class="chat-form">
          <textarea name="content" rows="2" maxlength="2000" required placeholder="${outOfMessages ? "You've used today's messages. Come back tomorrow." : 'Type a message'}" ${outOfMessages || coach.sending ? 'disabled' : ''}>${escapeHtml(coach.draft)}</textarea>
          <button class="primary-button" type="submit" ${outOfMessages || coach.sending ? 'disabled' : ''}>Send</button>
        </form>
        <p class="fine-print">If you're in danger or thinking about hurting yourself, contact local emergency services or a crisis line now.</p>
      </section>
    `;
  }

  // ── Views: settings ──────────────────────────────────────────

  function renderSettingsView() {
    const profile = state.me?.profile;
    const report = state.settings.report;
    const blocks = state.settings.blocks;

    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Profile</div>
            <h2>About you</h2>
          </div>
        </div>
        <form id="profile-form" class="stack-form">
          <div class="form-row">
            <label>
              <span>Username</span>
              <input name="username" required maxlength="30" value="${escapeHtml(profile?.username ?? '')}" />
            </label>
            <label>
              <span>Display name</span>
              <input name="displayName" maxlength="60" value="${escapeHtml(profile?.displayName ?? '')}" />
            </label>
          </div>
          <label>
            <span>Bio</span>
            <textarea name="bio" rows="3" maxlength="280">${escapeHtml(profile?.bio ?? '')}</textarea>
          </label>
          <div class="form-row">
            <label>
              <span>Age</span>
              <input name="age" type="number" min="${MIN_AGE}" max="120" inputmode="numeric" value="${escapeHtml(profile?.age ?? '')}" />
            </label>
            <label>
              <span>Who can see your profile</span>
              <select name="privacy">
                <option value="private" ${profile?.privacy === 'private' ? 'selected' : ''}>Only me</option>
                <option value="mutuals_only" ${profile?.privacy === 'mutuals_only' ? 'selected' : ''}>Mutual friends</option>
                <option value="public" ${profile?.privacy === 'public' ? 'selected' : ''}>Anyone with the link</option>
              </select>
            </label>
          </div>
          <button class="primary-button" type="submit">Save</button>
          <p class="fine-print">Signed in with ${escapeHtml(state.me?.auth?.primaryProvider ?? 'email')}${profile?.email ? ` as ${escapeHtml(profile.email)}` : ''}.</p>
        </form>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Safety</div>
            <h2>Blocked</h2>
          </div>
        </div>
        <p>Blocked accounts can't see your lists or vote on them.</p>
        ${
          blocks.length === 0
            ? `<p class="fine-print">${state.settings.blocksLoaded ? "You haven't blocked anyone." : 'Loading...'}</p>`
            : `<div class="list-stack">${blocks
                .map(
                  block => `
                  <div class="row-card">
                    <div>
                      <strong><code>${escapeHtml(block.blockedProfileId)}</code></strong>
                      <span class="fine-print">${escapeHtml(block.reason ?? '')} ${escapeHtml(formatDateTime(block.createdAt))}</span>
                    </div>
                    <button class="ghost-button" data-action="unblock" data-id="${escapeHtml(block.blockedProfileId)}" type="button">Unblock</button>
                  </div>
                `
                )
                .join('')}</div>`
        }
        <form id="block-form" class="stack-form stack-form--inline">
          <label>
            <span>Block by profile ID</span>
            <input name="blockedProfileId" placeholder="Paste a profile ID" required />
          </label>
          <button class="secondary-button" type="submit">Block</button>
        </form>
      </section>

      <section class="panel" id="report-section">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Safety</div>
            <h2>Report something</h2>
          </div>
          ${report ? '<button class="ghost-button" data-action="close-report" type="button">Cancel</button>' : ''}
        </div>
        ${
          report
            ? `
            <form id="report-form" class="stack-form">
              <div class="form-row">
                <label>
                  <span>What is it?</span>
                  <select name="contentType">
                    ${['profile', 'situationship', 'vote', 'message']
                      .map(
                        value =>
                          `<option value="${value}" ${report.contentType === value ? 'selected' : ''}>${value === 'vote' ? 'Vote or comment' : value === 'message' ? 'Coach message' : value[0].toUpperCase() + value.slice(1)}</option>`
                      )
                      .join('')}
                  </select>
                </label>
                <label>
                  <span>ID</span>
                  <input name="contentId" required value="${escapeHtml(report.contentId)}" placeholder="Filled in automatically from a comment" />
                </label>
              </div>
              <label>
                <span>Reason</span>
                <select name="reason" required>
                  ${REPORT_REASONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
                </select>
              </label>
              <label>
                <span>What happened? <em>(optional)</em></span>
                <textarea name="description" rows="3" maxlength="1000">${escapeHtml(report.description)}</textarea>
              </label>
              <button class="primary-button" type="submit">Send report</button>
            </form>
          `
            : `
            <p>See a comment or profile that crosses a line? Report it and we'll review it.${state.settings.reportSent ? ' Thanks for your last report.' : ''}</p>
            <button class="secondary-button" data-action="open-report" type="button">Report a profile</button>
            <p class="fine-print">To report a vote comment, use the Report link under that comment in your results.</p>
          `
        }
      </section>

      <section class="panel panel--danger">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Account</div>
            <h2>Delete account</h2>
          </div>
        </div>
        <p>This permanently deletes your profile, your list, vote sessions, votes and coach conversations. It can't be undone.</p>
        ${
          state.settings.confirmDelete
            ? `
            <div class="danger-confirm">
              <p><strong>Are you sure?</strong> Everything goes, right now.</p>
              <div class="hero-actions">
                <button class="ghost-button ghost-button--danger" data-action="delete-account" type="button">Yes, delete everything</button>
                <button class="secondary-button" data-action="cancel-delete-account" type="button">Keep my account</button>
              </div>
            </div>
          `
            : '<button class="ghost-button ghost-button--danger" data-action="confirm-delete-account" type="button">Delete my account</button>'
        }
        <p class="fine-print">Prefer email? Write to <a href="mailto:support@hinto.app">support@hinto.app</a> from your sign-in address. See <a href="/data-deletion">how data deletion works</a>.</p>
      </section>
    `;
  }

  // ── Shell ────────────────────────────────────────────────────

  function renderNav() {
    const tabs = [
      ['list', 'My list'],
      ['votes', 'Votes'],
      ['coach', 'Coach'],
      ['settings', 'Settings'],
    ];
    return `
      <nav class="tabs" aria-label="Sections">
        ${tabs
          .map(
            ([key, label]) =>
              `<button class="tab ${state.view === key ? 'tab--active' : ''}" data-action="set-view" data-view="${key}" type="button" ${state.view === key ? 'aria-current="page"' : ''}>${label}</button>`
          )
          .join('')}
      </nav>
    `;
  }

  function renderApp() {
    const profile = state.me?.profile;
    let main;
    switch (state.view) {
      case 'votes':
        main = renderVotesView();
        break;
      case 'coach':
        main = renderCoachView();
        break;
      case 'settings':
        main = renderSettingsView();
        break;
      default:
        main = renderListView();
    }

    const showEditor = state.view === 'list';

    return `
      <main class="shell">
        <header class="topbar">
          <div class="topbar__brand">
            ${renderBrand()}
            <span class="topbar__user">${escapeHtml(profile?.displayName || profile?.username || '')}</span>
          </div>
          ${renderNav()}
          <button class="ghost-button" data-action="sign-out" type="button">Sign out</button>
        </header>

        ${renderConnectionBanner()}
        ${renderNotice(state.notice)}

        <section class="workspace ${showEditor ? '' : 'workspace--single'}">
          <div class="workspace__main">${main}</div>
          ${showEditor ? `<aside class="workspace__side">${renderEditor()}</aside>` : ''}
        </section>
      </main>
      ${renderFooter()}
    `;
  }

  function render() {
    let body;
    if (!session.isSignedIn()) {
      body = renderSignIn();
    } else if (!state.me) {
      body = state.connectionError
        ? `<main class="shell shell--narrow"><header class="vote-header">${renderBrand()}</header>${renderConnectionBanner()}${renderNotice(state.notice)}</main>${renderFooter()}`
        : `<main class="shell shell--narrow"><header class="vote-header">${renderBrand()}</header>${renderNotice(state.notice)}<section class="hero-card hero-card--centered"><div class="eyebrow">One sec</div><h1>Loading your list...</h1></section></main>`;
    } else if (needsAge()) {
      body = renderAgeGate();
    } else {
      body = renderApp();
    }

    root.innerHTML = `
      <div class="app-frame">
        ${state.isLoading ? '<div class="loading-bar"></div>' : ''}
        ${body}
      </div>
    `;
  }

  // ── Events ───────────────────────────────────────────────────

  function setView(view) {
    state.view = view;
    state.notice = null;
    render();
    if (view === 'votes' && state.voting.session && !state.voting.results) {
      loadResults();
    }
    if (view === 'coach' && coachAvailable() && !state.coach.loaded) {
      loadConversations();
    }
    if (view === 'settings' && !state.settings.blocksLoaded) {
      loadBlocks();
    }
  }

  root.addEventListener('click', async event => {
    const trigger = event.target.closest('[data-action]');
    const action = trigger?.dataset.action;
    if (!action) {
      return;
    }
    const id = trigger.dataset.id ?? null;

    switch (action) {
      case 'dismiss-notice':
        state.notice = null;
        render();
        return;
      case 'retry-bootstrap':
        await bootstrap();
        return;
      case 'local-sign-in':
        await handleDevelopmentSignIn();
        return;
      case 'apple-sign-in':
        await handleAppleSignIn();
        return;
      case 'change-email':
        state.auth.step = 'email';
        state.notice = null;
        render();
        return;
      case 'resend-code': {
        const form = document.createElement('form');
        const input = document.createElement('input');
        input.name = 'email';
        input.value = state.auth.email;
        form.append(input);
        await handleEmailSubmit(form);
        return;
      }
      case 'sign-out':
        signOut();
        return;
      case 'set-view':
        setView(trigger.dataset.view ?? 'list');
        return;
      case 'go-share':
        setView('votes');
        return;

      // list
      case 'new-situationship':
        resetEditor();
        render();
        root.querySelector('#situationship-form input[name="name"]')?.focus();
        return;
      case 'cancel-editor':
        resetEditor();
        render();
        return;
      case 'edit-situationship':
        if (id) {
          state.editor = { mode: 'edit', editingId: id };
          render();
        }
        return;
      case 'delete-situationship':
        if (id) await handleDeleteSituationship(id);
        return;
      case 'move-up':
      case 'move-down':
        if (id) await handleReorder(id, action === 'move-up' ? 'up' : 'down');
        return;

      // votes
      case 'copy-link':
        await handleCopyLink();
        return;
      case 'refresh-results':
        await loadResults();
        return;
      case 'end-voting':
        await handleEndVoting();
        return;
      case 'start-new-session':
        startNewSession();
        return;
      case 'report-comment': {
        const index = Number.parseInt(trigger.dataset.index ?? '', 10);
        const comment = state.voting.results?.comments?.[index];
        const target = state.voting.results?.results?.find(
          row => row.situationshipId === comment?.situationshipId
        );
        if (comment) {
          // Report the exact vote row when the API provides its id; fall back to
          // the session id and quote the comment so moderators can find it.
          openReport({
            contentType: 'vote',
            contentId: comment.voteId ?? state.voting.session?.votingSessionId ?? '',
            reportedProfileId: null,
            description: `Comment on "${target?.name ?? 'unknown'}" at ${comment.createdAt} by ${comment.voterLabel ?? 'anonymous'}: "${comment.comment}"`,
          });
        }
        return;
      }

      // coach
      case 'new-conversation':
        await createConversation();
        return;
      case 'open-conversation':
        if (id) await openConversation(id);
        return;
      case 'back-to-conversations':
        state.coach.activeId = null;
        state.coach.messages = [];
        render();
        return;

      // settings
      case 'unblock':
        if (id) await handleUnblock(id);
        return;
      case 'open-report':
        openReport({ contentType: 'profile' });
        return;
      case 'close-report':
        state.settings.report = null;
        render();
        return;
      case 'confirm-delete-account':
        state.settings.confirmDelete = true;
        render();
        return;
      case 'cancel-delete-account':
        state.settings.confirmDelete = false;
        render();
        return;
      case 'delete-account':
        await handleDeleteAccount();
        return;
      default:
        return;
    }
  });

  root.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    switch (form.id) {
      case 'email-form':
        await handleEmailSubmit(form);
        break;
      case 'code-form':
        await handleCodeSubmit(form);
        break;
      case 'age-form':
        await handleAgeSubmit(form);
        break;
      case 'situationship-form':
        await handleSituationshipSave(form);
        break;
      case 'share-form':
        await handleCreateVotingSession(form);
        break;
      case 'coach-form':
        await handleSendMessage(form);
        break;
      case 'profile-form':
        await handleProfileSave(form);
        break;
      case 'block-form':
        await handleBlockSubmit(form);
        break;
      case 'report-form':
        await handleReportSubmit(form);
        break;
      default:
        break;
    }
  });

  root.addEventListener('input', event => {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement && target.closest('#coach-form')) {
      state.coach.draft = target.value;
    }
    if (
      target instanceof HTMLInputElement &&
      target.closest('#email-form') &&
      target.name === 'email'
    ) {
      state.auth.email = target.value;
    }
  });

  root.addEventListener('keydown', event => {
    // Enter sends a coach message; Shift+Enter inserts a newline.
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      event.target instanceof HTMLTextAreaElement &&
      event.target.closest('#coach-form')
    ) {
      event.preventDefault();
      event.target.form?.requestSubmit();
    }
  });

  render();
  bootstrap();
}
