const DEFAULT_API_BASE_URL =
  typeof window !== 'undefined' && window.HINTO_API_BASE_URL
    ? window.HINTO_API_BASE_URL
    : 'http://127.0.0.1:3000';

export const NETWORK_ERROR_MESSAGE = 'Could not reach hnnt. Check your connection and try again.';

/**
 * Creates an API client bound to a base URL and fetch implementation.
 *
 * Session refresh: when a request made with a bearer token gets a 401, the
 * client calls `POST /v1/auth/refresh` with the refresh token supplied by
 * `configureSession({ getRefreshToken })`, hands the new token pair to
 * `onSessionRefreshed`, and retries the original request exactly once. Auth
 * routes themselves are never retried. Network failures are thrown as errors
 * with `isNetworkError: true` and never trigger a refresh.
 */
export function createApiClient({
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = typeof fetch === 'function' ? fetch : undefined,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('createApiClient requires a fetch implementation.');
  }

  const session = {
    getRefreshToken: () => null,
    onSessionRefreshed: () => {},
  };
  let refreshInFlight = null;

  function buildUrl(path) {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    return new URL(normalizedPath, `${baseUrl}/`);
  }

  function buildError(response, payload) {
    const message = payload?.error?.message ?? `Request failed (${response.status})`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.code = payload?.error?.code ?? null;
    error.payload = payload;
    return error;
  }

  async function performFetch(path, { method = 'GET', token, body } = {}) {
    let response;
    try {
      response = await fetchImpl(buildUrl(path), {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (cause) {
      const error = new Error(NETWORK_ERROR_MESSAGE);
      error.isNetworkError = true;
      error.cause = cause;
      throw error;
    }

    const payload = await response.json().catch(() => null);
    return { response, payload };
  }

  async function refreshAccessToken() {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const refreshToken = session.getRefreshToken();
        if (!refreshToken) {
          return null;
        }
        const { response, payload } = await performFetch('/v1/auth/refresh', {
          method: 'POST',
          body: { refreshToken },
        });
        if (!response.ok || !payload?.data?.accessToken) {
          return null;
        }
        session.onSessionRefreshed(payload.data);
        return payload.data.accessToken;
      })().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  async function request(path, { method = 'GET', token, body, retryOnUnauthorized = true } = {}) {
    const { response, payload } = await performFetch(path, { method, token, body });

    const canRefresh =
      response.status === 401 &&
      Boolean(token) &&
      retryOnUnauthorized &&
      !path.startsWith('/v1/auth/');

    if (canRefresh) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken && refreshedToken !== token) {
        return request(path, { method, token: refreshedToken, body, retryOnUnauthorized: false });
      }
    }

    if (!response.ok) {
      throw buildError(response, payload);
    }

    return payload;
  }

  return {
    configureSession({ getRefreshToken, onSessionRefreshed } = {}) {
      if (typeof getRefreshToken === 'function') {
        session.getRefreshToken = getRefreshToken;
      }
      if (typeof onSessionRefreshed === 'function') {
        session.onSessionRefreshed = onSessionRefreshed;
      }
    },
    request,

    // Auth
    signUpWithEmailPassword(input) {
      return request('/v1/auth/email/password/sign-up', { method: 'POST', body: input });
    },
    signInWithEmailPassword(input) {
      return request('/v1/auth/email/password/sign-in', { method: 'POST', body: input });
    },
    refreshSession(refreshToken) {
      return request('/v1/auth/refresh', { method: 'POST', body: { refreshToken } });
    },

    // Profile
    getMe(token) {
      return request('/v1/me', { token });
    },
    updateMe(token, update) {
      return request('/v1/me', { method: 'PATCH', token, body: update });
    },
    deleteMe(token) {
      return request('/v1/me', { method: 'DELETE', token });
    },

    // Situationships
    getSituationships(token) {
      return request('/v1/me/situationships', { token });
    },
    createSituationship(token, input) {
      return request('/v1/me/situationships', { method: 'POST', token, body: input });
    },
    updateSituationship(token, id, input) {
      return request(`/v1/me/situationships/${id}`, { method: 'PATCH', token, body: input });
    },
    deleteSituationship(token, id) {
      return request(`/v1/me/situationships/${id}`, { method: 'DELETE', token });
    },
    reorderSituationships(token, orderedSituationshipIds) {
      return request('/v1/me/situationships/order', {
        method: 'PUT',
        token,
        body: { orderedSituationshipIds },
      });
    },

    // Social
    getFriendsFeed(token) {
      return request('/v1/me/feed', { token });
    },
    getFriends(token) {
      return request('/v1/me/friends', { token });
    },
    createFriendRequest(token, input) {
      return request('/v1/me/friend-requests', { method: 'POST', token, body: input });
    },
    acceptFriendRequest(token, friendshipId) {
      return request(`/v1/me/friend-requests/${friendshipId}/accept`, { method: 'POST', token });
    },
    declineFriendRequest(token, friendshipId) {
      return request(`/v1/me/friend-requests/${friendshipId}/decline`, { method: 'POST', token });
    },
    removeFriend(token, profileId) {
      return request(`/v1/me/friends/${profileId}`, { method: 'DELETE', token });
    },
    getFriendSuggestions(token) {
      return request('/v1/me/friend-suggestions', { token });
    },
    dismissFriendSuggestion(token, suggestionId) {
      return request(`/v1/me/friend-suggestions/${suggestionId}/dismiss`, {
        method: 'POST',
        token,
      });
    },

    // Voting
    getVotingSessions(token) {
      return request('/v1/me/voting-sessions', { token });
    },
    createVotingSession(token, input) {
      return request('/v1/me/voting-sessions', { method: 'POST', token, body: input });
    },
    createShareInvite(token, input) {
      return request('/v1/me/share-invites', { method: 'POST', token, body: input });
    },
    getVotingResults(token, votingSessionId) {
      return request(`/v1/me/voting-sessions/${votingSessionId}/results`, { token });
    },
    getPublicVotingSession(inviteCode) {
      return request(`/v1/voting-sessions/${inviteCode}`);
    },
    submitVote(inviteCode, input) {
      return request(`/v1/voting-sessions/${inviteCode}/votes`, { method: 'POST', body: input });
    },

    // Coach
    getConversations(token) {
      return request('/v1/me/conversations', { token });
    },
    createConversation(token, input = {}) {
      return request('/v1/me/conversations', { method: 'POST', token, body: input });
    },
    getConversation(token, conversationId) {
      return request(`/v1/me/conversations/${conversationId}`, { token });
    },
    deleteConversation(token, conversationId) {
      return request(`/v1/me/conversations/${conversationId}`, { method: 'DELETE', token });
    },
    sendCoachMessage(token, conversationId, content) {
      return request(`/v1/me/conversations/${conversationId}/messages`, {
        method: 'POST',
        token,
        body: { content },
      });
    },

    // Moderation
    createReport(token, input) {
      return request('/v1/reports', { method: 'POST', token, body: input });
    },
    getBlocks(token) {
      return request('/v1/me/blocks', { token });
    },
    createBlock(token, input) {
      return request('/v1/me/blocks', { method: 'POST', token, body: input });
    },
    deleteBlock(token, blockedProfileId) {
      return request(`/v1/me/blocks/${blockedProfileId}`, { method: 'DELETE', token });
    },
  };
}

export const api = createApiClient();
