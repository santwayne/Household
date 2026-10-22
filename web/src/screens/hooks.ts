import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try { setData(await api.get<T>(url)); setError(null); } catch (e) { setError((e as Error).message); }
  }, [url]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload };
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); return true; } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  };
  return { busy, error, run };
}
