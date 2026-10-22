import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { freshDb, testPool } from './helpers.js';
import { config } from '../src/config.js';
import { CloudApiClient } from '../src/whatsapp/client.js';
import { enqueue, processOutbox } from '../src/whatsapp/outbox.js';
import { AnthropicClient, OpenAiClient, parseWithLlm } from '../src/nlu/llm.js';
import { OpenAiStt, transcribeVoice } from '../src/nlu/stt.js';
import { q } from '../src/db/index.js';

// A local fake of the three external services. This proves our HTTP requests and response handling
// (headers, body shape, parsing, retries); it does NOT prove how the real services behave.
type Rec = { method: string; url: string; headers: http.IncomingHttpHeaders; body: Buffer };
let server: http.Server; let base = ''; const seen: Rec[] = []; let waMode: 'ok' | 'flaky' | 'reject' = 'ok'; let waCalls = 0;
const audio = Buffer.alloc(6000, 7);

before(async () => {
  await freshDb();
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const rec = { method: req.method!, url: req.url!, headers: req.headers, body: Buffer.concat(chunks) }; seen.push(rec);
      const send = (code: number, body: unknown, type = 'application/json') => { res.writeHead(code, { 'content-type': type }); res.end(Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
      if (req.url === '/v21.0/PNID/messages') {
        waCalls++;
        if (waMode === 'reject') return send(400, { error: { message: 'Recipient not allowed' } });
        if (waMode === 'flaky' && waCalls % 2 === 1) return send(500, { error: { message: 'temporary' } });
        return send(200, { messages: [{ id: `wamid.fake.${waCalls}` }] });
      }
      if (req.url === '/v21.0/MEDIA1') return send(200, { url: `${base}/media/MEDIA1`, mime_type: 'audio/ogg' });
      if (req.url === '/media/MEDIA1') return send(200, audio, 'audio/ogg');
      if (req.url === '/v1/messages') return send(200, { content: [{ type: 'tool_use', name: 'record_action', input: { intent: 'add_items', confidence: 0.95, items: ['milk'] } }], usage: { input_tokens: 120, output_tokens: 30 } });
      if (req.url === '/v1/chat/completions') return send(200, { choices: [{ message: { content: JSON.stringify({ intent: 'budget_remaining', confidence: 0.9 }) } }], usage: { prompt_tokens: 100, completion_tokens: 10 } });
      if (req.url === '/v1/audio/transcriptions') return send(200, { text: 'milk aur paneer add karo', duration: 3, segments: [{ no_speech_prob: 0.01 }] });
      send(404, {});
    });
  });
  await new Promise<void>(r => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  Object.assign(config.wa, { graphBase: base, phoneNumberId: 'PNID', accessToken: 'WATOKEN' });
  Object.assign(config.llm, { anthropicBase: base, openaiBase: base, anthropicKey: 'AK', openaiKey: 'OK' });
});
after(async () => { server.close(); });
const last = () => seen[seen.length - 1];

test('WhatsApp client: text, template and media requests have the right shape', async () => {
  const wa = new CloudApiClient();
  assert.equal((await wa.sendText('919800000009', 'hello')).id, 'wamid.fake.1');
  let b = JSON.parse(last().body.toString());
  assert.equal(last().headers.authorization, 'Bearer WATOKEN');
  assert.deepEqual({ p: b.messaging_product, to: b.to, type: b.type, body: b.text.body }, { p: 'whatsapp', to: '919800000009', type: 'text', body: 'hello' });
  await wa.sendTemplate('919800000009', 'food_reminder', 'en', ['soak rajma']);
  b = JSON.parse(last().body.toString());
  assert.equal(b.type, 'template'); assert.equal(b.template.name, 'food_reminder'); assert.deepEqual(b.template.components[0].parameters, [{ type: 'text', text: 'soak rajma' }]);
  const media = await wa.getMedia('MEDIA1');
  assert.equal(media.mime, 'audio/ogg'); assert.equal(media.data.length, audio.length);
});

test('outbox retries a temporary failure and gives up on a permanent one', async () => {
  const wa = new CloudApiClient();
  waMode = 'flaky'; waCalls = 0;
  await enqueue(testPool, { phone: '919800000009', payload: { text: 'retry me' } });
  const t0 = new Date();
  let r = await processOutbox(testPool, wa, t0);
  assert.equal(r.sent, 0);
  let row = (await q(testPool, 'select status, attempts, error from outbound_messages'))[0];
  assert.equal(row.status, 'queued'); assert.equal(row.attempts, 1); assert.match(row.error, /temporary/);
  r = await processOutbox(testPool, wa, new Date(t0.getTime() + 60_000));
  assert.equal(r.sent, 1);
  waMode = 'reject';
  await testPool.query('delete from outbound_messages');
  await enqueue(testPool, { phone: '919800000009', payload: { text: 'bad' } });
  r = await processOutbox(testPool, wa);
  assert.equal(r.failed, 1);
  row = (await q(testPool, 'select status, error from outbound_messages'))[0];
  assert.equal(row.status, 'failed'); assert.match(row.error, /Recipient not allowed/);
  waMode = 'ok';
});

test('Anthropic adapter: forced tool call with the action schema, cached system prompt, parsed + validated', async () => {
  const ctx = { memberNames: ['Aman'], senderName: 'Aman', currency: 'INR', today: '2026-10-22', timezone: 'Asia/Kolkata' };
  const res = await parseWithLlm(new AnthropicClient('AK', 'claude-haiku-5-5'), 'doodh add kar do', ctx);
  assert.equal(res.outcome, 'ok'); assert.deepEqual(res.action?.items, ['milk']);
  assert.equal(res.usage?.promptTokens, 120);
  const b = JSON.parse(last().body.toString());
  assert.equal(last().headers['x-api-key'], 'AK'); assert.equal(last().headers['anthropic-version'], '2023-06-01');
  assert.deepEqual(b.tool_choice, { type: 'tool', name: 'record_action' });
  assert.equal(b.tools[0].input_schema.properties.intent.enum.includes('record_purchase'), true);
  assert.equal(b.system[0].cache_control.type, 'ephemeral');
  assert.ok(b.max_tokens <= 400);
  assert.match(b.messages[0].content, /doodh add kar do/);
});

test('OpenAI adapters: chat JSON parse, and speech-to-text sends NO prompt and runs the transcript guard', async () => {
  const ctx = { memberNames: ['Aman'], senderName: 'Aman', currency: 'INR', today: '2026-10-22', timezone: 'Asia/Kolkata' };
  const res = await parseWithLlm(new OpenAiClient('OK', 'gpt-4o-mini'), 'kitna bacha', ctx);
  assert.equal(res.action?.intent, 'budget_remaining');
  assert.equal(last().headers.authorization, 'Bearer OK');
  const tr = await transcribeVoice(new OpenAiStt('OK', 'whisper-1'), audio, 'audio/ogg');
  assert.deepEqual(tr, { ok: true, text: 'milk aur paneer add karo' });
  const raw = last().body.toString('latin1');
  assert.match(raw, /name="model"/); assert.match(raw, /whisper-1/);
  assert.equal(/name="prompt"/.test(raw), false); // never send a prompt: models read it back on silence
});
