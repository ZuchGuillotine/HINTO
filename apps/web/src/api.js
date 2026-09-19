/*
 * HINTO web API client.
 *
 * - Base URL comes from `window.HINTO_API_BASE_URL` (set by /config.js).
 * - The session ({ accessToken, refreshToken, expiresAt }) lives in localStorage
 *   under a single JSON key.
 * - Authenticated requests refresh the access token once on a 401 and retry.
 *   If the refresh fails the session is cleared and the `sessionLost` handler
 *   runs so the app can return to sign-in.
 * - Network failures (fetch throwing) never clear the session; they surface as
 *   an ApiError with `isNetworkError = true` so the UI can offer a retry.
 */

const SESSION_KEY = 'hinto_web_session';
const REFRESH_SKEW_SECONDS = 45;

export class ApiError extends Error {
  constructor(
    message,
    { code = 'unknown', statusCode = 0, requestId = null, isNetworkError = false } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.isNetworkError = isNetworkError;
  }
}

function getBaseUrl() {
  const configured = typeof window !== 'undefined' ? window.HINTO_API_BASE_URL : undefined;
  return (configured || 'http://127.0.0.1:3000').replace(/\/+$/, '');
}

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, `${getBaseUrl()}/`);
}

// ── Session storage ────────────────────────────────────────────

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.accessToken !== 'string') {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
      expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null,
    };
  } catch {
    return null;
  }
}

function writeSession(value) {
  try {
    if (value) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode, blocked). The in-memory copy still works.
  }
}

let currentSession = readSession();
let sessionLostHandler = null;
let refreshInFlight = null;

export const session = {
  get() {
    return currentSession;
  },
  isSignedIn() {
    return Boolean(currentSession?.accessToken);
  },
  /** Accepts an AuthSessionDto (or the dev-session shape) and persists it. */
  set(authSession) {
    if (!authSession?.accessToken) {
      currentSession = null;
      writeSession(null);
      return;
    }
    currentSession = {
      accessToken: authSession.accessToken,
      refreshToken: authSession.refreshToken ?? null,
      expiresAt: typeof authSession.expiresAt === 'number' ? authSession.expiresAt : null,
    };
    writeSession(currentSession);
  },
  clear() {
    currentSession = null;
    writeSession(null);
  },
  onLost(handler) {
    sessionLostHandler = handler;
  },
};

function loseSession(reason) {
  session.clear();
  if (typeof sessionLostHandler === 'function') {
    sessionLostHandler(reason);
  }
}

function isExpiringSoon() {
  if (!currentSession?.expiresAt) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return currentSession.expiresAt - nowSeconds <= REFRESH_SKEW_SECONDS;
}

// ── Low-level request ──────────────────────────────────────────

async function rawFetch(path, { method = 'GET', body, token } = {}) {
  let response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new ApiError("We couldn't reach HINTO. Check your connection and try again.", {
      code: 'network_error',
      isNetworkError: true,
    });
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = payload?.error ?? {};
    throw new ApiError(errorBody.message ?? `Request failed (${response.status})`, {
      code: errorBody.code ?? `http_${response.status}`,
      statusCode: response.status,
      requestId: errorBody.requestId ?? response.headers.get('x-request-id'),
    });
  }

  return payload;
}

/**
 * Refreshes the session once, sharing a single in-flight refresh between
 * concurrent callers. Resolves to the new session or throws.
 */
