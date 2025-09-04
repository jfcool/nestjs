const BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

function isFormLike(b: unknown) {
  return b instanceof FormData || b instanceof Blob || b instanceof URLSearchParams || b instanceof ArrayBuffer;
}

export async function customFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const full = url.startsWith('http') ? url : `${BASE}${url}`;
  const headers = new Headers(init?.headers ?? {});
  let body = init?.body as any;

  // Wenn Body vorhanden und NICHT FormData/Blob/etc.:
  if (body != null && !isFormLike(body)) {
    // Content-Type setzen, falls noch nicht gesetzt
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    // Wenn noch kein String, dann JSON serialisieren
    if (typeof body !== 'string') body = JSON.stringify(body);
  }

  const res = await fetch(full, { ...init, headers, body, credentials: 'include' });
  const ct = res.headers.get('content-type') ?? '';
  const parsed = ct.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) throw new Error(typeof parsed === 'string' ? parsed : JSON.stringify(parsed));

  return { data: parsed, status: res.status, headers: res.headers } as unknown as T;
}
