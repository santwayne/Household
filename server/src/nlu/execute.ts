import type { PoolClient } from 'pg';
import { q, one } from '../db/index.js';
import { config } from '../config.js';
import { SUBSTITUTIONS } from '../domain/data.js';
import { audit, createInvite, deleteHousehold, deleteMemberData, listMembers, optIn, optOut, updateHousehold, type Household, type Member } from '../domain/households.js';
import { moneySummary, recordContribution, recordPurchase, recordSettlement, undoLast } from '../domain/ledger.js';
import { addItems, markBought, mergedList, removeItem } from '../domain/shopping.js';
import { generatePlan, getCurrentPlan, swapMeal } from '../domain/plans.js';
import { logMeal, weeklyBalance } from '../domain/health.js';
import { loadPrices } from '../domain/pricebook.js';
import { rankProteinPerRupee } from '../domain/protein.js';
import { createReminder, listReminders } from '../domain/reminders.js';
import { completeTask, listTasks, sundayReset } from '../domain/tasks.js';
import { issueToken } from '../http/auth.js';
import { ValidationError } from '../domain/scope.js';
import { t, money } from './i18n.js';
import type { Lang } from './lang.js';
import { resolveMember } from './names.js';
import type { Action } from './schema.js';
import { describeWhen, localDate, resolveWhen, weekday } from './tz.js';
import { canonicalItem } from '../domain/items.js';

export type Ctx = {
  db: PoolClient; h: Household; m: Member; members: Member[]; lang: Lang; msgId: string; now: Date;
  source: 'rules' | 'llm'; confirmed?: boolean;
};
export type Pending =
  | { step: 'confirm'; action: Action }
  | { step: 'who'; action: Action; field: 'payer' | 'member' | 'from' | 'to' }
  | { step: 'delete_confirm' }
  | { step: 'reminder_when'; text: string };
export type ExecResult = { replies: string[]; pending?: Pending | null; allowOptedOut?: boolean };

const names = (c: Ctx) => c.members.map(m => m.name).join(', ');
const itemsSuffix = (items?: string[] | null) => (items?.length ? ` (${items.join(', ')})` : '');
const R = (...replies: string[]): ExecResult => ({ replies });

