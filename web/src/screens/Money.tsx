import { useState } from 'react';
import { api, fmt } from '../api';
import { useApi, useAction } from './hooks';

export function Money({ me }: { me: any }) {
  const { data, error, reload } = useApi<any>('/api/money');
  const cur = me.household.currency;
  const act = useAction();
  const [amount, setAmount] = useState(''); const [payer, setPayer] = useState(''); const [note, setNote] = useState('');
  const [paidFrom, setPaidFrom] = useState('member'); const [kind, setKind] = useState('purchase'); const [budget, setBudget] = useState('');
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const s = data.summary;

  const submit = async () => {
    const a = Number(amount); if (!(a > 0)) return;
    const ok = await act.run(() => kind === 'purchase'
      ? api.post('/api/money/purchase', { amount: a, payerId: payer || undefined, note: note || undefined, paidFrom })
      : api.post('/api/money/contribution', { amount: a, memberId: payer || undefined, note: note || undefined }));
    if (ok) { setAmount(''); setNote(''); reload(); }
  };
  return (
    <>
      <h1>Money</h1>
      <section className="card">
        <h2>Budget</h2>
        <p style={{ margin: 0 }}>{s.remaining == null ? <span className="muted">No monthly budget set.</span> : <><b className="big">{fmt(cur, s.remaining)}</b> <span className="muted">left of {fmt(cur, s.monthlyBudget)}</span></>}</p>
        <p className="muted small">Spent this month {fmt(cur, s.spentThisMonth)} · kitty cash {fmt(cur, s.potBalance)}. The budget is a plan, not money received.</p>
        <div className="row"><input aria-label="Monthly budget" inputMode="numeric" placeholder="Monthly budget" value={budget} onChange={e => setBudget(e.target.value)} style={{ maxWidth: 180 }} />
          <button disabled={act.busy || !(Number(budget) >= 0 && budget)} onClick={async () => { await act.run(() => api.put('/api/money/budget', { monthly_budget: Number(budget) })); setBudget(''); reload(); }}>Set budget</button></div>
      </section>

      <section className="card">
        <h2>Who owes whom</h2>
        {s.suggestions.length ? <div className="list">{s.suggestions.map((x: any, i: number) => (
          <div key={i} className="row between">
            <span><b>{x.fromName}</b> → <b>{x.toName}</b></span>
            <span className="row"><b>{fmt(cur, x.amount)}</b>
              {x.from !== 'kitty' && x.to !== 'kitty' && <button disabled={act.busy} onClick={async () => { await act.run(() => api.post('/api/money/settlement', { from: x.from, to: x.to, amount: x.amount })); reload(); }}>Mark settled</button>}</span>
          </div>))}</div> : <p className="muted">Everyone is settled up.</p>}
        <p className="muted small">This app only records balances. It never holds or moves money.</p>
        <div className="list">{s.balances.map((b: any) => <div key={b.memberId} className="row between"><span>{b.name}</span><span className={b.net >= 0 ? 'pos' : 'neg'}>{b.net >= 0 ? 'is owed ' : 'owes '}{fmt(cur, Math.abs(b.net))}</span></div>)}</div>
      </section>

      <section className="card">
        <h2>Add an entry</h2>
        <div className="grid2">
          <label>Type<select value={kind} onChange={e => setKind(e.target.value)}><option value="purchase">Purchase (split equally)</option><option value="contribution">Contribution to kitty</option></select></label>
          <label>Amount ({cur})<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label>
          <label>{kind === 'purchase' ? 'Paid by' : 'Put in by'}<select value={payer} onChange={e => setPayer(e.target.value)}><option value="">Me</option>{data.members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          {kind === 'purchase' ? <label>Paid from<select value={paidFrom} onChange={e => setPaidFrom(e.target.value)}><option value="member">Own pocket</option><option value="pool">Kitty</option></select></label> : <span />}
        </div>
        <label style={{ marginTop: 10 }}>Note<input value={note} onChange={e => setNote(e.target.value)} placeholder="sabzi mandi" /></label>
        <div className="row" style={{ marginTop: 10 }}><button className="primary" disabled={act.busy || !(Number(amount) > 0)} onClick={submit}>Save</button></div>
        {act.error && <p className="error">{act.error}</p>}
      </section>

      <section className="card">
        <h2>History</h2>
        {data.recent.length ? <div className="list">{data.recent.map((r: any) => (
          <div key={r.kind + r.id} className="row between" style={r.voided_at ? { opacity: .5 } : undefined}>
            <span style={r.voided_at ? { textDecoration: 'line-through' } : undefined}><span className="pill">{r.kind}</span> {r.who}{r.note ? <span className="muted"> · {r.note}</span> : null}<div className="muted small">{r.date}</div></span>
            <span className="row"><b>{fmt(cur, r.amount)}</b>{!r.voided_at && <button className="ghost" disabled={act.busy} onClick={async () => { if (confirm('Void this entry? It stays in the audit trail.')) { await act.run(() => api.post('/api/money/void', { kind: r.kind, id: r.id })); reload(); } }}>Void</button>}</span>
          </div>))}</div> : <p className="muted">No entries yet.</p>}
      </section>
    </>
  );
}
