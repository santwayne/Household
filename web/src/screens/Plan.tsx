import { useState } from 'react';
import { api, dayLabel, fmt } from '../api';
import { useApi, useAction } from './hooks';

export function Plan({ me }: { me: any }) {
  const { data, error, reload } = useApi<any>('/api/plan');
  const cur = me.household.currency;
  const act = useAction();
  const [budget, setBudget] = useState('');
  const [days, setDays] = useState('7');
  const [servings, setServings] = useState('');
  const [diet, setDiet] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const plan = data.plan;
  const byDay: Record<string, any[]> = {};
  for (const m of plan?.meals ?? []) (byDay[m.day] ??= []).push(m);

  const generate = async () => {
    const body: any = { days: Number(days) };
    if (budget) body.budget = Number(budget);
    if (servings) body.servings = Number(servings);
    if (diet) body.diet = diet;
    const ok = await act.run(async () => { const r: any = await api.post('/api/plan/generate', body); setNotes(r.fits ? [] : [`This budget is too low. The cheapest plan costs about ${fmt(cur, r.estTotal)} (${fmt(cur, r.shortfall)} over). Nothing was changed.`, ...r.notes]); });
    if (ok) reload();
  };

  return (
    <>
      <h1>Weekly plan</h1>
      <section className="card">
        <h2>Make a plan that fits the budget</h2>
        <div className="grid2">
          <label>Budget ({cur})<input inputMode="numeric" value={budget} onChange={e => setBudget(e.target.value)} placeholder="e.g. 1500" /></label>
          <label>Days<input inputMode="numeric" value={days} onChange={e => setDays(e.target.value)} /></label>
          <label>People<input inputMode="numeric" value={servings} onChange={e => setServings(e.target.value)} placeholder="household size" /></label>
          <label>Diet<select value={diet} onChange={e => setDiet(e.target.value)}><option value="">household default</option><option value="vegan">Vegan</option><option value="veg">Veg</option><option value="egg">Egg</option><option value="nonveg">Non-veg</option></select></label>
        </div>
        <div className="row" style={{ marginTop: 10 }}><button className="primary" disabled={act.busy} onClick={generate}>{act.busy ? 'Planning…' : 'Generate plan'}</button></div>
        {act.error && <p className="error">{act.error}</p>}
        {notes.map((n, i) => <p key={i} className="notice">{n}</p>)}
        <p className="muted small">Costs are computed from your price book and quantities, not guessed. Diet and allergy rules are applied by code before anything is shown.</p>
      </section>

      {!plan ? <p className="muted">No plan yet.</p> : (
        <>
          <section className="card">
            <div className="row between"><h2>Week of {dayLabel(plan.week_start)}</h2><span className={'pill' + (plan.status === 'approved' ? '' : ' warn')}>{plan.status}</span></div>
            <div className="row between"><span>Estimated total <b>{fmt(cur, plan.est_total)}</b> of {fmt(cur, plan.budget)}</span>
              {plan.status !== 'approved' && <button disabled={act.busy} onClick={async () => { await act.run(() => api.post(`/api/plan/${plan.id}/approve`)); reload(); }}>Approve plan</button>}</div>
            {data.vs && <p className="muted small">Cooked {data.vs.cooked} of {data.vs.planned} meals · bought items estimated {fmt(cur, data.vs.boughtEstimated)}, actual {fmt(cur, data.vs.boughtActual)}</p>}
            {plan.anyUnreviewed && <p className="notice small">Recipes and protein values are a draft starter set and have not been reviewed by a nutrition expert yet. General guidance only, not medical advice.</p>}
          </section>
          {Object.entries(byDay).map(([day, meals]) => (
            <section className="card" key={day}>
              <h2>{dayLabel(day)}</h2>
              <div className="list">
                {meals.map((m: any) => (
                  <div key={m.id} className="row between">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className={m.cooked_at ? 'done' : ''}><b style={{ textTransform: 'capitalize' }}>{m.slot}</b> · {m.recipe_name} {m.swapped && <span className="pill">swapped</span>}</div>
                      <div className="muted small">{fmt(cur, m.est_cost)} · {m.protein_g_per_serving} g protein/serving{m.cook_name ? ` · cook: ${m.cook_name}` : ''}</div>
                    </div>
                    <div className="row">
                      <button disabled={act.busy} onClick={async () => { await act.run(() => api.post(`/api/meals/${m.id}/swap`)); reload(); }}>Swap</button>
                      {!m.cooked_at && <button disabled={act.busy} onClick={async () => { await act.run(() => api.post(`/api/meals/${m.id}/cooked`)); reload(); }}>Cooked</button>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <p className="muted small">Swapping a meal updates only that meal's shopping items.</p>
        </>
      )}
    </>
  );
}
