import { q, one, type Db } from '../db/index.js';
import { audit, getHousehold, listMembers } from './households.js';
import { computeBalances, computeShares, suggestSettlements, toMajor, toMinor, KITTY, type SplitRule } from './money.js';
import { learnPrice } from './pricebook.js';
import { parseItemPhrase } from './items.js';
import { ValidationError, NotFoundError } from './scope.js';

export type PurchaseInput = {
  householdId: string; payerId: string; amount: number; date?: string; store?: string; note?: string;
  items?: { item: string; qty?: number | null; unit?: string | null; price?: number | null }[];
  split?: SplitRule; paidFrom?: 'member' | 'pool'; waMessageId?: string; actor?: string;
};

const today = async (db: Db, tz: string) => (await one<{ d: string }>(db, `select (now() at time zone $1)::date as d`, [tz]))!.d;

async function memberIds(db: Db, householdId: string) {
  return (await listMembers(db, householdId)).map(m => m.id);
}

/** Idempotent: a retried WhatsApp message id never double-counts. */
export async function recordPurchase(db: Db, p: PurchaseInput): Promise<{ id: string; duplicate: boolean }> {
  if (p.waMessageId) {
    const ex = await one<{ id: string }>(db, 'select id from purchases where wa_message_id=$1 and household_id=$2', [p.waMessageId, p.householdId]);
    if (ex) return { id: ex.id, duplicate: true };
  }
  const h = await getHousehold(db, p.householdId);
  const ids = await memberIds(db, p.householdId);
  if (!ids.includes(p.payerId)) throw new ValidationError('Payer is not in this household');
  if (!(p.amount > 0) || p.amount > 10_000_000) throw new ValidationError('Amount must be positive and reasonable');
  const total = toMinor(p.amount);
  const rule: SplitRule = p.split ?? { type: 'equal' };
  const shares = computeShares(total, rule, ids);
  const date = p.date ?? (await today(db, h.timezone));
  const row = (await q<{ id: string }>(db,
    `insert into purchases (household_id, payer_id, amount, date, store, note, paid_from, split_rule, wa_message_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [p.householdId, p.payerId, p.amount, date, p.store ?? null, p.note ?? null, p.paidFrom ?? 'member', JSON.stringify(rule), p.waMessageId ?? null]))[0];
  for (const [mid, v] of Object.entries(shares)) {
    await db.query('insert into purchase_shares (purchase_id, member_id, amount) values ($1,$2,$3)', [row.id, mid, toMajor(v)]);
  }
  for (const it of p.items ?? []) {
    const c = parseItemPhrase(it.item);
    const item = c.item, qty = it.qty ?? c.qty, unit = it.unit ?? c.unit;
    await db.query('insert into purchase_items (purchase_id, item, qty, unit, price) values ($1,$2,$3,$4,$5)', [row.id, item, qty, unit, it.price ?? null]);
    if (it.price && qty) await learnPrice(db, p.householdId, item, qty, unit, it.price);
  }
  await audit(db, p.householdId, p.actor ?? p.payerId, 'create', 'purchase', row.id, { amount: p.amount });
  return { id: row.id, duplicate: false };
}

export async function recordContribution(db: Db, o: { householdId: string; memberId: string; amount: number; date?: string; note?: string; waMessageId?: string; actor?: string }) {
  if (o.waMessageId) {
    const ex = await one<{ id: string }>(db, 'select id from contributions where wa_message_id=$1 and household_id=$2', [o.waMessageId, o.householdId]);
    if (ex) return { id: ex.id, duplicate: true };
  }
  const h = await getHousehold(db, o.householdId);
  if (!(await memberIds(db, o.householdId)).includes(o.memberId)) throw new ValidationError('Member is not in this household');
  if (!(o.amount > 0) || o.amount > 10_000_000) throw new ValidationError('Amount must be positive and reasonable');
  const date = o.date ?? (await today(db, h.timezone));
  const r = (await q<{ id: string }>(db, 'insert into contributions (household_id, member_id, amount, date, note, wa_message_id) values ($1,$2,$3,$4,$5,$6) returning id',
    [o.householdId, o.memberId, o.amount, date, o.note ?? null, o.waMessageId ?? null]))[0];
  await audit(db, o.householdId, o.actor ?? o.memberId, 'create', 'contribution', r.id, { amount: o.amount });
  return { id: r.id, duplicate: false };
}

export async function recordSettlement(db: Db, o: { householdId: string; from: string; to: string; amount: number; date?: string; waMessageId?: string; actor?: string }) {
  if (o.waMessageId) {
    const ex = await one<{ id: string }>(db, 'select id from settlements where wa_message_id=$1 and household_id=$2', [o.waMessageId, o.householdId]);
    if (ex) return { id: ex.id, duplicate: true };
  }
  const h = await getHousehold(db, o.householdId);
  const ids = await memberIds(db, o.householdId);
  if (!ids.includes(o.from) || !ids.includes(o.to) || o.from === o.to) throw new ValidationError('Invalid settlement parties');
  if (!(o.amount > 0)) throw new ValidationError('Amount must be positive');
  const date = o.date ?? (await today(db, h.timezone));
  const r = (await q<{ id: string }>(db, 'insert into settlements (household_id, from_member, to_member, amount, date, confirmed_at, wa_message_id) values ($1,$2,$3,$4,$5,now(),$6) returning id',
    [o.householdId, o.from, o.to, o.amount, date, o.waMessageId ?? null]))[0];
  await audit(db, o.householdId, o.actor ?? o.from, 'create', 'settlement', r.id, { amount: o.amount });
  return { id: r.id, duplicate: false };
}

/** Corrections keep an audit trail: records are voided, not deleted. */
export async function voidRecord(db: Db, householdId: string, kind: 'purchase' | 'contribution' | 'settlement', id: string, actor: string) {
  const table = kind === 'purchase' ? 'purchases' : kind === 'contribution' ? 'contributions' : 'settlements';
  const r = await db.query(`update ${table} set voided_at=now() where id=$1 and household_id=$2 and voided_at is null`, [id, householdId]);
  if (!r.rowCount) throw new NotFoundError('Record not found');
  await audit(db, householdId, actor, 'void', kind, id);
}

export async function undoLast(db: Db, householdId: string, actor: string): Promise<{ kind: string; amount: number } | null> {
  const last = await one<{ kind: string; id: string; amount: number }>(db,
    `select * from (
       select 'purchase' as kind, id, amount, created_at from purchases where household_id=$1 and voided_at is null
       union all select 'contribution', id, amount, created_at from contributions where household_id=$1 and voided_at is null
       union all select 'settlement', id, amount, created_at from settlements where household_id=$1 and voided_at is null
     ) x order by created_at desc limit 1`, [householdId]);
  if (!last) return null;
  await voidRecord(db, householdId, last.kind as any, last.id, actor);
  return { kind: last.kind, amount: last.amount };
}

export type MoneySummary = {
  currency: string; monthlyBudget: number; spentThisMonth: number; remaining: number | null; daysLeftInMonth: number;
  potBalance: number; perDayLeft: number | null;
  balances: { memberId: string; name: string; net: number }[];
  suggestions: { from: string; fromName: string; to: string; toName: string; amount: number }[];
};

/** Everything here is computed from saved data only. */
export async function moneySummary(db: Db, householdId: string): Promise<MoneySummary> {
  const h = await getHousehold(db, householdId);
  const members = await listMembers(db, householdId);
  const name = new Map(members.map(m => [m.id, m.name]));
  name.set(KITTY, 'Kitty (pooled cash)');
  // one after another: a transaction client runs a single query at a time
  const contribs = await q<{ member_id: string; amount: number }>(db, 'select member_id, amount from contributions where household_id=$1 and voided_at is null', [householdId]);
  const purchases = await q<{ id: string; payer_id: string; amount: number; paid_from: string }>(db, 'select id, payer_id, amount, paid_from from purchases where household_id=$1 and voided_at is null', [householdId]);
  const sett = await q<{ from_member: string; to_member: string; amount: number }>(db, 'select from_member, to_member, amount from settlements where household_id=$1 and voided_at is null', [householdId]);
  const shareRows = await q<{ purchase_id: string; member_id: string; amount: number }>(db,
    'select s.purchase_id, s.member_id, s.amount from purchase_shares s join purchases p on p.id=s.purchase_id where p.household_id=$1 and p.voided_at is null', [householdId]);
  const shareMap = new Map<string, Record<string, number>>();
  for (const s of shareRows) { const o = shareMap.get(s.purchase_id) ?? {}; o[s.member_id] = toMinor(s.amount); shareMap.set(s.purchase_id, o); }
  const net = computeBalances({
    members: members.map(m => m.id),
    contributions: contribs.map(c => ({ member: c.member_id, amount: toMinor(c.amount) })),
    purchases: purchases.map(p => ({ payer: p.payer_id, amount: toMinor(p.amount), paidFrom: p.paid_from as 'member' | 'pool', shares: shareMap.get(p.id) ?? {} })),
    settlements: sett.map(s => ({ from: s.from_member, to: s.to_member, amount: toMinor(s.amount) })),
  });
  const m = (await one<{ spent: number; days_left: number }>(db,
    `with t as (select (now() at time zone $2)::date as d)
     select coalesce((select sum(amount) from purchases, t where household_id=$1 and voided_at is null
                      and date >= date_trunc('month', t.d) and date < date_trunc('month', t.d) + interval '1 month'), 0) as spent,
            ((date_trunc('month', t.d) + interval '1 month')::date - t.d) as days_left from t`, [householdId, h.timezone]))!;
  const remaining = h.monthly_budget > 0 ? Math.round((h.monthly_budget - m.spent) * 100) / 100 : null;
  return {
    currency: h.currency, monthlyBudget: h.monthly_budget, spentThisMonth: m.spent, remaining, daysLeftInMonth: m.days_left,
    potBalance: toMajor(-(net[KITTY] ?? 0)),
    perDayLeft: remaining != null && m.days_left > 0 ? Math.round((remaining / m.days_left) * 100) / 100 : null,
    balances: Object.entries(net).filter(([id]) => id !== KITTY).map(([id, v]) => ({ memberId: id, name: name.get(id) ?? '?', net: toMajor(v) })),
    suggestions: suggestSettlements(net).map(t => ({ from: t.from, fromName: name.get(t.from) ?? '?', to: t.to, toName: name.get(t.to) ?? '?', amount: toMajor(t.amount) })),
  };
}

export async function listRecent(db: Db, householdId: string, limit = 20) {
  return q(db,
    `select * from (
       select 'purchase' as kind, p.id, m.name as who, p.amount, p.date, coalesce(p.note, p.store) as note, p.created_at, p.voided_at from purchases p join members m on m.id=p.payer_id where p.household_id=$1
       union all select 'contribution', c.id, m.name, c.amount, c.date, c.note, c.created_at, c.voided_at from contributions c join members m on m.id=c.member_id where c.household_id=$1
       union all select 'settlement', s.id, m.name, s.amount, s.date, null, s.created_at, s.voided_at from settlements s join members m on m.id=s.from_member where s.household_id=$1
     ) x order by created_at desc limit $2`, [householdId, limit]);
}
