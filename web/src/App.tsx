import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { Home } from './screens/Home';
import { Plan } from './screens/Plan';
import { Shopping } from './screens/Shopping';
import { Money } from './screens/Money';
import { FoodLog } from './screens/FoodLog';
import { Household } from './screens/Household';

export type Me = { member: { id: string; name: string; role: string }; household: any };
const TABS = [
  ['home', 'Home', '🏠'], ['plan', 'Plan', '🍽️'], ['shop', 'Shopping', '🛒'], ['money', 'Money', '💰'], ['food', 'Food log', '🥗'], ['house', 'Household', '👥'],
] as const;
type Tab = typeof TABS[number][0];

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<'loading' | 'login' | 'ready' | 'error'>('loading');
  const [tab, setTab] = useState<Tab>((location.hash.slice(1) as Tab) || 'home');

  const load = useCallback(async () => {
    try { setMe(await api.get<Me>('/api/me')); setState('ready'); }
    catch (e) { setState(e instanceof ApiError && e.status === 401 ? 'login' : 'error'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { location.hash = tab; }, [tab]);

  if (state === 'loading') return <div className="center muted">Loading…</div>;
  if (state === 'login') return (
    <div className="center"><div className="card" style={{ maxWidth: 380 }}>
      <h1>Shared Living</h1>
      <p className="muted">Open the WhatsApp chat with the assistant and send <b>dashboard</b>. You will get a one-time link that signs you in here.</p>
    </div></div>
  );
  if (state === 'error' || !me) return <div className="center"><div className="card"><p className="error">Could not load. Check your connection and refresh.</p></div></div>;

  const props = { me, reloadMe: load };
  return (
    <>
      <main>
        {tab === 'home' && <Home {...props} go={(t: Tab) => setTab(t)} />}
        {tab === 'plan' && <Plan {...props} />}
        {tab === 'shop' && <Shopping {...props} />}
        {tab === 'money' && <Money {...props} />}
        {tab === 'food' && <FoodLog {...props} />}
        {tab === 'house' && <Household {...props} />}
      </main>
      <nav className="tabs" aria-label="Main">
        {TABS.map(([id, label, icon]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
            <span className="ic" aria-hidden>{icon}</span>{label}
          </button>
        ))}
      </nav>
    </>
  );
}
