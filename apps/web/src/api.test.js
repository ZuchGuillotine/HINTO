/* eslint-env jest */

import { NETWORK_ERROR_MESSAGE, createApiClient } from './api.js';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('web api client', () => {
  test('refreshes on 401 with POST /v1/auth/refresh and retries the request once', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, { error: { code: 'unauthorized', message: 'expired' } })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { accessToken: 'access-2', refreshToken: 'refresh-2' } })
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: { profile: { username: 'ok' } } }));

    const onSessionRefreshed = jest.fn();
    const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl });
    client.configureSession({
      getRefreshToken: () => 'refresh-1',
      onSessionRefreshed,
    });

    const result = await client.getMe('access-1');

    expect(result.data.profile.username).toBe('ok');
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    const [refreshUrl, refreshInit] = fetchImpl.mock.calls[1];
    expect(String(refreshUrl)).toBe('https://api.test/v1/auth/refresh');
    expect(refreshInit.method).toBe('POST');
    expect(JSON.parse(refreshInit.body)).toEqual({ refreshToken: 'refresh-1' });

    const [, retryInit] = fetchImpl.mock.calls[2];
    expect(retryInit.headers.Authorization).toBe('Bearer access-2');
    expect(onSessionRefreshed).toHaveBeenCalledWith({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
    });
  });

  test('throws the original 401 when the refresh fails and does not loop', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, { error: { code: 'unauthorized', message: 'expired' } })
      )
      .mockResolvedValueOnce(
        jsonResponse(401, { error: { code: 'refresh_failed', message: 'Invalid refresh' } })
      );

    const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl });
    client.configureSession({ getRefreshToken: () => 'refresh-1' });

    await expect(client.getMe('access-1')).rejects.toMatchObject({
      statusCode: 401,
      code: 'unauthorized',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('does not attempt a refresh without a refresh token or for auth routes', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(401, { error: { code: 'unauthorized', message: 'nope' } }));

    const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl });
    await expect(client.getMe('access-1')).rejects.toMatchObject({ statusCode: 401 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    client.configureSession({ getRefreshToken: () => 'refresh-1' });
    await expect(client.refreshSession('stale')).rejects.toMatchObject({ statusCode: 401 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('tags fetch failures as network errors instead of auth failures', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl });

    await expect(client.getMe('access-1')).rejects.toMatchObject({
      isNetworkError: true,
      message: NETWORK_ERROR_MESSAGE,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('exposes error codes from the JSON envelope', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(429, {
        error: { code: 'quota_exceeded', message: 'Daily AI message limit reached' },
      })
    );
    const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl });

    await expect(client.sendCoachMessage('access-1', 'conv-1', 'hi')).rejects.toMatchObject({
      statusCode: 429,
      code: 'quota_exceeded',
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe('https://api.test/v1/me/conversations/conv-1/messages');
    expect(JSON.parse(init.body)).toEqual({ content: 'hi' });
  });
});