export async function executeAction(c: Ctx, a: Action): Promise<ExecResult> {
  const { db, h, m, lang } = c;
  const mny = (n: number) => money(h.currency, n);

  const needWho = (field: 'payer' | 'member' | 'from' | 'to', name: string | null | undefined): ExecResult | Member => {
    const r = resolveMember(c.members, field === 'to' ? name ?? '' : name, m);
    if ('member' in r) return r.member;
    return { replies: [t(lang, 'who_paid_unclear', { names: names(c) })], pending: { step: 'who', action: a, field } };
  };

  switch (a.intent) {
    case 'record_purchase': {
      if (c.source === 'llm' && !c.confirmed && (a.needs_confirmation || a.confidence < 0.85)) {
        const w = needWho('payer', a.payer); if (!('id' in w)) return w;
        return { replies: [t(lang, 'purchase_confirm', { payer: w.name, amount: mny(a.amount!), items: itemsSuffix(a.items) })], pending: { step: 'confirm', action: a } };
      }
      const payer = needWho('payer', a.payer); if (!('id' in payer)) return payer;
      const before = await moneySummary(db, h.id);
      const r = await recordPurchase(db, { householdId: h.id, payerId: payer.id, amount: a.amount!, items: (a.items ?? []).map(item => ({ item })), store: a.store ?? undefined, waMessageId: c.msgId, actor: m.id });
      const s = await moneySummary(db, h.id);
      let text = s.remaining == null
        ? t(lang, 'purchase_saved_nobudget', { payer: payer.name, amount: mny(a.amount!), items: itemsSuffix(a.items) })
        : t(lang, 'purchase_saved', { payer: payer.name, amount: mny(a.amount!), items: itemsSuffix(a.items), remaining: mny(s.remaining) });
      if (!r.duplicate && h.monthly_budget > 0) {
        const pctBefore = Math.floor((before.spentThisMonth / h.monthly_budget) * 100), pctAfter = Math.floor((s.spentThisMonth / h.monthly_budget) * 100);
        const crossed = [100, 80].find(th => pctBefore < th && pctAfter >= th);
        if (crossed) text += '\n' + t(lang, 'budget_alert', { pct: crossed, remaining: mny(Math.max(0, s.remaining ?? 0)) });
      }
      return R(text);
    }
    case 'record_contribution': {
      const who = needWho('member', a.member); if (!('id' in who)) return who;
      await recordContribution(db, { householdId: h.id, memberId: who.id, amount: a.amount!, waMessageId: c.msgId, actor: m.id });
      const s = await moneySummary(db, h.id);
      return R(t(lang, 'contribution_saved', { member: who.name, amount: mny(a.amount!), pot: mny(s.potBalance) }));
    }
    case 'record_settlement': {
      const from = needWho('from', a.from); if (!('id' in from)) return from;
      const to = a.to ? needWho('to', a.to) : null;
      if (!to) return R(t(lang, 'who_paid_unclear', { names: names(c) }));
      if (!('id' in to)) return to;
      await recordSettlement(db, { householdId: h.id, from: from.id, to: to.id, amount: a.amount!, waMessageId: c.msgId, actor: m.id });
      return R(t(lang, 'settlement_saved', { from: from.name, to: to.name, amount: mny(a.amount!) }));
    }
    case 'add_items': {
      const added = await addItems(db, h.id, a.items!, m.id, c.msgId);
      return R(t(lang, 'items_added', { items: added.map(i => i.item + (i.qty ? ` ${i.qty}${i.unit ? ' ' + i.unit : ''}` : '')).join(', ') || a.items!.join(', ') }));
    }
    case 'mark_bought': {
      const ok: string[] = [], missing: string[] = [];
      for (const it of a.items!) {
        try { await markBought(db, h.id, it, m.id, a.items!.length === 1 ? a.amount : null); ok.push(canonicalItem(it)); } catch { missing.push(it); }
      }
      return R(...[ok.length ? t(lang, 'bought_ok', { items: ok.join(', ') }) : '', missing.length ? t(lang, 'not_on_list', { items: missing.join(', ') }) : ''].filter(Boolean));
    }
    case 'remove_items': {
      const ok: string[] = [], missing: string[] = [];
      for (const it of a.items!) { try { await removeItem(db, h.id, it); ok.push(it); } catch { missing.push(it); } }
      return R(...[ok.length ? t(lang, 'removed_ok', { items: ok.join(', ') }) : '', missing.length ? t(lang, 'not_on_list', { items: missing.join(', ') }) : ''].filter(Boolean));
    }
    case 'show_list': {
      const list = (await mergedList(db, h.id)).filter(i => i.status === 'open');
      if (!list.length) return R(t(lang, 'list_empty'));
      const total = list.reduce((s, i) => s + (i.estPrice ?? 0), 0);
      const lines = list.map(i => {
        const qty = i.toBuyQty != null ? (i.unit === 'g' && i.toBuyQty >= 1000 ? `${i.toBuyQty / 1000} kg` : i.unit === 'ml' && i.toBuyQty >= 1000 ? `${i.toBuyQty / 1000} l` : `${i.toBuyQty} ${i.unit ?? ''}`.trim()) : '';
        return `• ${i.item}${qty ? ' ' + qty : ''}${i.pantryQty ? ' (pantry mein hai)' : ''}`;
      });
      return R([t(lang, 'list_header', { total: mny(total) }), ...lines].join('\n'));
    }
    case 'budget_remaining': {
      const s = await moneySummary(db, h.id);
      return R(s.remaining == null ? t(lang, 'remaining_unset', { spent: mny(s.spentThisMonth) })
        : t(lang, 'remaining', { budget: mny(s.monthlyBudget), spent: mny(s.spentThisMonth), remaining: mny(s.remaining), days: s.daysLeftInMonth, perDay: mny(s.perDayLeft ?? 0) }));
    }
    case 'show_balances': {
      const s = await moneySummary(db, h.id);
      if (!s.suggestions.length) return R(t(lang, 'balances_even'));
      return R([t(lang, 'balances_header'), ...s.suggestions.map(x => t(lang, 'balance_line', { from: x.fromName, to: x.toName, amount: mny(x.amount) }))].join('\n'));
    }
    case 'set_budget': {
      const amount = (a.budget ?? a.amount)!;
      await updateHousehold(db, h.id, m.id, { monthly_budget: amount });
      return R(t(lang, 'budget_set', { budget: mny(amount) }));
    }
    case 'plan_week': {
      let budget = a.budget ?? undefined;
      const s = await moneySummary(db, h.id);
      if (!budget && s.remaining == null) return R(t(lang, 'need_budget'));
      try {
        const p = await generatePlan(db, h.id, { budget, days: a.days ?? 7, servings: a.people ?? undefined, diet: a.diet ?? undefined });
        if (!p.meals.length) return R(t(lang, 'plan_none'));
        if (!p.fits) return R(t(lang, 'plan_over', { total: mny(p.estTotal), short: mny(p.shortfall) }));
        const plan = (await getCurrentPlan(db, h.id))!;
        return R(planText(plan, lang, h.currency, { days: a.days ?? 7, servings: plan.servings, budget: mny(p.budget), total: mny(plan.est_total) }));
      } catch (e) { if (e instanceof ValidationError) return R(t(lang, 'need_budget')); throw e; }
    }
    case 'show_plan': {
      const plan = await getCurrentPlan(db, h.id);
      if (!plan) return R(t(lang, 'no_plan'));
      return R(planText(plan, lang, h.currency, { days: new Set(plan.meals.map((x: any) => x.day)).size, servings: plan.servings, budget: mny(plan.budget), total: mny(plan.est_total) }));
    }
    case 'show_today': {
      const plan = await getCurrentPlan(db, h.id);
      const today = localDate(h.timezone, c.now);
      const meals = plan?.meals.filter((x: any) => x.day === today) ?? [];
      if (!plan) return R(t(lang, 'no_plan'));
      if (!meals.length) return R(t(lang, 'today_none'));
      return R(t(lang, 'today_meals', { meals: meals.map((x: any) => `${x.slot}: ${x.recipe_name}${x.cook_name ? ` (${x.cook_name})` : ''}`).join('; ') }));
    }
    case 'swap_meal': {
      const plan = await getCurrentPlan(db, h.id);
      if (!plan) return R(t(lang, 'no_plan'));
      const today = localDate(h.timezone, c.now);
      const target = plan.meals.find((x: any) => {
        if (x.slot !== a.slot) return false;
        if (!a.day_name) return true;
        if (a.day_name === 'today') return x.day === today;
        if (a.day_name === 'tomorrow') return x.day > today && x.day <= localDate(h.timezone, new Date(c.now.getTime() + 86400000 * 1.5)) && x.day !== today;
        return weekday(x.day) === a.day_name;
      });
      if (!target) return R(t(lang, 'swap_fail'));
      try {
        const r = await swapMeal(db, h.id, target.id);
        return R(t(lang, 'swap_ok', { day: weekday(target.day).slice(0, 3), slot: target.slot, recipe: r.recipeName, cost: mny(r.estCost) }));
      } catch (e) { if (e instanceof ValidationError) return R(t(lang, 'swap_fail')); throw e; }
    }
    case 'log_meal': {
      await logMeal(db, { householdId: h.id, memberId: m.id, meal: a.text!, kind: a.kind ?? 'home', hasVegetables: a.has_vegetables ?? false, hasProtein: a.has_protein ?? false, waMessageId: c.msgId });
      return R(t(lang, 'meal_logged', { meal: a.text! }));
    }
    case 'weekly_balance': {
      const b = await weeklyBalance(db, h.id, m.id);
      return R([t(lang, 'balance_summary', { total: b.total, home: b.home, ordered: b.ordered, veg: b.withVeg, prot: b.withProtein }), ...b.tips.map(x => t(lang, `tip_${x.key}`))].join('\n'));
    }
    case 'protein_rank': {
      const rank = rankProteinPerRupee(await loadPrices(db, h.id, h.country)).slice(0, 6);
      return R([t(lang, 'protein_header'), ...rank.map((r, i) => `${i + 1}. ${r.item}: ${r.gramsProteinPerRupee} g/${h.currency === 'INR' ? '₹' : h.currency}`)].join('\n'));
    }
    case 'create_reminder': {
      const at = resolveWhen(a.when, h.timezone, c.now);
      if (!at) return { replies: [t(lang, 'reminder_when')], pending: { step: 'reminder_when', text: a.text! } };
      const r = await createReminder(db, { householdId: h.id, memberId: m.id, text: a.text!, dueAt: at, tz: h.timezone, waMessageId: c.msgId });
      if ('rejected' in r) return R(t(lang, 'reminder_rejected'));
      return R(t(lang, 'reminder_saved', { when: describeWhen(at, h.timezone, c.now), text: a.text! }));
    }
    case 'list_reminders': {
      const rs = await listReminders(db, h.id, m.id);
      return R(rs.length ? rs.map((r: any) => `• ${describeWhen(new Date(r.due_at), h.timezone, c.now)} ${r.text}`).join('\n') : t(lang, 'tasks_none'));
    }
    case 'substitution': {
      const key = (a.text ?? a.items?.[0] ?? '').toLowerCase();
      const hit = SUBSTITUTIONS.find(s => key.includes(s.missing) || s.missing.includes(key));
      return R(hit ? t(lang, 'sub_found', { item: hit.missing, use: hit.use }) : t(lang, 'sub_none', { item: key }));
    }
    case 'undo': {
      const u = await undoLast(db, h.id, m.id);
      return R(u ? t(lang, 'undo_ok', { kind: u.kind, amount: mny(u.amount) }) : t(lang, 'undo_none'));
    }
    case 'dashboard': {
      const token = await issueToken(db, m.id, 'link', config.loginLinkTtlMin);
      return R(t(lang, 'dashboard_link', { mins: config.loginLinkTtlMin, link: `${config.publicUrl}/auth?t=${token}` }));
    }
    case 'export_data': {
      const token = await issueToken(db, m.id, 'export', config.loginLinkTtlMin);
      return R(t(lang, 'export_link', { mins: config.loginLinkTtlMin, link: `${config.publicUrl}/api/export?t=${token}` }));
    }
    case 'invite': {
      const code = await createInvite(db, h.id, m.id);
      return R(t(lang, 'invite_created', { code, link: waLink(code) }));
    }
    case 'show_tasks': {
      const tasks = await listTasks(db, h.id);
      return R(tasks.length ? [t(lang, 'tasks_header'), ...tasks.map((x: any) => `• ${x.title}${x.owner_name ? ' → ' + x.owner_name : ''}`)].join('\n') : t(lang, 'tasks_none'));
    }
    case 'complete_task': {
      const mine = (await listTasks(db, h.id)).find((x: any) => x.owner_id === m.id);
      if (!mine) return R(t(lang, 'tasks_none'));
      await completeTask(db, h.id, mine.id);
      return R(t(lang, 'task_done', { title: mine.title }));
    }
    case 'sunday_reset': {
      const monday = localDate(h.timezone, c.now);
      const made = await sundayReset(db, h.id, monday);
      return R(t(lang, 'reset_done', { assignments: made.join('; ') }));
    }
    case 'stop': { await optOut(db, m.id); return { replies: [t(lang, 'opted_out')], allowOptedOut: true }; }
    case 'start': { await optIn(db, m.id); return R(t(lang, 'opted_in')); }
    case 'delete_data': return { replies: [t(lang, 'delete_confirm')], pending: { step: 'delete_confirm' } };
    case 'help': case 'greeting': return R(t(lang, 'help'));
    case 'yes': case 'no': return R(t(lang, 'help'));
    default: return R(t(lang, 'unknown'));
  }
}

