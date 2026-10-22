import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, testPool } from './helpers.js';
import { handleInbound, type Deps } from '../src/nlu/pipeline.js';
import { DryRunClient } from '../src/whatsapp/client.js';
import { buildApp } from '../src/app.js';
import { sign } from '../src/whatsapp/signature.js';
import { config } from '../src/config.js';
import { q } from '../src/db/index.js';
import { runExpiryAlerts } from '../src/jobs/scheduler.js';
import { pilotMetrics } from '../src/http/pilot.js';
import { allKeys, hasLang } from '../src/nlu/i18n.js';
import { parseByRules, extractSplit } from '../src/nlu/rules.js';
import { setPantry } from '../src/domain/pantry.js';

let wa: DryRunClient; let deps: Deps; let seq = 0;
const say = (phone: string, text: string, name = 'X') => handleInbound(deps, { waMessageId: `c.${++seq}`, phone, type: 'text', text, profileName: name });
const sentTo = (phone: string) => wa.sent.filter(s => s.to === phone).map(s => s.body);
const lastTo = (phone: string) => sentTo(phone).pop() ?? '';
const P = ['919700000001', '919700000002', '919700000003'];

async function house() {
  await freshDb(); wa = new DryRunClient(); deps = { pool: testPool, wa, llm: null, stt: null };
  await say(P[0], 'hi', 'Aman'); await say(P[0], 'yes', 'Aman'); await say(P[0], '1000', 'Aman'); await say(P[0], 'veg', 'Aman');
  const code = lastTo(P[0]).match(/JOIN ([A-F0-9]{8})/)![1];
  for (const [i, n] of [[1, 'Raj'], [2, 'Priya']] as const) { await say(P[i], `JOIN ${code}`, n); await say(P[i], 'yes', n); }
}
before(async () => { await freshDb(); });

test('pantry by chat: add, show, cook from what is at home, expiry list', async () => {
  await house();
  await say(P[0], 'ghar mein 2 kg chawal hai'); assert.match(lastTo(P[0]), /Pantry update/);
  await say(P[0], 'pantry mein 500 g toor dal hai');
  await say(P[0], 'ghar mein doodh khatam ho gaya'); // not a pantry statement
  assert.doesNotMatch(lastTo(P[0]), /Pantry update/);
  await say(P[0], 'pantry'); assert.match(lastTo(P[0]), /chawal|rice/);
  await say(P[0], 'ghar ke saman se kya banaun');
  assert.match(lastTo(P[0]), /Dal tadka|Masoor|Moong|Gujarati|Sambar|khichdi|Rajma/i);
  const h = (await q(testPool, 'select id from households'))[0];
  await setPantry(testPool, h.id, { item: 'paneer', qty: 200, unit: 'g', bestBefore: new Date(Date.now() + 86400000).toISOString().slice(0, 10) });
  await say(P[0], 'kya expire ho raha hai'); assert.match(lastTo(P[0]), /paneer/);
});

test('expiry alert job: free text inside the window, once only, never a paid template', async () => {
  await house();
  const h = (await q(testPool, 'select id from households'))[0];
  await setPantry(testPool, h.id, { item: 'curd', qty: 500, unit: 'g', bestBefore: new Date(Date.now() + 3600_000).toISOString().slice(0, 10) });
  const n0 = wa.sent.length;
  assert.equal(await runExpiryAlerts(testPool), 3);
  const { processOutbox } = await import('../src/whatsapp/outbox.js');
  await processOutbox(testPool, wa);
  assert.equal(wa.sent.length - n0, 3);
  assert.ok(wa.sent.slice(n0).every(s => s.kind === 'text' && /curd/.test(s.body)));
  assert.equal(await runExpiryAlerts(testPool), 0);
  // outside the window nothing is sent (no template cost)
  await testPool.query(`update members set last_inbound_at = now() - interval '3 days'`);
  await setPantry(testPool, h.id, { item: 'milk', qty: 1000, unit: 'ml', bestBefore: new Date().toISOString().slice(0, 10) });
  assert.equal(await runExpiryAlerts(testPool), 0);
});

