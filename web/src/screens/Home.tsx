import { api, dayLabel, fmt } from '../api';
import { useApi, useAction } from './hooks';

export function Home({ me, go }: { me: any; go: (t: any) => void }) {
  const { data, error, reload } = useApi<any>('/api/home');
  const act = useAction();
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const { money: m, household } = data, cur = household.currency;
  const pct = m.monthlyBudget > 0 ? Math.min(100, (m.spentThisMonth / m.monthlyBudget) * 100) : 0;
  return (
    <>
      <h1>Hi {me.member.name}</h1>
      <p className="muted" style={{ margin: 0 }}>{household.name}</p>

      <section className="card">
        <div className="row between"><h2>Food budget this month</h2><button className="ghost" onClick={() => go('money')}>Money →</button></div>
        {m.remaining == null ? (
          <p className="muted">No monthly budget set yet. Set one on the Money tab to see what is left.</p>
        ) : (
          <>
            <div className="big">{fmt(cur, m.remaining)} <span className="muted small">left</span></div>
            <div className={'bar' + (m.remaining < 0 ? ' over' : '')} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: pct + '%' }} /></div>
            <p className="muted small">Spent {fmt(cur, m.spentThisMonth)} of {fmt(cur, m.monthlyBudget)} · {m.daysLeftInMonth} days left{m.perDayLeft != null ? ` · about ${fmt(cur, m.perDayLeft)}/day` : ''}</p>
          </>
        )}
      </section>

      <section className="card">
        <div className="row between"><h2>Today's meals</h2><button className="ghost" onClick={() => go('plan')}>Plan →</button></div>
        {data.todayMeals.length ? (
          <div className="list">{data.todayMeals.map((x: any) => (
            <div key={x.id} className="row between"><span><b style={{ textTransform: 'capitalize' }}>{x.slot}</b> · {x.recipe_name}{x.cook_name ? <span className="muted"> ({x.cook_name})</span> : null}</span><span className="muted">{fmt(cur, x.est_cost)}</span></div>
          ))}</div>
        ) : <p className="muted">Nothing planned for today. Make a plan that fits your budget on the Plan tab.</p>}
      </section>

      <section className="card">
        <div className="row between"><h2>To buy ({data.pendingCount})</h2><button className="ghost" onClick={() => go('shop')}>Shopping →</button></div>
        {data.pendingItems.length ? (
          <div className="list">{data.pendingItems.map((i: any) => (
            <div key={i.item + i.unit} className="row between"><span>{i.item}{i.toBuyQty != null ? <span className="muted"> · {i.toBuyQty}{i.unit ? ' ' + i.unit : ''}</span> : null}</span>
              <button disabled={act.busy} onClick={async () => { await act.run(() => api.post('/api/shopping/bought', { item: i.item })); reload(); }}>Bought</button></div>
          ))}</div>
        ) : <p className="muted">The list is empty.</p>}
      </section>

      {data.openTasks.length > 0 && (
        <section className="card"><h2>Open tasks</h2><div className="list">{data.openTasks.map((t: any) => <div key={t.id} className="row between"><span>{t.title}</span><span className="muted">{t.owner_name ?? 'unassigned'}</span></div>)}</div></section>
      )}

      <section className="card">
        <h2>Recent activity</h2>
        {data.recent.length ? <div className="list">{data.recent.map((r: any) => (
          <div key={r.kind + r.id} className="row between" style={r.voided_at ? { opacity: .5, textDecoration: 'line-through' } : undefined}>
            <span><span className="pill">{r.kind}</span> {r.who}{r.note ? <span className="muted"> · {r.note}</span> : null}</span><b>{fmt(cur, r.amount)}</b>
          </div>))}</div> : <p className="muted">No entries yet. Send "Aman ne 650 ka saman liya" on WhatsApp, or add one on the Money tab.</p>}
      </section>
      {act.error && <p className="error">{act.error}</p>}
      <p className="muted small">{dayLabel(new Date().toISOString().slice(0, 10))}</p>
    </>
  );
}
