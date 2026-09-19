/*
 * Public voting page: /vote/:code
 *
 * No sign-in. A friend opens the invite link, picks who she thinks is the best
 * fit and who is not the one, optionally leaves her name and a short comment,
 * and submits once. A random voter identity is generated per browser and kept
 * in localStorage so the API can reject duplicate votes.
 */

import { api, ApiError } from './api.js';
import {
  escapeHtml,
  formatRelativeExpiry,
  randomId,
  readLocal,
  renderFooter,
  renderNotice,
  writeLocal,
} from './ui.js';

const VOTER_IDENTITY_KEY = 'hinto_voter_identity';
const VOTED_SESSIONS_KEY = 'hinto_voted_sessions';
const COMMENT_MAX = 140;
const NAME_MAX = 80;

function getVoterIdentity() {
  let identity = readLocal(VOTER_IDENTITY_KEY, null);
  if (typeof identity !== 'string' || identity.length < 8) {
    identity = randomId();
    writeLocal(VOTER_IDENTITY_KEY, identity);
  }
  return identity;
}

function rememberVoted(code) {
  const list = readLocal(VOTED_SESSIONS_KEY, []);
  const next = Array.isArray(list) ? list : [];
  if (!next.includes(code)) {
    next.push(code);
    writeLocal(VOTED_SESSIONS_KEY, next.slice(-50));
  }
}

function hasVoted(code) {
  const list = readLocal(VOTED_SESSIONS_KEY, []);
  return Array.isArray(list) && list.includes(code);
}

