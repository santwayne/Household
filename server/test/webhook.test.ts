import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, testPool } from './helpers.js';
import { buildApp } from '../src/app.js';
import { DryRunClient } from '../src/whatsapp/client.js';
import { sign, verifySignature } from '../src/whatsapp/signature.js';
import { config } from '../src/config.js';
import { guardTranscript } from '../src/nlu/stt.js';

config.wa.appSecret = 'testsecret';
config.wa.verifyToken = 'verifyme';
config.adminToken = 'adm';
let app: Awaited<ReturnType<typeof buildApp>>;
const wa = new DryRunClient();
before(async () => { await freshDb(); app = await buildApp({ pool: testPool, wa, llm: null, stt: null }); });
after(async () => { await app.close(); });

const payload = (id: string, text: string, from = '919811111111') => JSON.stringify({ entry: [{ changes: [{ value: { contacts: [{ wa_id: from, profile: { name: 'Neha' } }], messages: [{ from, id, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text } }] } }] }] });
const post = (body: string, sig?: string) => app.inject({ method: 'POST', url: '/webhook/whatsapp', headers: { 'content-type': 'application/json', ...(sig ? { 'x-hub-signature-256': sig } : {}) }, payload: body });

test('signature check: missing or wrong signature is rejected, right one accepted', async () => {
  const body = payload('wamid.sig1', 'hi');
  assert.equal((await post(body)).statusCode, 401);
  assert.equal((await post(body, 'sha256=' + '0'.repeat(64))).statusCode, 401);
  assert.equal((await post(body, sign(body, 'wrongsecret'))).statusCode, 401);
  assert.equal((await post(body, sign(body, 'testsecret'))).statusCode, 200);
  assert.equal(verifySignature('x', 'sha256=zz', 'testsecret'), false);
});

test('verification handshake', async () => {
  const ok = await app.inject({ method: 'GET', url: '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=verifyme&hub.challenge=123' });
  assert.equal(ok.statusCode, 200); assert.equal(ok.body, '123');
  const bad = await app.inject({ method: 'GET', url: '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=123' });
  assert.equal(bad.statusCode, 403);
});

test('replayed webhook delivery is processed once', async () => {
  const before = wa.sent.length;
  const body = payload('wamid.replay1', 'hi', '919822222222');
  await post(body, sign(body, 'testsecret'));
  const afterFirst = wa.sent.length;
  await post(body, sign(body, 'testsecret'));
  assert.ok(afterFirst > before);
  assert.equal(wa.sent.length, afterFirst);
});

test('stale (older than tolerance) messages are ignored', async () => {
  const old = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from: '919833333333', id: 'wamid.old', timestamp: String(Math.floor(Date.now() / 1000) - 3 * 86400), type: 'text', text: { body: 'hi' } }] } }] }] });
  const n = wa.sent.length;
  assert.equal((await post(old, sign(old, 'testsecret'))).statusCode, 200);
  assert.equal(wa.sent.length, n);
});

test('transcript guard', () => {
  assert.equal(guardTranscript('Thanks for watching').ok, false);
  assert.equal(guardTranscript('ok ok ok ok ok ok ok ok').ok, false);
  assert.equal(guardTranscript('milk aur paneer add karo').ok, true);
  assert.equal(guardTranscript('milk', { bytes: 500 }).ok, false);
  assert.equal(guardTranscript('example sentence from prompt here please', { promptUsed: 'example sentence from prompt here please' }).ok, false);
  assert.equal(guardTranscript('hello there', { segments: [{ no_speech_prob: 0.9 }] }).ok, false);
});

test('dashboard API needs a login; one-time link creates a session scoped to ONE household', async () => {
  const unauth = await app.inject({ method: 'GET', url: '/api/home' });
  assert.equal(unauth.statusCode, 401);
  // two households through chat
  const say = async (phone: string, text: string, id: string) => { const b = payload(id, text, phone); await post(b, sign(b, 'testsecret')); };
  await say('919844444441', 'hi', 'w.a1'); await say('919844444441', 'yes', 'w.a2'); await say('919844444441', '5000', 'w.a3'); await say('919844444441', 'veg', 'w.a4');
  await say('919844444442', 'hi', 'w.b1'); await say('919844444442', 'yes', 'w.b2'); await say('919844444442', '4000', 'w.b3'); await say('919844444442', 'veg', 'w.b4');
  await say('919844444441', 'Neha ne 777 ka saman liya', 'w.a5');
  await say('919844444442', 'dashboard', 'w.b5');
  const link = wa.sent.filter(s => s.to === '919844444442').pop()!.body.match(/auth\?t=([a-f0-9]+)/)![1];
  const login = await app.inject({ method: 'GET', url: `/auth?t=${link}` });
  assert.equal(login.statusCode, 302);
  const cookie = login.headers['set-cookie'] as string;
  const sess = cookie.split(';')[0];
  const home = await app.inject({ method: 'GET', url: '/api/money', headers: { cookie: sess } });
  assert.equal(home.statusCode, 200);
  assert.equal(JSON.parse(home.body).summary.spentThisMonth, 0);   // household B never sees household A's 777
  assert.equal(JSON.stringify(JSON.parse(home.body)).includes('777'), false);
  // link is single-use
  assert.equal((await app.inject({ method: 'GET', url: `/auth?t=${link}` })).statusCode, 400);
  // household ids in the body/URL are ignored: cannot touch another household's records
  const a = await testPool.query(`select id from purchases limit 1`);
  const v = await app.inject({ method: 'POST', url: '/api/money/void', headers: { cookie: sess, 'content-type': 'application/json' }, payload: { kind: 'purchase', id: a.rows[0].id } });
  assert.equal(v.statusCode, 404);
  // validation errors are 400
  const bad = await app.inject({ method: 'POST', url: '/api/money/purchase', headers: { cookie: sess, 'content-type': 'application/json' }, payload: { amount: -5 } });
  assert.equal(bad.statusCode, 400);
});

test('admin pilot endpoint requires the token', async () => {
  assert.equal((await app.inject({ method: 'GET', url: '/admin/pilot' })).statusCode, 401);
  const r = await app.inject({ method: 'GET', url: '/admin/pilot', headers: { authorization: 'Bearer adm' } });
  assert.equal(r.statusCode, 200);
  assert.ok('decision' in JSON.parse(r.body));
});
