import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { pool, q, one, tx } from '../db/index.js';
import { consumeToken, endSession, sessionMember, startSession } from './auth.js';
import { audit, createInvite, deleteHousehold, deleteMemberData, exportData, getHousehold, listMembers, updateHousehold, updateMember } from '../domain/households.js';
import { listRecent, moneySummary, recordContribution, recordPurchase, recordSettlement, voidRecord } from '../domain/ledger.js';
import { addItems, assignItem, markBought, mergedList, removeItem } from '../domain/shopping.js';
import { approvePlan, generatePlan, getCurrentPlan, markCooked, plannedVsActual, swapMeal } from '../domain/plans.js';
import { listMyLogs, logMeal, setLogShared, sharedSummary, weeklyBalance } from '../domain/health.js';
import { completeTask, createTask, listTasks, sundayReset, swapTaskOwner } from '../domain/tasks.js';
import { listPantry, removePantry, setPantry } from '../domain/pantry.js';
import { loadPrices, setPrice } from '../domain/pricebook.js';
import { rankProteinPerRupee } from '../domain/protein.js';
import { MoneyError } from '../domain/money.js';
import { NotFoundError, ValidationError, ConsentError } from '../domain/scope.js';
import { localDate } from '../nlu/tz.js';
import { waLink } from '../nlu/execute.js';
import { pilotMetrics } from './pilot.js';
import { SUBSTITUTIONS } from '../domain/data.js';

declare module 'fastify' { interface FastifyRequest { auth?: { id: string; household_id: string; name: string; role: string } } }

const COOKIE = 'sl_session';
const splitSchema = z.union([
  z.object({ type: z.literal('equal'), members: z.array(z.string().uuid()).optional() }),
  z.object({ type: z.literal('custom'), shares: z.record(z.string().uuid(), z.number().min(0)) }),
  z.object({ type: z.literal('percent'), percents: z.record(z.string().uuid(), z.number().min(0)) }),
]);

