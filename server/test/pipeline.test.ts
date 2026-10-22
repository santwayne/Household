import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, testPool } from './helpers.js';
import { handleInbound, type Deps } from '../src/nlu/pipeline.js';
import { DryRunClient } from '../src/whatsapp/client.js';
import { processOutbox } from '../src/whatsapp/outbox.js';
import { q } from '../src/db/index.js';
import type { LlmClient } from '../src/nlu/llm.js';
import type { SttClient } from '../src/nlu/stt.js';
import { moneySummary } from '../src/domain/ledger.js';
import { runDueReminders } from '../src/jobs/scheduler.js';

let wa: DryRunClient;
let seq = 0;
let clock = new Date();
const mk = (over: Partial<Deps> = {}): Deps => ({ pool: testPool, wa, llm: null, stt: null, now: () => clock, ...over });
const say = (deps: Deps, phone: string, text: string, id = `wamid.${++seq}`) => handleInbound(deps, { waMessageId: id, phone, type: 'text', text, profileName: 'Aman' });
const last = () => wa.sent[wa.sent.length - 1]?.body ?? '';

before(async () => { await freshDb(); });

async function onboardTwo(deps: Deps) {
  await say(deps, '919800000001', 'hi');
  assert.match(last(), /Reply YES|YES \(ya haan\)|YES/);
  await say(deps, '919800000001', 'yes');
  assert.match(last(), /budget/i);
  await say(deps, '919800000001', '6000');
  await say(deps, '919800000001', 'veg, peanut allergy');
  const code = last().match(/JOIN ([A-F0-9]{8})/)![1];
  await handleInbound(deps, { waMessageId: `wamid.${++seq}`, phone: '919800000002', type: 'text', text: `JOIN ${code}`, profileName: 'Raj' });
  assert.match(last(), /Aman|"/);
  await handleInbound(deps, { waMessageId: `wamid.${++seq}`, phone: '919800000002', type: 'text', text: 'yes', profileName: 'Raj' });
  assert.match(last(), /Welcome/);
}

test('onboarding: explicit consent first, budget + diet setup, invite join with consent', async () => {
  await freshDb(); wa = new DryRunClient(); const deps = mk();
  // nothing is saved before consent
  await say(deps, '919800000001', 'hi');
  assert.equal((await q(testPool, 'select * from members')).length, 0);
  await onboardTwo(deps);
  const members = await q(testPool, 'select name, consent_at from members order by created_at');
  assert.deepEqual(members.map((m: any) => m.name), ['Aman', 'Raj']);
  assert.ok(members.every((m: any) => m.consent_at));
  const h = (await q(testPool, 'select * from households'))[0];
  assert.equal(h.monthly_budget, 6000); assert.equal(h.diet, 'veg'); assert.deepEqual(h.allergens, ['peanut']);
});

test('purchase via chat is saved once even if the webhook retries; kitna bacha matches the ledger', async () => {
  await freshDb(); wa = new DryRunClient(); const deps = mk();
  await onboardTwo(deps);
  const r1 = await say(deps, '919800000001', 'Aman ne 650 ka saman liya', 'wamid.same');
  const r2 = await say(deps, '919800000001', 'Aman ne 650 ka saman liya', 'wamid.same');
  assert.equal(r1.outcome, 'processed'); assert.equal(r2.outcome, 'duplicate');
  assert.equal((await q(testPool, 'select * from purchases')).length, 1);
  assert.match(wa.sent.filter(s => s.to === '919800000001').map(s => s.body).join('\n'), /₹650/);
  await say(deps, '919800000002', 'kitna bacha hai?');
  const hh = (await q(testPool, 'select id from households'))[0];
  const s = await moneySummary(testPool, hh.id);
  assert.equal(s.remaining, 5350);
  assert.match(last(), /5,350/);
  await say(deps, '919800000002', 'kisko kitna dena hai?');
  assert.match(last(), /Raj → Aman: ₹325/);
});

test('reply language follows the latest message', async () => {
  await freshDb(); wa = new DryRunClient(); const deps = mk();
  await onboardTwo(deps);
  await say(deps, '919800000001', 'how much is left?');
  assert.match(last(), /Budget .* left/);
  await say(deps, '919800000001', 'कितना बचा');
  assert.match(last(), /बजट/);
  await say(deps, '919800000001', 'ਕਿੰਨਾ ਬਚਿਆ');
  assert.match(last(), /ਬਜਟ/);
});

test('shopping, plan within budget, swap, reminders (food only)', async () => {
  await freshDb(); wa = new DryRunClient(); const deps = mk();
  await onboardTwo(deps);
  await say(deps, '919800000001', 'milk aur paneer add karo');
  await say(deps, '919800000001', 'list dikhao');
  assert.match(last(), /milk/); assert.match(last(), /paneer/);
  await say(deps, '919800000001', 'is hafte ka plan, budget 3000, 2 log, veg');
  assert.match(last(), /Estimated cost|Andaza kharch/);
  const total = Number(last().match(/(?:Estimated cost|Andaza kharch) ₹([\d,]+(?:\.\d+)?)/)![1].replace(/,/g, ''));
  assert.ok(total <= 3000);
  await say(deps, '919800000001', 'friday dinner badlo');
  assert.match(last(), /badal kar|Changed|swap_fail|nahi mila/i);
  await say(deps, '919800000001', 'kal subah rajma bhigona yaad dilana');
  assert.match(last(), /Reminder set|Reminder/);
  await say(deps, '919800000001', 'kal subah meeting yaad dilana');
  assert.match(last(), /khane se jude|food-related/);
});

test('STOP opts out: no more messages except START/DELETE', async () => {
  await freshDb(); wa = new DryRunClient(); const deps = mk();
  await onboardTwo(deps);
  await say(deps, '919800000002', 'stop');
  assert.match(last(), /message nahi karunga|will not message/);
  const n = wa.sent.length;
  await say(deps, '919800000002', 'kitna bacha hai?');
  assert.equal(wa.sent.length, n);
  await say(deps, '919800000002', 'start');
  assert.match(last(), /Wapas|Welcome back/);
});

test('reminders outside the 24-hour window use an approved template; opted-out members are skipped', async () => {
  await freshDb(); wa = new DryRunClient(); const deps = mk();
  await onboardTwo(deps);
  await say(deps, '919800000001', 'aaj raat rajma bhigona yaad dilana');
  const n = wa.sent.length;
  const later = new Date(clock.getTime() + 30 * 3600 * 1000); // 30h later: window closed
  await runDueReminders(testPool, new Date(later.getTime() + 24 * 3600 * 1000));
  await processOutbox(testPool, wa, new Date(later.getTime() + 24 * 3600 * 1000));
  const sentAfter = wa.sent.slice(n);
  assert.equal(sentAfter.length, 1);
  assert.equal(sentAfter[0].kind, 'template');
  assert.equal(sentAfter[0].template, 'food_reminder');
  // a free-form message outside the window is blocked, not sent
  await testPool.query(`insert into outbound_messages (to_phone, kind, payload) values ('919800000001','text','{"text":"hello"}')`);
  const r = await processOutbox(testPool, wa, new Date(clock.getTime() + 48 * 3600 * 1000));
  assert.equal(r.blocked >= 1, true);
});

test('LLM fallback: schema is enforced, low confidence asks for confirmation, garbage is rejected', async () => {
  await freshDb(); wa = new DryRunClient();
  let next: unknown = null;
  const llm: LlmClient = { proposeAction: async () => ({ raw: next, usage: { model: 'mock', promptTokens: 10, completionTokens: 5, latencyMs: 3 } }) };
  const deps = mk({ llm });
  await onboardTwo(deps);
  // unclear for rules -> LLM with low confidence -> confirmation question, nothing saved yet
  next = { intent: 'record_purchase', confidence: 0.6, payer: 'Raj', amount: 400, items: ['sabzi'], needs_confirmation: true };
  await say(deps, '919800000001', 'raj ne kal sabzi mandi se uthayi thi chaar sau ki');
  assert.match(last(), /Save karun|Save it/);
  assert.equal((await q(testPool, 'select * from purchases')).length, 0);
  await say(deps, '919800000001', 'haan');
  assert.equal((await q(testPool, 'select * from purchases')).length, 1);
  assert.equal((await q(testPool, 'select m.name from purchases p join members m on m.id=p.payer_id'))[0].name, 'Raj');
  // schema-violating output is rejected: nothing saved, polite fallback
  next = { intent: 'record_purchase', confidence: 0.99, amount: -50 };
  await say(deps, '919800000001', 'kuch ajeeb sa message yahan likha hai');
  assert.match(last(), /samajh nahi aaya|did not understand/);
  assert.equal((await q(testPool, 'select * from purchases')).length, 1);
  assert.ok((await q(testPool, `select * from ai_calls where outcome='schema_rejected'`)).length >= 1);
  // 'no' cancels
  next = { intent: 'record_purchase', confidence: 0.5, payer: 'Aman', amount: 99, needs_confirmation: true };
  await say(deps, '919800000001', 'aur ek cheez kharidi thi 99 ki shayad');
  await say(deps, '919800000001', 'nahi');
  assert.equal((await q(testPool, 'select * from purchases')).length, 1);
});

test('unknown payer name triggers a single short question, then saves', async () => {
  await freshDb(); wa = new DryRunClient(); const deps = mk();
  await onboardTwo(deps);
  await say(deps, '919800000001', 'Zoya ne 300 ka saman liya');
  assert.match(last(), /Kisne diye|Who paid/);
  assert.equal((await q(testPool, 'select * from purchases')).length, 0);
  await say(deps, '919800000001', 'Raj');
  assert.equal((await q(testPool, 'select * from purchases')).length, 1);
});

test('voice notes: noise/silence/prompt-echo never create records; a clear transcript is handled like text', async () => {
  await freshDb(); wa = new DryRunClient();
  let transcript = '';
  const stt: SttClient = { transcribe: async () => ({ text: transcript }) };
  const deps = mk({ stt });
  await onboardTwo(deps);
  wa.media.set('m1', { data: Buffer.alloc(8000, 1), mime: 'audio/ogg' });
  const voice = (text: string) => { transcript = text; return handleInbound(deps, { waMessageId: `wamid.${++seq}`, phone: '919800000001', type: 'audio', mediaId: 'm1' }); };
  for (const bad of ['', 'Thanks for watching!', 'you', '... ...', 'aaa aaa aaa aaa aaa aaa aaa aaa aaa']) {
    const r = await voice(bad);
    assert.equal(r.outcome, 'ignored', `should reject: ${bad}`);
  }
  assert.equal((await q(testPool, 'select * from purchases')).length, 0);
  assert.equal((await q(testPool, 'select * from shopping_list_items')).length, 0);
  const ok = await voice('Aman ne 450 ka saman liya');
  assert.equal(ok.outcome, 'processed');
  assert.equal((await q(testPool, 'select * from purchases')).length, 1);
});

test('delete my data requires confirmation and erases personal data', async () => {
  await freshDb(); wa = new DryRunClient(); const deps = mk();
  await onboardTwo(deps);
  await say(deps, '919800000002', 'dal chawal khaya');
  await say(deps, '919800000002', 'delete my data');
  assert.match(last(), /erase|YES/);
  assert.equal((await q(testPool, 'select * from meal_logs')).length, 1);
  await say(deps, '919800000002', 'yes');
  assert.equal((await q(testPool, 'select * from meal_logs')).length, 0);
  assert.match((await q(testPool, `select name from members where name='Former member'`))[0].name, /Former member/);
});

test('images are politely declined (receipt reading is a later phase)', async () => {
  await freshDb(); wa = new DryRunClient(); const deps = mk();
  await onboardTwo(deps);
  const r = await handleInbound(deps, { waMessageId: `wamid.${++seq}`, phone: '919800000001', type: 'image', mediaId: 'x' });
  assert.equal(r.outcome, 'ignored');
  assert.match(last(), /photo|Photo/);
});
