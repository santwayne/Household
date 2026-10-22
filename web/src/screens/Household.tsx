import { useState } from 'react';
import { api, fmt } from '../api';
import { useApi, useAction } from './hooks';

const ALLERGENS = ['dairy', 'gluten', 'peanut', 'soy', 'egg', 'fish', 'sesame', 'mustard'];

export function Household({ me, reloadMe }: { me: any; reloadMe: () => void }) {
  const { data, error, reload } = useApi<any>('/api/household');
  const tasks = useApi<any[]>('/api/tasks');
  const pantry = useApi<any[]>('/api/pantry');
  const act = useAction();
  const [invite, setInvite] = useState<{ code: string; link: string } | null>(null);
  const [task, setTask] = useState(''); const [pi, setPi] = useState(''); const [pq, setPq] = useState(''); const [pu, setPu] = useState('g'); const [pb, setPb] = useState('');
  const [confirmName, setConfirmName] = useState('');
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const h = data.household; const admin = data.me.role === 'admin';
  const save = (patch: any) => act.run(async () => { await api.patch('/api/household', patch); await reload(); await reloadMe(); });
  const toggleAllergen = (a: string) => save({ allergens: h.allergens.includes(a) ? h.allergens.filter((x: string) => x !== a) : [...h.allergens, a] });

  return (
    <>
      <h1>Household</h1>
      <section className="card">
        <h2>Members</h2>
        <div className="list">{data.members.map((m: any) => <div key={m.id} className="row between"><span>{m.name} {m.role === 'admin' && <span className="pill">admin</span>} {m.optedOut && <span className="pill warn">opted out</span>}</span><span className="muted small">{m.language ?? 'household language'}</span></div>)}</div>
        <div className="row" style={{ marginTop: 10 }}>
          <button onClick={async () => { await act.run(async () => setInvite(await api.post('/api/invites'))); }}>Invite a flatmate</button>
        </div>
        {invite && <p className="notice">Ask them to send <b>JOIN {invite.code}</b> to the WhatsApp number, or share this link: <br /><a href={invite.link}>{invite.link}</a><br /><span className="muted small">They must message first and agree before the bot talks to them. Valid 7 days.</span></p>}
      </section>

      <section className="card">
        <h2>Settings {!admin && <span className="muted small">(admin only)</span>}</h2>
        <div className="grid2">
          <label>Household name<input defaultValue={h.name} disabled={!admin} onBlur={e => e.target.value !== h.name && save({ name: e.target.value })} /></label>
          <label>Living setup<select value={h.living_type} disabled={!admin} onChange={e => save({ living_type: e.target.value })}><option value="solo">Solo</option><option value="shared_flat">Shared flat</option><option value="pg_hostel">PG / hostel</option><option value="shared_room">Shared room</option><option value="family">Family</option></select></label>
          <label>Diet<select value={h.diet} disabled={!admin} onChange={e => save({ diet: e.target.value })}><option value="vegan">Vegan</option><option value="veg">Veg</option><option value="egg">Egg</option><option value="nonveg">Non-veg</option></select></label>
          <label>Language<select value={h.language} disabled={!admin} onChange={e => save({ language: e.target.value })}><option value="hinglish">Hinglish</option><option value="en">English</option><option value="hi">Hindi</option><option value="pa">Punjabi</option></select></label>
          <label>Home-region food<select value={h.region} disabled={!admin} onChange={e => save({ region: e.target.value })}>{['north', 'punjabi', 'gujarati', 'south', 'bengali', 'maharashtrian', 'general'].map(r => <option key={r}>{r}</option>)}</select></label>
          <label>Max cooking time (min)<input inputMode="numeric" defaultValue={h.cooking_minutes_max} disabled={!admin} onBlur={e => Number(e.target.value) !== h.cooking_minutes_max && save({ cooking_minutes_max: Number(e.target.value) })} /></label>
          <label>Currency<input defaultValue={h.currency} disabled={!admin} maxLength={3} onBlur={e => e.target.value.toUpperCase() !== h.currency && e.target.value.length === 3 && save({ currency: e.target.value.toUpperCase() })} /></label>
          <label>Time zone<input defaultValue={h.timezone} disabled={!admin} onBlur={e => e.target.value !== h.timezone && save({ timezone: e.target.value })} /></label>
        </div>
        <h3 style={{ marginTop: 12 }}>Allergies (always excluded from suggestions)</h3>
        <div className="row" style={{ marginTop: 6 }}>{ALLERGENS.map(a => <button key={a} disabled={!admin || act.busy} className={h.allergens.includes(a) ? 'primary' : ''} onClick={() => toggleAllergen(a)}>{a}</button>)}</div>
        <h3 style={{ marginTop: 12 }}>Kitchen</h3>
        <div className="row" style={{ marginTop: 6 }}>{['stove', 'pressure cooker', 'microwave', 'oven', 'rice cooker'].map(k => {
          const on = h.cooking_equipment.includes(k);
          return <button key={k} disabled={!admin || act.busy} className={on ? 'primary' : ''} onClick={() => save({ cooking_equipment: on ? h.cooking_equipment.filter((x: string) => x !== k) : [...h.cooking_equipment, k] })}>{k}</button>;
        })}</div>
        {act.error && <p className="error">{act.error}</p>}
      </section>

      <section className="card">
        <div className="row between"><h2>Tasks</h2><button disabled={act.busy} onClick={async () => { await act.run(() => api.post('/api/tasks/reset')); tasks.reload(); }}>Sunday reset</button></div>
        <div className="list">{(tasks.data ?? []).map((t: any) => <div key={t.id} className="row between"><span>{t.title} <span className="muted">→ {t.owner_name ?? 'unassigned'}</span></span><button disabled={act.busy} onClick={async () => { await act.run(() => api.post(`/api/tasks/${t.id}/done`)); tasks.reload(); }}>Done</button></div>)}
          {(tasks.data ?? []).length === 0 && <p className="muted">No open tasks.</p>}</div>
        <div className="row" style={{ marginTop: 8, flexWrap: 'nowrap' }}><input value={task} onChange={e => setTask(e.target.value)} placeholder="Cook dinner Monday" /><button disabled={!task.trim() || act.busy} onClick={async () => { if (await act.run(() => api.post('/api/tasks', { title: task, ownerId: me.member.id }))) { setTask(''); tasks.reload(); } }}>Add</button></div>
      </section>

      <section className="card">
        <h2>Pantry &amp; leftovers</h2>
        <div className="list">{(pantry.data ?? []).map((p: any) => <div key={p.id} className="row between"><span>{p.item} <span className="muted">{p.qty} {p.unit}{p.best_before ? ` · best before ${String(p.best_before).slice(0, 10)}` : ''}{p.is_leftover ? ' · leftover' : ''}</span></span><button className="ghost" onClick={async () => { await act.run(() => api.del(`/api/pantry/${p.id}`)); pantry.reload(); }}>Remove</button></div>)}
          {(pantry.data ?? []).length === 0 && <p className="muted">Nothing recorded. Items here are subtracted from the shopping list when units match.</p>}</div>
        <div className="grid2" style={{ marginTop: 8 }}>
          <label>Item<input value={pi} onChange={e => setPi(e.target.value)} placeholder="rice" /></label>
          <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'end' }}><label style={{ flex: 1 }}>Qty<input inputMode="decimal" value={pq} onChange={e => setPq(e.target.value)} /></label>
            <label style={{ width: 90 }}>Unit<select value={pu} onChange={e => setPu(e.target.value)}><option>g</option><option>kg</option><option>ml</option><option>l</option><option>piece</option></select></label></div>
          <label>Best before (optional)<input type="date" value={pb} onChange={e => setPb(e.target.value)} /></label>
          <div className="row" style={{ alignItems: 'end' }}><button disabled={!pi.trim() || !(Number(pq) > 0) || act.busy} onClick={async () => { if (await act.run(() => api.post('/api/pantry', { item: pi, qty: Number(pq), unit: pu, bestBefore: pb || null }))) { setPi(''); setPq(''); setPb(''); pantry.reload(); } }}>Add to pantry</button></div>
        </div>
      </section>

      <section className="card">
        <h2>Privacy &amp; your data</h2>
        <p className="muted">We keep your name, phone, household records and messages only to run this service. Your meal log is private by default.</p>
        <div className="row">
          <a href="/api/export"><button>Download my data</button></a>
          <button className="danger" disabled={act.busy} onClick={async () => { if (confirm('Erase your personal data (name, phone, meal logs, reminders)? Shared expense records stay under an anonymised name.')) { await act.run(() => api.del('/api/members/me')); location.reload(); } }}>Erase my personal data</button>
        </div>
        {admin && (
          <div style={{ marginTop: 14 }}>
            <h3>Delete the whole household</h3>
            <p className="muted small">Removes every record permanently. Type “{h.name}” to confirm.</p>
            <div className="row"><input value={confirmName} onChange={e => setConfirmName(e.target.value)} style={{ maxWidth: 240 }} aria-label="Confirm household name" /><button className="danger" disabled={confirmName !== h.name || act.busy} onClick={async () => { await act.run(() => api.del('/api/household', { confirmName })); location.reload(); }}>Delete household</button></div>
          </div>
        )}
        <div className="row" style={{ marginTop: 14 }}><button className="ghost" onClick={async () => { await api.post('/api/logout'); location.reload(); }}>Sign out</button></div>
      </section>
      <p className="muted small">Budget plan {fmt(h.currency, h.monthly_budget)} per month. Recipes and nutrition values are a draft starter set pending expert review.</p>
    </>
  );
}
