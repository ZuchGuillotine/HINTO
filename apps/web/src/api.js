const DEFAULT_API_BASE_URL =
  typeof window !== 'undefined' && window.HINTO_API_BASE_URL
    ? window.HINTO_API_BASE_URL
    : 'http://127.0.0.1:3000';

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, `${DEFAULT_API_BASE_URL}/`);
}

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(buildUrl(path), {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message ?? `Request failed (${response.status})`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export const api = {
  createDevelopmentSession(input) {
    return request('/v1/dev/session', { method: 'POST', body: input });
  },
  getMe(token) {
    return request('/v1/me', { token });
  },
  updateMe(token, update) {
    return request('/v1/me', { method: 'PATCH', token, body: update });
  },
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
  getVotingSessions(token) {
    return request('/v1/me/voting-sessions', { token });
  },
  createVotingSession(token, input) {
    return request('/v1/me/voting-sessions', { method: 'POST', token, body: input });
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
};