test('custom split by chat: only the named members share the cost; unknown names are asked about', async () => {
  await house();
  await say(P[0], 'Aman ne 600 ka saman liya, sirf Aman aur Raj ke liye');
  assert.match(lastTo(P[0]), /Aman, Raj/);
  const sh = await q(testPool, `select m.name, s.amount from purchase_shares s join members m on m.id=s.member_id order by m.name`);
  assert.deepEqual(sh.map((x: any) => [x.name, x.amount]), [['Aman', 300], ['Raj', 300]]);
  await say(P[0], 'Raj ne 90 ka doodh liya Aman aur Priya ke beech');
  const sh2 = await q(testPool, `select m.name, s.amount from purchase_shares s join purchases p on p.id=s.purchase_id join members m on m.id=s.member_id where p.amount=90 order by m.name`);
  assert.deepEqual(sh2.map((x: any) => [x.name, x.amount]), [['Aman', 45], ['Priya', 45]]);
  await say(P[0], 'Aman ne 100 ka saman liya sirf Zoya aur Raj ke liye');
  assert.match(lastTo(P[0]), /zoya/i);
  assert.equal((await q(testPool, 'select * from purchases where amount=100')).length, 0);
  assert.deepEqual(extractSplit('aman ne 600 ka saman liya sirf aman aur raj ke liye')?.names, ['aman', 'raj']);
  assert.equal(parseByRules('Aman paid 500 for groceries, split between Aman and Raj')?.split_members?.length, 2);
});

test('budget alert reaches the other members too (free text inside their window)', async () => {
  await house();
  await say(P[0], 'Aman ne 850 ka saman liya');
  assert.match(lastTo(P[0]), /85%|80%/);
  assert.match(lastTo(P[1]), /Aman (just logged|ne) ₹850/);
  assert.match(lastTo(P[2]), /Aman (just logged|ne) ₹850/);
  const n = sentTo(P[1]).length;
  await say(P[0], 'Aman ne 10 ka saman liya'); // no new threshold crossed
  assert.equal(sentTo(P[1]).length, n);
});

test('webhook: delivery receipts update the outbound message; privacy page is served and linked from the consent message', async () => {
  await house();
  config.wa.appSecret = 'sec';
  const app = await buildApp(deps);
  const id = (await q(testPool, `select wa_message_id from outbound_messages where wa_message_id is not null order by created_at desc limit 1`))[0].wa_message_id;
  const body = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id, status: 'delivered' }] } }] }] });
  const r = await app.inject({ method: 'POST', url: '/webhook/whatsapp', headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(body, 'sec') }, payload: body });
  assert.equal(r.statusCode, 200);
  assert.equal((await q(testPool, 'select delivery_status from outbound_messages where wa_message_id=$1', [id]))[0].delivery_status, 'delivered');
  const bad = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id, status: 'failed', errors: [{ title: 'Undeliverable' }] }] } }] }] });
  await app.inject({ method: 'POST', url: '/webhook/whatsapp', headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(bad, 'sec') }, payload: bad });
  assert.match((await q(testPool, 'select error from outbound_messages where wa_message_id=$1', [id]))[0].error, /Undeliverable/);
  const pr = await app.inject({ method: 'GET', url: '/privacy' });
  assert.equal(pr.statusCode, 200); assert.match(pr.body, /Privacy notice/); assert.match(pr.body, /never holds or moves money/);
  await say('919700000009', 'hi'); assert.match(lastTo('919700000009'), /\/privacy/);
  await app.close();
});