export function mountVotePage(root, inviteCode) {
  const code = String(inviteCode ?? '')
    .trim()
    .toUpperCase();

  const state = {
    code,
    phase: 'loading', // loading | ready | submitting | done | ended | missing | error
    session: null,
    items: [],
    ownerName: '',
    best: null,
    worst: null,
    notice: null,
    validation: null,
    alreadyVoted: false,
  };

  function ownerLabel() {
    return state.ownerName || 'your friend';
  }

  function renderHeader() {
    return `
      <header class="vote-header">
        <a class="brand" href="/" aria-label="HINTO home">HINTO</a>
        <span class="vote-header__hint">Private vote</span>
      </header>
    `;
  }

  function renderLoading() {
    return `
      <section class="hero-card hero-card--centered">
        <div class="eyebrow">One sec</div>
        <h1>Loading the list...</h1>
      </section>
    `;
  }

  function renderMissing() {
    return `
      <section class="hero-card hero-card--centered">
        <div class="eyebrow">Hmm</div>
        <h1>This link doesn't lead anywhere.</h1>
        <p>Double-check the link your friend sent you. Invite codes look like <code>ABC123XY</code>.</p>
        <a class="primary-button" href="/">Go to HINTO</a>
      </section>
    `;
  }

  function renderEnded() {
    const status = state.session?.status;
    return `
      <section class="hero-card hero-card--centered">
        <div class="eyebrow">Voting closed</div>
        <h1>${status === 'closed' ? `${escapeHtml(ownerLabel())} ended this vote.` : 'This vote has ended.'}</h1>
        <p>Votes are only open for a little while. If you still have thoughts, tell her directly.</p>
        <a class="secondary-button" href="/">Make your own list</a>
      </section>
    `;
  }

  function renderDone() {
    return `
      <section class="hero-card hero-card--centered">
        <div class="eyebrow">Thank you</div>
        <h1>${state.alreadyVoted ? "You've already voted here." : 'Your vote is in.'}</h1>
        <p>${
          state.alreadyVoted
            ? 'Each person can vote once per list, so your earlier pick still counts.'
            : `${escapeHtml(ownerLabel())} will see the results, not who said what.`
        }</p>
        <a class="secondary-button" href="/">Make your own list</a>
      </section>
    `;
  }

  function renderError() {
    return `
      <section class="hero-card hero-card--centered">
        <div class="eyebrow">Connection issue</div>
        <h1>We couldn't load this vote.</h1>
        <p>Check your connection and try again.</p>
        <button class="primary-button" data-action="retry-load" type="button">Try again</button>
      </section>
    `;
  }

  function renderChoiceGroup(kind, label, hint) {
    const selected = kind === 'best' ? state.best : state.worst;
    return `
      <fieldset class="choice-group choice-group--${kind}">
        <legend>
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(hint)}</span>
        </legend>
        <div class="choice-list">
          ${state.items
            .map(item => {
              const id = escapeHtml(item.situationshipId);
              const checked = selected === item.situationshipId ? 'checked' : '';
              return `
                <label class="choice ${checked ? 'choice--selected' : ''}">
                  <input type="radio" name="${kind}" value="${id}" ${checked} />
                  <span class="choice__emoji" aria-hidden="true">${escapeHtml(item.emoji ?? '💖')}</span>
                  <span class="choice__body">
                    <span class="choice__name">${escapeHtml(item.name)}</span>
                    ${item.description ? `<span class="choice__note">${escapeHtml(item.description)}</span>` : ''}
                  </span>
                </label>
              `;
            })
            .join('')}
        </div>
      </fieldset>
    `;
  }

  function renderForm() {
    const sessionTitle = state.session?.title || 'Rate my situationships';
    const description = state.session?.description;
    const expiry = formatRelativeExpiry(state.session?.expiresAt);
    const submitting = state.phase === 'submitting';

    return `
      <section class="hero-card hero-card--compact vote-intro">
        <div>
          <div class="eyebrow">${escapeHtml(ownerLabel())} wants your honest take</div>
          <h1>${escapeHtml(sessionTitle)}</h1>
          ${description ? `<p>${escapeHtml(description)}</p>` : "<p>Pick one best fit and one who isn't the one. Only she sees the results, and your vote is anonymous unless you add your name.</p>"}
        </div>
        ${expiry ? `<div class="hero-summary"><div><span>Voting</span><strong>${escapeHtml(expiry)}</strong></div></div>` : ''}
      </section>

      <form id="vote-form" class="panel vote-form">
        ${renderChoiceGroup('best', 'Best fit', 'Who seems like the one to keep around?')}
        ${renderChoiceGroup('worst', 'Not the one', 'Who should she stop thinking about?')}

        ${state.validation ? `<p class="form-error" role="alert">${escapeHtml(state.validation)}</p>` : ''}

        <div class="stack-form">
          <label>
            <span>Your name <em>(optional, shown only if she chose named votes)</em></span>
            <input name="voterName" maxlength="${NAME_MAX}" autocomplete="nickname" placeholder="Leave blank to stay anonymous" />
          </label>
          <label>
            <span>Comment <em>(optional)</em></span>
            <textarea name="comment" rows="3" maxlength="${COMMENT_MAX}" placeholder="One honest sentence."></textarea>
            <span class="char-count"><span data-role="comment-count">0</span>/${COMMENT_MAX}</span>
          </label>
        </div>

        <button class="primary-button primary-button--wide" type="submit" ${submitting ? 'disabled' : ''}>
          ${submitting ? 'Sending...' : 'Send my vote'}
        </button>
        <p class="fine-print">Be kind. Comments are reviewed and abusive votes can be reported.</p>
      </form>
    `;
  }

  function render() {
    let body;
    switch (state.phase) {
      case 'loading':
        body = renderLoading();
        break;
      case 'missing':
        body = renderMissing();
        break;
      case 'ended':
        body = renderEnded();
        break;
      case 'done':
        body = renderDone();
        break;
      case 'error':
        body = renderError();
        break;
      default:
        body = renderForm();
    }

    root.innerHTML = `
      <div class="app-frame">
        ${state.phase === 'loading' || state.phase === 'submitting' ? '<div class="loading-bar"></div>' : ''}
        <main class="shell shell--narrow">
          ${renderHeader()}
          ${renderNotice(state.notice)}
          ${body}
        </main>
        ${renderFooter()}
      </div>
    `;
  }

  async function load() {
    state.phase = 'loading';
    state.notice = null;
    render();

    if (!/^[A-Z0-9]{4,32}$/.test(state.code)) {
      state.phase = 'missing';
      render();
      return;
    }

    try {
      const response = await api.getPublicVotingSession(state.code);
      state.session = response.data.session;
      state.items = response.data.items ?? [];
      state.ownerName =
        response.data.ownerProfile?.displayName || response.data.ownerProfile?.username || '';

      if (hasVoted(state.code)) {
        state.alreadyVoted = true;
        state.phase = 'done';
      } else if (state.session.status !== 'active' || !response.data.capabilities?.canVote) {
        state.phase = 'ended';
      } else if (state.items.length < 2) {
        state.phase = 'ended';
      } else {
        state.phase = 'ready';
      }
    } catch (error) {
      if (error instanceof ApiError && error.isNetworkError) {
        state.phase = 'error';
      } else if (error instanceof ApiError && error.statusCode === 404) {
        state.phase = 'missing';
      } else if (error instanceof ApiError && error.statusCode === 410) {
        state.phase = 'ended';
      } else {
        state.phase = 'error';
        state.notice = { type: 'error', message: error.message ?? 'Something went wrong.' };
      }
    }
    render();
  }

  async function submit(form) {
    const formData = new FormData(form);
    state.best = formData.get('best')?.toString() || null;
    state.worst = formData.get('worst')?.toString() || null;
    const voterName = formData.get('voterName')?.toString().trim() || null;
    const comment = formData.get('comment')?.toString().trim() || null;

    if (!state.best || !state.worst) {
      state.validation = "Pick one best fit and one who isn't the one.";
      render();
      return;
    }
    if (state.best === state.worst) {
      state.validation = 'Best fit and not the one have to be different people.';
      render();
      return;
    }
    if (comment && comment.length > COMMENT_MAX) {
      state.validation = `Keep your comment under ${COMMENT_MAX} characters.`;
      render();
      return;
    }

    state.validation = null;
    state.phase = 'submitting';
    state.notice = null;
    render();

    try {
      await api.submitVote(state.code, {
        voterIdentity: getVoterIdentity(),
        voterName,
        bestSituationshipId: state.best,
        worstSituationshipId: state.worst,
        comment,
      });
      rememberVoted(state.code);
      state.phase = 'done';
    } catch (error) {
      if (error instanceof ApiError && error.code === 'duplicate_vote') {
        rememberVoted(state.code);
        state.alreadyVoted = true;
        state.phase = 'done';
      } else if (error instanceof ApiError && error.statusCode === 410) {
        state.phase = 'ended';
        if (state.session) {
          state.session.status = error.code === 'session_closed' ? 'closed' : 'expired';
        }
      } else if (error instanceof ApiError && error.statusCode === 404) {
        state.phase = 'missing';
      } else {
        state.phase = 'ready';
        state.notice = {
          type: 'error',
          message: error.message ?? "We couldn't send your vote. Please try again.",
        };
      }
    }
    render();
    if (state.phase === 'ready') {
      // Restore the typed values after re-render so nothing is lost on a failed submit.
      const nameInput = root.querySelector('input[name="voterName"]');
      const commentInput = root.querySelector('textarea[name="comment"]');
      if (nameInput && voterName) nameInput.value = voterName;
      if (commentInput && comment) {
        commentInput.value = comment;
        const counter = root.querySelector('[data-role="comment-count"]');
        if (counter) counter.textContent = String(comment.length);
      }
    }
  }

  root.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'retry-load') {
      load();
    } else if (action === 'dismiss-notice') {
      state.notice = null;
      render();
    }
  });

  root.addEventListener('change', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'radio') {
      return;
    }
    if (input.name === 'best') state.best = input.value;
    if (input.name === 'worst') state.worst = input.value;
    state.validation =
      state.best && state.best === state.worst
        ? 'Best fit and not the one have to be different people.'
        : null;
    // Update selection styling without a full re-render (keeps typed text intact).
    root.querySelectorAll(`.choice-group--${input.name} .choice`).forEach(label => {
      const radio = label.querySelector('input[type="radio"]');
      label.classList.toggle('choice--selected', Boolean(radio?.checked));
    });
    const errorNode = root.querySelector('.form-error');
    if (state.validation && !errorNode) {
      const holder = document.createElement('p');
      holder.className = 'form-error';
      holder.setAttribute('role', 'alert');
      holder.textContent = state.validation;
      root.querySelector('.vote-form .stack-form')?.before(holder);
    } else if (!state.validation && errorNode) {
      errorNode.remove();
    } else if (errorNode) {
      errorNode.textContent = state.validation;
    }
  });

  root.addEventListener('input', event => {
    if (event.target instanceof HTMLTextAreaElement && event.target.name === 'comment') {
      const counter = root.querySelector('[data-role="comment-count"]');
      if (counter) counter.textContent = String(event.target.value.length);
    }
  });

  root.addEventListener('submit', event => {
    event.preventDefault();
    if (event.target instanceof HTMLFormElement && event.target.id === 'vote-form') {
      submit(event.target);
    }
  });

  document.title = 'Vote - HINTO';
  load();
}
