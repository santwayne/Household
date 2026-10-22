import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { Home } from './screens/Home';
import { Plan } from './screens/Plan';
import { Shopping } from './screens/Shopping';
import { Money } from './screens/Money';
import { FoodLog } from './screens/FoodLog';
import { Household } from './screens/Household';

function Login() {
  const [pub, setPub] = useState<{ startLink: string; privacyUrl: string } | null>(null);
  useEffect(() => { api.get<any>('/api/public').then(setPub).catch(() => {}); }, []);
  return (
    <div className="center"><div className="card" style={{ maxWidth: 400, textAlign: 'left' }}>
      <h1>Shared Living</h1>
      <p className="muted">Plan meals, keep the shopping list and split food costs with your flatmates, all from WhatsApp.</p>
      <h2>New here?</h2>
      <p className="muted">Everything starts in WhatsApp, where you agree to how your data is used before anything is saved.</p>
      {pub && <a href={pub.startLink}><button className="primary">Start on WhatsApp</button></a>}
      <h2 style={{ marginTop: 16 }}>Already using it?</h2>
      <p className="muted">Send <b>dashboard</b> to the assistant. You get a one-time link that signs you in here.</p>
      {pub && <p className="muted small"><a href={pub.privacyUrl}>Privacy notice</a></p>}
    </div></div>
  );
}

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
  if (state === 'login') return <Login />;
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
