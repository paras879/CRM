import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError } from '@/lib/api';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('apiFetch', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    document.cookie = 'crm_csrf=csrf-token-123; path=/';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = 'crm_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('prefixes the API base path and sends cookies', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await apiFetch('/customers');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/customers');
    expect(init.credentials).toBe('include');
  });

  it('adds the CSRF header to mutating requests only', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await apiFetch('/customers');
    await apiFetch('/customers', { method: 'POST', body: '{}' });

    expect((fetchMock.mock.calls[0][1].headers as Headers).get('x-csrf-token')).toBeNull();
    expect((fetchMock.mock.calls[1][1].headers as Headers).get('x-csrf-token')).toBe('csrf-token-123');
  });

  it('keeps a caller supplied content type, as binary uploads need', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await apiFetch('/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Blob(['x']),
    });
    expect((fetchMock.mock.calls[0][1].headers as Headers).get('content-type')).toBe('application/octet-stream');
  });

  it('turns API error payloads into ApiError with code and details', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: [{ field: 'x' }] } }, 400)
    );
    const error = (await apiFetch('/customers', { method: 'POST', body: '{}' }).catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'Invalid request data' });
    expect(error.details).toEqual([{ field: 'x' }]);
  });

  it('returns an empty object for 204 responses', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiFetch('/attachments/1', { method: 'DELETE' })).resolves.toEqual({});
  });

  it('does not bounce public pages to /login when the session is missing', async () => {
    window.history.pushState({}, '', '/reset-password?token=abc');
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/auth/refresh') ? jsonResponse({}, 401) : jsonResponse({}, 401)
    );
    const before = window.location.pathname;
    await apiFetch('/auth/me').catch(() => undefined);
    expect(window.location.pathname).toBe(before);
  });
});
