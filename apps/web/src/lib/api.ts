/** Thin typed client for the SaaS API + token storage. */

const TOKEN_KEY = 'arre_token';

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8787/v1';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== false) {
    const token = getToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    return { ok: false, error: { code: 'network', message: 'Network error. Is the API running?' } };
  }

  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: T;
    error?: { code: string; message: string };
  };
  if (!res.ok || json.ok === false) {
    return { ok: false, error: json.error ?? { code: 'error', message: `Request failed (${res.status}).` } };
  }
  return { ok: true, data: json.data };
}

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents ?? 0) / 100);
}