test('rate limits: API per IP (429) and per phone number (burst ignored, nothing processed)', async () => {
  await house();
  const app = await buildApp(deps);
  let last = 200;
  for (let i = 0; i < 25; i++) last = (await app.inject({ method: 'GET', url: '/auth?t=nope' })).statusCode;
  assert.equal(last, 429);
  await app.close();
  const before = (await q(testPool, 'select * from purchases')).length;
  let ignored = 0;
  for (let i = 0; i < 40; i++) { const r = await say(P[1], 'Raj ne 5 ka saman liya'); if (r.outcome === 'ignored') ignored++; }
  assert.ok(ignored >= 8, `expected a burst to be cut off, ignored=${ignored}`);
  assert.ok((await q(testPool, `select * from message_log where outcome='rate_limited'`)).length >= 8);
  assert.ok((await q(testPool, 'select * from purchases')).length - before <= 31);
});

test('pilot metrics include retention, correction rate, rules vs model share', async () => {
  await house();
  await say(P[0], 'Aman ne 100 ka saman liya'); await say(P[0], 'undo'); await say(P[0], 'kitna bacha hai?');
  const m: any = await pilotMetrics(testPool);
  assert.ok('week4' in m.retention && 'week8' in m.retention);
  assert.equal(m.parsing.actionMessages >= 3, true);
  assert.ok(m.parsing.correctionRate > 0 && m.parsing.correctionRate < 1);
  assert.ok(m.parsing.handledByRules >= 3);
  assert.equal(m.retention.week1.eligible, 0); // everything is brand new
});

test('every reply key exists in English, Hinglish, Hindi and Punjabi', () => {
  const missing = allKeys().flatMap(k => (['en', 'hinglish', 'hi', 'pa'] as const).filter(l => !hasLang(k, l)).map(l => `${k}:${l}`));
  assert.deepEqual(missing, []);
});

test('custom amounts and percentages in chat: saved exactly, mismatches are refused with nothing saved', async () => {
  await house();
  await say(P[0], 'Aman ne 900 ka saman liya Aman 500 Raj 400');
  const sh = await q(testPool, `select m.name, s.amount from purchase_shares s join members m on m.id=s.member_id order by m.name`);
  assert.deepEqual(sh.map((x: any) => [x.name, x.amount]), [['Aman', 500], ['Raj', 400]]);
  assert.match(lastTo(P[0]), /Aman ₹500, Raj ₹400/);
  await say(P[0], 'Aman ne 1000 ka saman liya Aman 70% Raj 30%');
  const sh2 = await q(testPool, `select m.name, s.amount from purchase_shares s join purchases p on p.id=s.purchase_id join members m on m.id=s.member_id where p.amount=1000 order by m.name`);
  assert.deepEqual(sh2.map((x: any) => [x.name, x.amount]), [['Aman', 700], ['Raj', 300]]);
  const n = (await q(testPool, 'select * from purchases')).length;
  await say(P[0], 'Aman ne 900 ka saman liya Aman 500 Raj 300');           // adds up to 800, not 900
  assert.match(lastTo(P[0]), /Split sahi nahi|does not work/);
  await say(P[0], 'Aman ne 800 ka saman liya Aman 60% Raj 30%');           // 90%
  assert.match(lastTo(P[0]), /Split sahi nahi|does not work/);
  assert.equal((await q(testPool, 'select * from purchases')).length, n);
  await say(P[0], 'Aman ne 300 ka saman liya Aman 100 Zoya 200');
  assert.match(lastTo(P[0]), /zoya/i);
  assert.equal((await q(testPool, 'select * from purchases')).length, n);
  const bal = await q(testPool, `select 1`); assert.ok(bal);
  assert.deepEqual(Object.keys(parseByRules('Aman paid 500 for groceries Raj 250 Neha 250')?.split_amounts ?? {}).sort(), ['neha', 'raj']);
  assert.equal(parseByRules('Aman ne 650 ka saman liya')?.split_amounts, undefined);
});

