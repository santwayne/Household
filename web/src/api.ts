export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, credentials: 'same-origin', headers: body !== undefined ? { 'content-type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ? String(data.error) + (data.details ? ': ' + data.details.join(', ') : '') : res.statusText);
  return data as T;
}
export const api = {
  get: <T,>(u: string) => call<T>('GET', u),
  post: <T,>(u: string, b: unknown = {}) => call<T>('POST', u, b),
  put: <T,>(u: string, b: unknown) => call<T>('PUT', u, b),
  patch: <T,>(u: string, b: unknown) => call<T>('PATCH', u, b),
  del: <T,>(u: string, b?: unknown) => call<T>('DELETE', u, b ?? {}),
};

export const fmt = (currency: string, n: number | null | undefined) => {
  if (n == null) return '–';
  const v = Math.round(n * 100) / 100;
  const s = v.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  return currency === 'INR' ? `₹${s}` : `${currency} ${s}`;
};
export const qty = (q: number | null, unit: string | null) => {
  if (q == null) return '';
  if (unit === 'g' && q >= 1000) return `${q / 1000} kg`;
  if (unit === 'ml' && q >= 1000) return `${q / 1000} l`;
  return `${Math.round(q * 100) / 100}${unit ? ' ' + unit : ''}`;
};
export const dayLabel = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
