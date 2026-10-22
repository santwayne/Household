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