async function refreshSession() {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const refreshToken = currentSession?.refreshToken;
  if (!refreshToken) {
    throw new ApiError('Your session has ended. Please sign in again.', {
      code: 'no_refresh_token',
      statusCode: 401,
    });
  }

  refreshInFlight = (async () => {
    const payload = await rawFetch('/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
    session.set(payload.data);
    return payload.data;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  if (!auth) {
    return rawFetch(path, { method, body });
  }

  if (!currentSession?.accessToken) {
    throw new ApiError('Please sign in to continue.', { code: 'unauthenticated', statusCode: 401 });
  }

  if (isExpiringSoon() && currentSession.refreshToken) {
    try {
      await refreshSession();
    } catch (error) {
      if (error instanceof ApiError && error.isNetworkError) {
        throw error;
      }
      loseSession('refresh_failed');
      throw error;
    }
  }

  try {
    return await rawFetch(path, { method, body, token: currentSession.accessToken });
  } catch (error) {
    if (!(error instanceof ApiError) || error.statusCode !== 401) {
      throw error;
    }
  }

  // One refresh + retry on 401.
  try {
    await refreshSession();
  } catch (error) {
    if (error instanceof ApiError && error.isNetworkError) {
      throw error;
    }
    loseSession('refresh_failed');
    throw new ApiError('Your session has ended. Please sign in again.', {
      code: 'session_expired',
      statusCode: 401,
    });
  }

  try {
    return await rawFetch(path, { method, body, token: currentSession.accessToken });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      loseSession('unauthorized_after_refresh');
    }
    throw error;
  }
}

// ── Public API surface ─────────────────────────────────────────

export const api = {
  // Auth
  requestEmailCode(email) {
    return request('/v1/auth/email/otp', { method: 'POST', body: { email } });
  },
  verifyEmailCode(email, token) {
    return request('/v1/auth/email/verify', { method: 'POST', body: { email, token } });
  },
  refresh() {
    return refreshSession();
  },
  signInWithApple(input) {
    return request('/v1/auth/apple', { method: 'POST', body: input });
  },
  /** Local development only; the API refuses this unless API_ENABLE_DEV_AUTH=true. */
  createDevelopmentSession(input) {
    return request('/v1/dev/session', { method: 'POST', body: input });
  },

  // Profile
  getMe() {
    return request('/v1/me', { auth: true });
  },
  updateMe(update) {
    return request('/v1/me', { method: 'PATCH', auth: true, body: update });
  },
  deleteMe() {
    return request('/v1/me', { method: 'DELETE', auth: true });
  },

  // Situationships
  getSituationships() {
    return request('/v1/me/situationships', { auth: true });
  },
  createSituationship(input) {
    return request('/v1/me/situationships', { method: 'POST', auth: true, body: input });
  },
  updateSituationship(id, input) {
    return request(`/v1/me/situationships/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      auth: true,
      body: input,
    });
  },
  deleteSituationship(id) {
    return request(`/v1/me/situationships/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      auth: true,
    });
  },
  reorderSituationships(orderedSituationshipIds) {
    return request('/v1/me/situationships/order', {
      method: 'PUT',
      auth: true,
      body: { orderedSituationshipIds },
    });
  },

  // Voting (owner)
  listVotingSessions() {
    return request('/v1/me/voting-sessions', { auth: true });
  },
  createVotingSession(input = {}) {
    return request('/v1/me/voting-sessions', { method: 'POST', auth: true, body: input });
  },
  expireVotingSession(votingSessionId) {
    return request(`/v1/me/voting-sessions/${encodeURIComponent(votingSessionId)}/expire`, {
      method: 'POST',
      auth: true,
    });
  },
  getVotingResults(votingSessionId) {
    return request(`/v1/me/voting-sessions/${encodeURIComponent(votingSessionId)}/results`, {
      auth: true,
    });
  },

  // Voting (public, no auth)
  getPublicVotingSession(inviteCode) {
    return request(`/v1/voting-sessions/${encodeURIComponent(inviteCode)}`);
  },
  submitVote(inviteCode, input) {
    return request(`/v1/voting-sessions/${encodeURIComponent(inviteCode)}/votes`, {
      method: 'POST',
      body: input,
    });
  },

  // Moderation
  createReport(input) {
    return request('/v1/reports', { method: 'POST', auth: true, body: input });
  },
  listBlocks() {
    return request('/v1/me/blocks', { auth: true });
  },
  createBlock(input) {
    return request('/v1/me/blocks', { method: 'POST', auth: true, body: input });
  },
  deleteBlock(profileId) {
    return request(`/v1/me/blocks/${encodeURIComponent(profileId)}`, {
      method: 'DELETE',
      auth: true,
    });
  },

  // AI coach
  listConversations() {
    return request('/v1/me/ai/conversations', { auth: true });
  },
  createConversation(input = {}) {
    return request('/v1/me/ai/conversations', { method: 'POST', auth: true, body: input });
  },
  listMessages(conversationId) {
    return request(`/v1/me/ai/conversations/${encodeURIComponent(conversationId)}/messages`, {
      auth: true,
    });
  },
  sendMessage(conversationId, content) {
    return request(`/v1/me/ai/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      auth: true,
      body: { content },
    });
  },
};
