import { useState } from 'react';
import { api } from '../api';
import { useApi, useAction } from './hooks';

const TIPS: Record<string, string> = {
  few_logs: 'Log a few more meals for useful feedback.', more_veg: 'Try adding vegetables to more meals.',
  more_protein: 'Dal, soya, eggs or paneer can raise protein cheaply.', ordered_often: 'You ordered or ate out often. Home-cooked meals from the plan could save money.',
  looks_balanced: 'Looks reasonably balanced.',
};

export function FoodLog({ me }: { me: any }) {
  const { data, error, reload } = useApi<any>('/api/foodlog');
  const protein = useApi<any[]>('/api/protein');
  const act = useAction();
  const [meal, setMeal] = useState(''); const [kind, setKind] = useState('home'); const [veg, setVeg] = useState(false); const [prot, setProt] = useState(false);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const b = data.balance;
  const anyShared = data.mine.some((l: any) => l.shared_with_household);
  return (
    <>
      <h1>Food log</h1>
      <p className="notice small">{data.disclaimer}</p>
      <section className="card">
        <h2>Log a meal <span className="pill">private</span></h2>
        <label>What did you eat?<input value={meal} onChange={e => setMeal(e.target.value)} placeholder="dal chawal" /></label>
        <div className="grid2" style={{ marginTop: 10 }}>
          <label>Where<select value={kind} onChange={e => setKind(e.target.value)}><option value="home">Home-cooked</option><option value="ordered">Ordered</option><option value="outside">Ate out</option></select></label>
          <div className="row" style={{ alignSelf: 'end' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={veg} onChange={e => setVeg(e.target.checked)} style={{ width: 'auto', minHeight: 0 }} />Vegetables</label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={prot} onChange={e => setProt(e.target.checked)} style={{ width: 'auto', minHeight: 0 }} />Protein</label>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}><button className="primary" disabled={act.busy || !meal.trim()} onClick={async () => { if (await act.run(() => api.post('/api/foodlog', { meal, kind, hasVegetables: veg, hasProtein: prot }))) { setMeal(''); setVeg(false); setProt(false); reload(); } }}>Save</button></div>
        {act.error && <p className="error">{act.error}</p>}
      </section>
      <section className="card">
        <h2>Your last 7 days</h2>
        <p style={{ margin: 0 }}>{b.total} meals logged · {b.home} home-cooked · {b.ordered} ordered/outside · {b.withVeg} with vegetables · {b.withProtein} with protein</p>
        {b.tips.map((t: any) => <p key={t.key} className="muted">{TIPS[t.key]}</p>)}
      </section>
      <section className="card">
        <h2>Sharing</h2>
        <p className="muted">Your meal log is private. You can share only a count summary (meals, home-cooked) with your household; meal names are never shared.</p>
        <button disabled={act.busy} onClick={async () => { await act.run(() => api.put('/api/foodlog/sharing', { shared: !anyShared })); reload(); }}>{anyShared ? 'Stop sharing my summary' : 'Share my summary with household'}</button>
        {data.shared.length > 0 && <div className="list" style={{ marginTop: 10 }}>{data.shared.map((s: any) => <div key={s.name} className="row between"><span>{s.name}</span><span className="muted">{s.meals} meals · {s.home_cooked} home-cooked</span></div>)}</div>}
      </section>
      <section className="card">
        <h2>Cheapest protein</h2>
        <div className="list">{(protein.data ?? []).slice(0, 8).map((p, i) => <div key={p.item} className="row between"><span>{i + 1}. {p.item}</span><span className="muted">{p.gramsProteinPerRupee} g per {me.household.currency === 'INR' ? '₹' : me.household.currency}</span></div>)}</div>
        <p className="muted small">Ranking uses your price book and approximate protein values that still need expert review.</p>
      </section>
      <section className="card">
        <h2>Recent</h2>
        {data.mine.length ? <div className="list">{data.mine.slice(0, 12).map((l: any) => <div key={l.id} className="row between"><span>{l.meal}</span><span className="muted">{l.kind} · {l.date}</span></div>)}</div> : <p className="muted">No meals logged yet.</p>}
      </section>
    </>
  );
}
