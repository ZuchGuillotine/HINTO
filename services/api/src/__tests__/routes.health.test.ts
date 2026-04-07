import { routeRequest } from '../routes';
import { createMockRequest, createMockResponse, createTestContext } from './helpers/http';
import { createTestConfig } from './helpers/config';

const config = createTestConfig();

/**
 * Wraps routeRequest in a promise that resolves when the response finishes.
 */
function dispatchAndWait(
  method: string,
  url: string,
  options: { headers?: Record<string, string>; body?: Record<string, unknown> } = {},
) {
  const req = createMockRequest({ method, url, ...options });
  const res = createMockResponse();
  const ctx = createTestContext();

  return new Promise<typeof res>((resolve) => {
    res.on('finish', () => resolve(res));
    routeRequest(req, res, ctx, config);
  });
}

describe('Health and discovery routes', () => {
  test('GET /health returns 200 with service info', async () => {
    const res = await dispatchAndWait('GET', '/health');
    expect(res._getStatusCode()).toBe(200);

    const body = res._getJson() as { data: { ok: boolean; service: string; version: string } };
    expect(body.data.ok).toBe(true);
    expect(body.data.service).toBe('hinto-api-test');
    expect(body.data.version).toBe('v1');
  });

  test('GET /v1/health returns 200 with api version', async () => {
    const res = await dispatchAndWait('GET', '/v1/health');
    expect(res._getStatusCode()).toBe(200);

    const body = res._getJson() as { data: { api: string; ok: boolean } };
    expect(body.data.ok).toBe(true);
    expect(body.data.api).toBe('v1');
  });

  test('GET /v1 returns route discovery list', async () => {
    const res = await dispatchAndWait('GET', '/v1');
    expect(res._getStatusCode()).toBe(200);

    const body = res._getJson() as { data: { routes: string[]; api: string; status: string } };
    expect(body.data.api).toBe('v1');
    expect(body.data.status).toBe('active');
    expect(body.data.routes).toBeInstanceOf(Array);
    expect(body.data.routes.length).toBeGreaterThan(0);
    expect(body.data.routes).toContain('GET  /v1/me');
  });

  test('unknown route returns 404', async () => {
    const res = await dispatchAndWait('GET', '/v1/nonexistent');
    expect(res._getStatusCode()).toBe(404);

    const body = res._getJson() as { error: { code: string } };
    expect(body.error.code).toBe('not_found');
  });

  test('response includes meta.requestId', async () => {
    const res = await dispatchAndWait('GET', '/health');
    const body = res._getJson() as { meta: { requestId: string } };
    expect(body.meta.requestId).toBe('test-request-id');
  });
});