export function waLink(code: string) {
  return `https://wa.me/${config.wa.businessNumber}?text=${encodeURIComponent('JOIN ' + code)}`;
}

function planText(plan: any, lang: Lang, currency: string, p: { days: number; servings: number; budget: string; total: string }): string {
  const byDay = new Map<string, string[]>();
  for (const m of plan.meals) {
    const arr = byDay.get(m.day) ?? [];
    arr.push(`${m.slot[0].toUpperCase()}: ${m.recipe_name}`);
    byDay.set(m.day, arr);
  }
  const lines = [...byDay.entries()].map(([d, ms]) => `${weekday(d).slice(0, 3)} — ${ms.join(' | ')}`);
  return [t(lang, 'plan_header', p), ...lines, t(lang, 'plan_footer', { total: p.total })].join('\n');
}

export async function confirmDelete(c: Ctx): Promise<ExecResult> {
  const members = await listMembers(c.db, c.h.id);
  const lang = c.lang;
  await audit(c.db, c.h.id, c.m.id, 'delete_request', 'member', c.m.id);
  if (members.filter(x => !x.phone.startsWith('deleted:')).length <= 1) await deleteHousehold(c.db, c.h.id);
  else await deleteMemberData(c.db, c.h.id, c.m.id);
  return { replies: [t(lang, 'deleted')], allowOptedOut: true };
}
