import { useState } from 'react';
import { api, fmt, qty } from '../api';
import { useApi, useAction } from './hooks';

export function Shopping({ me }: { me: any }) {
  const { data, error, reload } = useApi<any>('/api/shopping');
  const cur = me.household.currency;
  const act = useAction();
  const [text, setText] = useState('');
  const [price, setPrice] = useState<Record<string, string>>({});
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const open = data.items.filter((i: any) => i.status === 'open');
  const bought = data.items.filter((i: any) => i.status === 'bought');

  const add = async () => {
    const items = text.split(/,|\n| aur | and /i).map(s => s.trim()).filter(Boolean);
    if (!items.length) return;
    if (await act.run(() => api.post('/api/shopping', { items }))) { setText(''); reload(); }
  };
  return (
    <>
      <h1>Shopping list</h1>
      <section className="card">
        <label>Add items (comma separated, e.g. “2 kg rice, milk”)
          <div className="row" style={{ flexWrap: 'nowrap' }}><input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="milk, paneer…" /><button className="primary" disabled={act.busy} onClick={add}>Add</button></div>
        </label>
        {act.error && <p className="error">{act.error}</p>}
      </section>
      <section className="card">
        <div className="row between"><h2>To buy ({open.length})</h2><span className="muted small">est. {fmt(cur, data.estimatedOpen)}</span></div>
        {open.length ? <div className="list">{open.map((i: any) => (
          <div key={i.item + i.unit}>
            <div className="row between">
              <div><b>{i.item}</b> <span className="muted">{qty(i.toBuyQty, i.unit)}</span>{i.pantryQty ? <span className="pill"> {qty(i.pantryQty, i.unit)} in pantry</span> : null}
                <div className="muted small">{i.estPrice != null ? `est. ${fmt(cur, i.estPrice)}` : 'no price yet'}{i.mealIds.length ? ' · from plan' : ''}</div></div>
              <div className="row">
                <select aria-label={`Buyer for ${i.item}`} value={i.assignedTo ?? ''} onChange={async e => { await act.run(() => api.post('/api/shopping/assign', { item: i.item, memberId: e.target.value || null })); reload(); }} style={{ width: 'auto' }}>
                  <option value="">Anyone</option>{data.members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <input aria-label={`Actual price for ${i.item}`} inputMode="decimal" placeholder="actual price (optional)" value={price[i.item] ?? ''} onChange={e => setPrice({ ...price, [i.item]: e.target.value })} style={{ maxWidth: 190 }} />
              <button className="primary" disabled={act.busy} onClick={async () => { const p = Number(price[i.item]); await act.run(() => api.post('/api/shopping/bought', { item: i.item, price: p > 0 ? p : null })); reload(); }}>Bought</button>
              <button className="ghost" disabled={act.busy} onClick={async () => { await act.run(() => api.post('/api/shopping/remove', { item: i.item })); reload(); }}>Remove</button>
            </div>
          </div>))}</div> : <p className="muted">Nothing to buy.</p>}
        <p className="muted small">Entering the actual price teaches your household price book, so future estimates get closer to real prices.</p>
      </section>
      {bought.length > 0 && <section className="card"><h2>Bought</h2><div className="list">{bought.map((i: any) => <div key={i.item + i.unit} className="row between"><span className="done">{i.item} {qty(i.qty, i.unit)}</span><span className="muted">{i.actualPrice != null ? fmt(cur, i.actualPrice) : ''}</span></div>)}</div></section>}
    </>
  );
}