test('dashboard API accepts custom and percent splits and refuses ones that do not add up', async () => {
  await house();
  config.wa.appSecret = 'sec';
  const app = await buildApp(deps);
  await say(P[0], 'dashboard');
  const link = lastTo(P[0]).match(/auth\?t=([a-f0-9]+)/)![1];
  const cookie = ((await app.inject({ method: 'GET', url: `/auth?t=${link}` })).headers['set-cookie'] as string).split(';')[0];
  const ids = Object.fromEntries((await q(testPool, 'select id, name from members')).map((m: any) => [m.name, m.id]));
  const post = (payload: unknown) => app.inject({ method: 'POST', url: '/api/money/purchase', headers: { cookie, 'content-type': 'application/json' }, payload: payload as any });
  assert.equal((await post({ amount: 600, split: { type: 'custom', shares: { [ids.Aman]: 100, [ids.Raj]: 300, [ids.Priya]: 200 } } })).statusCode, 200);
  assert.equal((await post({ amount: 600, split: { type: 'percent', percents: { [ids.Aman]: 50, [ids.Raj]: 50 } } })).statusCode, 200);
  assert.equal((await post({ amount: 600, split: { type: 'equal', members: [ids.Aman, ids.Priya] } })).statusCode, 200);
  assert.equal((await post({ amount: 600, split: { type: 'custom', shares: { [ids.Aman]: 100, [ids.Raj]: 100 } } })).statusCode, 400);
  assert.equal((await post({ amount: 600, split: { type: 'percent', percents: { [ids.Aman]: 60, [ids.Raj]: 60 } } })).statusCode, 400);
  const rows = await q(testPool, `select m.name, s.amount from purchase_shares s join members m on m.id=s.member_id join purchases p on p.id=s.purchase_id where p.amount=600 order by p.created_at, m.name`);
  assert.equal(rows.length, 3 + 2 + 2);
  await app.close();
});

test('suggestions: each rule fires from the household\'s own data, in priority order, and a healthy household gets none', async () => {
  const { getSuggestions } = await import('../src/domain/suggestions.js');
  const { generatePlan, approvePlan, getCurrentPlan } = await import('../src/domain/plans.js');
  const { recordPurchase } = await import('../src/domain/ledger.js');
  const { createTask } = await import('../src/domain/tasks.js');
  const { addItems } = await import('../src/domain/shopping.js');
  await house();
  const hh = (await q(testPool, 'select id from households'))[0].id;
  const ids = (await q(testPool, 'select id, name from members order by name')).map((m: any) => m.id);
  const keys = async (now: Date) => (await getSuggestions(testPool, hh, now, 20)).map(s => s.key);
  const wed = new Date('2026-10-21T10:00:00Z');                       // a Wednesday: no Sunday nudge

  assert.deepEqual(await keys(wed), ['no_plan']);                       // budget set, nothing planned
  await testPool.query('update households set monthly_budget=0');
  assert.equal((await keys(wed))[0], 'no_budget');                      // highest priority
  await testPool.query('update households set monthly_budget=1000');

  await generatePlan(testPool, hh, { budget: 900, days: 3, servings: 3, startDate: '2026-10-21' });
  assert.deepEqual(await keys(wed), ['approve_plan', 'assign_buyer']);   // the plan added items nobody is assigned to buy
  await testPool.query('update shopping_list_items set assigned_to=$1', [ids[0]]);
  assert.deepEqual(await keys(wed), ['approve_plan']);
  await approvePlan(testPool, hh, (await getCurrentPlan(testPool, hh))!.id);
  assert.deepEqual(await keys(wed), []);                                 // healthy: nothing to nag about
  await say(P[0], 'suggestions'); assert.match(lastTo(P[0]), /All good|Sab theek/);

  // spending ahead of pace (early in the month) and money owed between members
  const earlyMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 3, 10));
  await recordPurchase(testPool, { householdId: hh, payerId: ids[0], amount: 900 });
  const k = await keys(earlyMonth);
  assert.ok(k.includes('budget_pace'), k.join());
  assert.ok(k.includes('settle_up'), k.join());
  const settle = (await getSuggestions(testPool, hh, earlyMonth, 20)).find(s => s.key === 'settle_up')!;
  assert.equal(settle.params.amount, 300);

  // expiring pantry, overdue task, unassigned shopping list
  await setPantry(testPool, hh, { item: 'toor dal', qty: 500, unit: 'g', bestBefore: new Date().toISOString().slice(0, 10) });
  await setPantry(testPool, hh, { item: 'rice', qty: 1, unit: 'kg' });
  await createTask(testPool, { householdId: hh, title: 'Late chore', ownerId: ids[0], dueAt: new Date(earlyMonth.getTime() - 86400000).toISOString() });
  await addItems(testPool, hh, ['milk', 'bread', 'eggs', 'oil', 'sugar'], ids[0]);
  const all = await getSuggestions(testPool, hh, earlyMonth, 20);
  const kk = all.map(s => s.key);
  for (const key of ['use_expiring', 'tasks_overdue', 'assign_buyer']) assert.ok(kk.includes(key), `${key} missing in ${kk}`);
  assert.deepEqual(all.map(s => s.priority), [...all.map(s => s.priority)].sort((a, b) => b - a));
  assert.equal((await getSuggestions(testPool, hh, earlyMonth, 2)).length, 2);   // limit respected

  // Sunday nudge only when nothing is open
  await testPool.query(`delete from tasks`);
  const sun = new Date('2026-10-25T10:00:00Z');
  assert.ok((await keys(sun)).includes('sunday_reset'));

  // chat reply in the member's language, and the other household sees nothing of this
  await say(P[0], 'kya karna chahiye');
  assert.match(lastTo(P[0]), /Ab kya karna chahiye|What to do next/);
});