export function registerApi(app: FastifyInstance) {
  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof z.ZodError) return reply.code(400).send({ error: 'invalid_input', details: err.issues.map(i => `${i.path.join('.')}: ${i.message}`) });
    if (err instanceof MoneyError || err instanceof ValidationError) return reply.code(400).send({ error: err.message });
    if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
    if (err instanceof ConsentError) return reply.code(403).send({ error: err.message });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: err.message });
    app.log.error(err);
    return reply.code(500).send({ error: 'internal_error' });
  });

  // ---- auth: one-time WhatsApp link -> session cookie
  app.get('/auth', async (req, reply) => {
    const t = (req.query as any).t as string | undefined;
    const row = t ? await consumeToken(pool, t, 'link') : undefined;
    if (!row) return reply.code(400).type('text/html').send('<p>This login link is invalid, expired or already used. Send "dashboard" to the WhatsApp bot for a new one.</p>');
    const session = await startSession(pool, row.member_id);
    reply.setCookie(COOKIE, session, { httpOnly: true, sameSite: 'lax', secure: config.publicUrl.startsWith('https'), path: '/', maxAge: config.sessionTtlDays * 86400 });
    return reply.redirect('/');
  });
  app.post('/api/logout', async (req, reply) => {
    const c = (req.cookies as any)?.[COOKIE]; if (c) await endSession(pool, c);
    reply.clearCookie(COOKIE, { path: '/' }); return { ok: true };
  });
  // Token download for "export my data" sent over WhatsApp
  app.get('/api/export', async (req, reply) => {
    const t = (req.query as any).t as string | undefined;
    if (t) {
      const row = await consumeToken(pool, t, 'export');
      if (!row) return reply.code(400).send({ error: 'invalid_or_expired' });
      const m = (await one<{ household_id: string }>(pool, 'select household_id from members where id=$1', [row.member_id]))!;
      return reply.header('content-disposition', 'attachment; filename="my-data.json"').send(await exportData(pool, m.household_id, row.member_id));
    }
    const a = await requireAuth(req, reply); if (!a) return;
    return reply.header('content-disposition', 'attachment; filename="my-data.json"').send(await exportData(pool, a.household_id, a.id));
  });

  // Everything below needs a session. The household id ALWAYS comes from the session, never from the URL or body.
  async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
    const a = await sessionMember(pool, (req.cookies as any)?.[COOKIE]);
    if (!a) { reply.code(401).send({ error: 'login_required' }); return null; }
    req.auth = a; return a;
  }
  const authed = (fn: (a: NonNullable<FastifyRequest['auth']>, req: FastifyRequest, reply: FastifyReply) => Promise<unknown>) =>
    async (req: FastifyRequest, reply: FastifyReply) => { const a = await requireAuth(req, reply); if (!a) return; return fn(a, req, reply); };
  const adminOnly = (a: { role: string }) => { if (a.role !== 'admin') throw new ConsentError('Only a household admin can do this'); };

  app.get('/api/me', authed(async (a) => {
    const h = await getHousehold(pool, a.household_id);
    return { member: { id: a.id, name: a.name, role: a.role }, household: h };
  }));

  app.get('/api/home', authed(async (a) => {
    const h = await getHousehold(pool, a.household_id);
    const plan = await getCurrentPlan(pool, a.household_id);
    const today = localDate(h.timezone, new Date());
    const list = (await mergedList(pool, a.household_id)).filter(i => i.status === 'open');
    return {
      household: { name: h.name, currency: h.currency }, money: await moneySummary(pool, a.household_id),
      todayMeals: plan?.meals.filter((m: any) => m.day === today) ?? [], pendingItems: list.slice(0, 8), pendingCount: list.length,
      openTasks: (await listTasks(pool, a.household_id)).slice(0, 5), recent: await listRecent(pool, a.household_id, 6),
    };
  }));

  // ---- weekly plan
  app.get('/api/plan', authed(async (a) => ({ plan: await getCurrentPlan(pool, a.household_id), vs: await plannedVsActual(pool, a.household_id) })));
  app.post('/api/plan/generate', authed(async (a, req) => {
    const b = z.object({ budget: z.number().positive().optional(), days: z.number().int().min(1).max(14).optional(), servings: z.number().int().min(1).max(30).optional(), diet: z.enum(['vegan', 'veg', 'egg', 'nonveg']).optional(), slots: z.array(z.enum(['breakfast', 'lunch', 'dinner'])).min(1).optional() }).parse(req.body ?? {});
    const r = await tx(db => generatePlan(db, a.household_id, { ...b, actor: a.id }));
    return { ...r, plan: await getCurrentPlan(pool, a.household_id) };
  }));
  app.post('/api/plan/:id/approve', authed(async (a, req) => { await approvePlan(pool, a.household_id, (req.params as any).id); return { ok: true }; }));
  app.post('/api/meals/:id/swap', authed(async (a, req) => {
    const b = z.object({ recipeId: z.string().optional() }).parse(req.body ?? {});
    return tx(db => swapMeal(db, a.household_id, (req.params as any).id, b.recipeId));
  }));
  app.post('/api/meals/:id/cooked', authed(async (a, req) => {
    const b = z.object({ rating: z.number().int().min(1).max(5).optional() }).parse(req.body ?? {});
    await markCooked(pool, a.household_id, (req.params as any).id, b.rating); return { ok: true };
  }));
  app.get('/api/recipes', authed(async () => q(pool, 'select id, name, region, diet_tags, allergens, protein_g_per_serving, prep_minutes, reviewed from recipes order by name')));
  app.get('/api/substitutions', authed(async () => SUBSTITUTIONS));

  // ---- shopping
  app.get('/api/shopping', authed(async (a) => {
    const list = await mergedList(pool, a.household_id);
    return { items: list, estimatedOpen: list.filter(i => i.status === 'open').reduce((s, i) => s + (i.estPrice ?? 0), 0), members: (await listMembers(pool, a.household_id)).map(m => ({ id: m.id, name: m.name })) };
  }));
  app.post('/api/shopping', authed(async (a, req) => {
    const b = z.object({ items: z.array(z.string().min(1).max(80)).min(1).max(30) }).parse(req.body);
    return { added: await tx(db => addItems(db, a.household_id, b.items, a.id)) };
  }));
  app.post('/api/shopping/bought', authed(async (a, req) => {
    const b = z.object({ item: z.string().min(1), price: z.number().positive().nullish() }).parse(req.body);
    await tx(db => markBought(db, a.household_id, b.item, a.id, b.price)); return { ok: true };
  }));
  app.post('/api/shopping/remove', authed(async (a, req) => { await removeItem(pool, a.household_id, z.object({ item: z.string().min(1) }).parse(req.body).item); return { ok: true }; }));
  app.post('/api/shopping/assign', authed(async (a, req) => {
    const b = z.object({ item: z.string().min(1), memberId: z.string().uuid().nullable() }).parse(req.body);
    if (b.memberId) await one(pool, 'select 1 from members where id=$1 and household_id=$2', [b.memberId, a.household_id]).then(r => { if (!r) throw new NotFoundError('Member not found'); });
    await assignItem(pool, a.household_id, b.item, b.memberId); return { ok: true };
  }));

  // ---- money
  app.get('/api/money', authed(async (a) => ({
    summary: await moneySummary(pool, a.household_id), recent: await listRecent(pool, a.household_id, 30),
    members: (await listMembers(pool, a.household_id)).map(m => ({ id: m.id, name: m.name })),
  })));
  app.post('/api/money/purchase', authed(async (a, req) => {
    const b = z.object({ payerId: z.string().uuid().optional(), amount: z.number().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), store: z.string().max(80).optional(), note: z.string().max(200).optional(), paidFrom: z.enum(['member', 'pool']).optional(), split: splitSchema.optional(), items: z.array(z.object({ item: z.string().max(80), qty: z.number().positive().nullish(), unit: z.string().max(10).nullish(), price: z.number().positive().nullish() })).max(40).optional() }).parse(req.body);
    return tx(db => recordPurchase(db, { householdId: a.household_id, payerId: b.payerId ?? a.id, amount: b.amount, date: b.date, store: b.store, note: b.note, paidFrom: b.paidFrom, split: b.split, items: b.items, actor: a.id }));
  }));
  app.post('/api/money/contribution', authed(async (a, req) => {
    const b = z.object({ memberId: z.string().uuid().optional(), amount: z.number().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), note: z.string().max(200).optional() }).parse(req.body);
    return tx(db => recordContribution(db, { householdId: a.household_id, memberId: b.memberId ?? a.id, amount: b.amount, date: b.date, note: b.note, actor: a.id }));
  }));
  app.post('/api/money/settlement', authed(async (a, req) => {
    const b = z.object({ from: z.string().uuid(), to: z.string().uuid(), amount: z.number().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.body);
    return tx(db => recordSettlement(db, { householdId: a.household_id, from: b.from, to: b.to, amount: b.amount, date: b.date, actor: a.id }));
  }));
  app.post('/api/money/void', authed(async (a, req) => {
    const b = z.object({ kind: z.enum(['purchase', 'contribution', 'settlement']), id: z.string().uuid() }).parse(req.body);
    await voidRecord(pool, a.household_id, b.kind, b.id, a.id); return { ok: true };
  }));
  app.put('/api/money/budget', authed(async (a, req) => {
    const b = z.object({ monthly_budget: z.number().min(0).max(10_000_000) }).parse(req.body);
    return updateHousehold(pool, a.household_id, a.id, b);
  }));
  app.get('/api/prices', authed(async (a) => {
    const h = await getHousehold(pool, a.household_id);
    return [...(await loadPrices(pool, a.household_id, h.country)).values()].sort((x, y) => x.item.localeCompare(y.item));
  }));
  app.put('/api/prices', authed(async (a, req) => {
    const b = z.object({ item: z.string().min(1).max(60), unit: z.enum(['kg', 'l', 'piece']), price: z.number().positive() }).parse(req.body);
    await setPrice(pool, a.household_id, b.item, b.unit, b.price); return { ok: true };
  }));
  app.get('/api/protein', authed(async (a) => rankProteinPerRupee(await loadPrices(pool, a.household_id, (await getHousehold(pool, a.household_id)).country))));

  // ---- food log (personal, private by default)
  app.get('/api/foodlog', authed(async (a) => ({
    mine: await listMyLogs(pool, a.household_id, a.id), balance: await weeklyBalance(pool, a.household_id, a.id),
    shared: await sharedSummary(pool, a.household_id),
    disclaimer: 'General guidance only, not medical advice. Your meal log is private unless you choose to share a summary.',
  })));
  app.post('/api/foodlog', authed(async (a, req) => {
    const b = z.object({ meal: z.string().min(1).max(120), kind: z.enum(['home', 'ordered', 'outside']).optional(), hasVegetables: z.boolean().optional(), hasProtein: z.boolean().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.body);
    return logMeal(pool, { householdId: a.household_id, memberId: a.id, ...b });
  }));
  app.put('/api/foodlog/sharing', authed(async (a, req) => {
    const b = z.object({ shared: z.boolean() }).parse(req.body);
    await setLogShared(pool, a.household_id, a.id, b.shared); return { ok: true };
  }));

  // ---- tasks & pantry
  app.get('/api/tasks', authed(async (a) => listTasks(pool, a.household_id)));
  app.post('/api/tasks', authed(async (a, req) => {
    const b = z.object({ title: z.string().min(1).max(120), kind: z.enum(['cooking', 'grocery_run', 'cleaning', 'prep', 'chore']).optional(), ownerId: z.string().uuid().nullable().optional(), dueAt: z.string().datetime().nullable().optional(), recurrence: z.enum(['daily', 'weekly', 'rotate_weekly']).nullable().optional() }).parse(req.body);
    return createTask(pool, { householdId: a.household_id, ...b });
  }));
  app.post('/api/tasks/:id/done', authed(async (a, req) => { await completeTask(pool, a.household_id, (req.params as any).id); return { ok: true }; }));
  app.post('/api/tasks/:id/swap', authed(async (a, req) => { await swapTaskOwner(pool, a.household_id, (req.params as any).id, z.object({ ownerId: z.string().uuid() }).parse(req.body).ownerId); return { ok: true }; }));
  app.post('/api/tasks/reset', authed(async (a) => ({ assignments: await sundayReset(pool, a.household_id, localDate((await getHousehold(pool, a.household_id)).timezone, new Date())) })));
  app.get('/api/pantry', authed(async (a) => listPantry(pool, a.household_id)));
  app.post('/api/pantry', authed(async (a, req) => {
    const b = z.object({ item: z.string().min(1).max(60), qty: z.number().positive(), unit: z.string().min(1).max(10), bestBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(), leftover: z.boolean().optional() }).parse(req.body);
    await setPantry(pool, a.household_id, b); return { ok: true };
  }));
  app.delete('/api/pantry/:id', authed(async (a, req) => { await removePantry(pool, a.household_id, (req.params as any).id); return { ok: true }; }));

  // ---- household, members, invites, privacy
  app.get('/api/household', authed(async (a) => {
    const h = await getHousehold(pool, a.household_id);
    const members = (await listMembers(pool, a.household_id)).map(m => ({ id: m.id, name: m.name, role: m.role, language: m.language, diet: m.diet, allergens: m.allergens, optedOut: !!m.opted_out_at, joined: m.consent_at }));
    return { household: h, members, me: { id: a.id, role: a.role } };
  }));
  app.patch('/api/household', authed(async (a, req) => {
    adminOnly(a);
    const b = z.object({ name: z.string().min(1).max(60), language: z.enum(['en', 'hinglish', 'hi', 'pa']), region: z.string().max(30), living_type: z.enum(['solo', 'shared_flat', 'pg_hostel', 'shared_room', 'family']), monthly_budget: z.number().min(0).max(10_000_000), diet: z.enum(['vegan', 'veg', 'egg', 'nonveg']), allergens: z.array(z.string().max(30)).max(10), cooking_equipment: z.array(z.string().max(20)).max(10), cooking_minutes_max: z.number().int().min(5).max(240), timezone: z.string().max(40), currency: z.string().length(3), new_city_mode: z.boolean(), data_sharing: z.object({ meal_log_summary: z.boolean() }) }).partial().parse(req.body);
    if (b.timezone) { try { new Intl.DateTimeFormat('en', { timeZone: b.timezone }); } catch { throw new ValidationError('Unknown time zone'); } }
    return updateHousehold(pool, a.household_id, a.id, b);
  }));
  app.patch('/api/members/me', authed(async (a, req) => {
    const b = z.object({ name: z.string().min(1).max(40), language: z.enum(['en', 'hinglish', 'hi', 'pa']), diet: z.enum(['vegan', 'veg', 'egg', 'nonveg']), allergens: z.array(z.string().max(30)).max(10) }).partial().parse(req.body);
    await updateMember(pool, a.household_id, a.id, b); return { ok: true };
  }));
  app.post('/api/invites', authed(async (a) => { const code = await createInvite(pool, a.household_id, a.id); return { code, link: waLink(code) }; }));
  app.delete('/api/members/me', authed(async (a, req, reply) => {
    await tx(db => deleteMemberData(db, a.household_id, a.id));
    reply.clearCookie(COOKIE, { path: '/' }); return { ok: true };
  }));
  app.delete('/api/household', authed(async (a, req, reply) => {
    adminOnly(a);
    const b = z.object({ confirmName: z.string() }).parse(req.body);
    const h = await getHousehold(pool, a.household_id);
    if (b.confirmName !== h.name) throw new ValidationError('Type the household name to confirm');
    await tx(db => deleteHousehold(db, a.household_id));
    reply.clearCookie(COOKIE, { path: '/' }); return { ok: true };
  }));

  // ---- pilot admin (Bearer ADMIN_TOKEN)
  const admin = (fn: (req: FastifyRequest) => Promise<unknown>) => async (req: FastifyRequest, reply: FastifyReply) => {
    const ok = config.adminToken && req.headers.authorization === `Bearer ${config.adminToken}`;
    if (!ok) return reply.code(401).send({ error: 'admin_token_required' });
    return fn(req);
  };
  app.get('/admin/pilot', admin(async () => pilotMetrics(pool)));
  app.post('/admin/pilot/commitment', admin(async (req) => {
    const b = z.object({ householdId: z.string().uuid(), kind: z.enum(['committed', 'paid', 'declined']), price: z.number().positive().optional(), currency: z.string().length(3).optional(), note: z.string().max(200).optional() }).parse(req.body);
    await pool.query('insert into pilot_commitments (household_id, kind, price, currency, note) values ($1,$2,$3,$4,$5)', [b.householdId, b.kind, b.price ?? config.plan.pricePointInr, b.currency ?? 'INR', b.note ?? null]);
    return { ok: true };
  }));
  app.get('/healthz', async () => ({ ok: true }));
}
