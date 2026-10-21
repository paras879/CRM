export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)crm_csrf=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

let isRefreshing = false;
let refreshSubscribers: ((refreshed: boolean) => void)[] = [];

function subscribeTokenRefresh(cb: (refreshed: boolean) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(refreshed: boolean) {
  refreshSubscribers.forEach((cb) => cb(refreshed));
  refreshSubscribers = [];
}

const REQUEST_TIMEOUT_MS = 15000;

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `/api/v1${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Include CSRF token on state-changing requests
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCsrfTokenFromCookie();
    if (csrf) {
      headers.set('x-csrf-token', csrf);
    }
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  const response = await fetchWithTimeout(url, fetchOptions);

  // If 401 Unauthorized and not already refreshing or trying to login/refresh
  if (
    response.status === 401 &&
    !endpoint.includes('/auth/login') &&
    !endpoint.includes('/auth/refresh')
  ) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetchWithTimeout('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (refreshRes.ok) {
          isRefreshing = false;
          onRefreshed(true);
          // Retry original request
          return apiFetch<T>(endpoint, options);
        } else {
          isRefreshing = false;
          onRefreshed(false);
          const publicPaths = ['/login', '/forgot-password', '/reset-password'];
          if (typeof window !== 'undefined' && !publicPaths.some((p) => window.location.pathname.startsWith(p))) {
            window.location.href = '/login';
          }
        }
      } catch {
        isRefreshing = false;
        onRefreshed(false);
      }
    } else {
      // Queue requests while token refresh is in flight
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh(async (refreshed) => {
          if (!refreshed) {
            reject(new ApiError(401, 'UNAUTHORIZED', 'Session expired'));
            return;
          }
          try {
            const res = await apiFetch<T>(endpoint, options);
            resolve(res);
          } catch (err) {
            reject(err);
          }
        });
      });
    }
  }

  if (response.status === 204) {
    return {} as T;
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorInfo = data?.error || {};
    throw new ApiError(
      response.status,
      errorInfo.code || 'REQUEST_FAILED',
      errorInfo.message || response.statusText || 'Request failed',
      errorInfo.details
    );
  }

  return data as T;
}