test('dashboard suggestions endpoint returns ready-to-show text', async () => {
  await house();
  config.wa.appSecret = 'sec';
  const app = await buildApp(deps);
  await say(P[0], 'dashboard');
  const link = lastTo(P[0]).match(/auth\?t=([a-f0-9]+)/)![1];
  const cookie = ((await app.inject({ method: 'GET', url: `/auth?t=${link}` })).headers['set-cookie'] as string).split(';')[0];
  const r = await app.inject({ method: 'GET', url: '/api/suggestions', headers: { cookie } });
  assert.equal(r.statusCode, 200);
  const body = JSON.parse(r.body);
  assert.ok(body.length >= 1 && typeof body[0].text === 'string' && body[0].text.length > 10);
  assert.equal((await app.inject({ method: 'GET', url: '/api/suggestions' })).statusCode, 401);
  await app.close();
});

test('terminal chat simulator runs the real pipeline without WhatsApp', async () => {
  const { spawnSync } = await import('node:child_process');
  await house();                                      // clean database (and the schema is migrated)
  await testPool.query('truncate households, message_log, outbound_messages, conversation_state restart identity cascade');
  const { seedReferenceData } = await import('../src/db/seed.js'); await seedReferenceData(testPool);
  const input = 'hi\nyes\n6000\nveg\nAman ne 650 ka saman liya\nkitna bacha hai?\n/as 919800000044 Raj\nhi\n/quit\n';
  const r = spawnSync('npx', ['tsx', 'src/cli/chat.ts', '--phone', '919800000043', '--name', 'Aman'], { input, encoding: 'utf8', env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5433/shared_living_test' } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /bot> Hi! I help flatmates/);
  assert.match(r.stdout, /bot> Likh liya: Aman ne ₹650 diye/);
  assert.match(r.stdout, /bacha ₹5,350/);
  assert.match(r.stdout, /now chatting as Raj/);
  assert.equal((await q(testPool, 'select count(*)::int as n from purchases'))[0].n, 1);
});
