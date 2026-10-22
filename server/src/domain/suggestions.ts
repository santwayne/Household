import { q, type Db } from '../db/index.js';
import { getHousehold } from './households.js';
import { moneySummary } from './ledger.js';
import { cookFromPantry, getCurrentPlan } from './plans.js';
import { mergedList } from './shopping.js';
import { expiringSoon } from './pantry.js';
import { localDate, weekday } from '../nlu/tz.js';

export type Suggestion = { key: string; params: Record<string, string | number>; priority: number };

/**
 * "What should we do next?" Plain rules over this household's own saved data (no AI, nothing leaves the household).
 * Highest priority first, at most `limit`.
 */
export async function getSuggestions(db: Db, householdId: string, now = new Date(), limit = 4): Promise<Suggestion[]> {
  const h = await getHousehold(db, householdId);
  const out: Suggestion[] = [];
  const today = localDate(h.timezone, now);
  const money = await moneySummary(db, householdId);
  const plan = await getCurrentPlan(db, householdId);

  if (!(h.monthly_budget > 0)) out.push({ key: 'no_budget', params: {}, priority: 100 });

  const lastMealDay = plan?.meals.length ? plan.meals.map((m: any) => m.day as string).sort().pop()! : null;
  if (h.monthly_budget > 0 && (!plan || (lastMealDay && lastMealDay < today))) out.push({ key: 'no_plan', params: {}, priority: 90 });
  if (plan && plan.status === 'draft' && lastMealDay && lastMealDay >= today) out.push({ key: 'approve_plan', params: {}, priority: 70 });

  if (h.monthly_budget > 0) {
    const [y, mo] = today.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const dayOfMonth = Number(today.split('-')[2]);
    const monthPct = Math.round((dayOfMonth / daysInMonth) * 100);
    const spentPct = Math.round((money.spentThisMonth / h.monthly_budget) * 100);
    if (spentPct >= 30 && spentPct > monthPct + 15) out.push({ key: 'budget_pace', params: { spentPct, monthPct, remaining: money.remaining ?? 0 }, priority: 80 });
  }

  const expiring = await expiringSoon(db, householdId, 2);
  if (expiring.length) {
    const ideas = await cookFromPantry(db, householdId, 1);
    out.push({ key: 'use_expiring', params: { items: expiring.map((e: any) => e.item).join(', '), idea: ideas[0] ? `Idea: ${ideas[0].name}.` : '' }, priority: 85 });
  }

  const big = money.suggestions.filter(s => s.from !== 'kitty' && s.to !== 'kitty').sort((a, b) => b.amount - a.amount)[0];
  if (big && big.amount >= Math.max(200, h.monthly_budget * 0.1)) out.push({ key: 'settle_up', params: { from: big.fromName, to: big.toName, amount: big.amount }, priority: 60 });

  const [overdue] = await q<{ n: number }>(db, `select count(*)::int as n from tasks where household_id=$1 and status='open' and due_at is not null and due_at < $2`, [householdId, now]);
  if (overdue.n > 0) out.push({ key: 'tasks_overdue', params: { n: overdue.n }, priority: 65 });

  const open = (await mergedList(db, householdId)).filter(i => i.status === 'open');
  const unassigned = open.filter(i => !i.assignedTo);
  if (unassigned.length >= 5) out.push({ key: 'assign_buyer', params: { n: unassigned.length }, priority: 50 });

  if (weekday(today) === 'sunday') {
    const [t] = await q<{ n: number }>(db, `select count(*)::int as n from tasks where household_id=$1 and status='open'`, [householdId]);
    if (t.n === 0) out.push({ key: 'sunday_reset', params: {}, priority: 55 });
  }
  return out.sort((a, b) => b.priority - a.priority).slice(0, limit);
}
