// Try the assistant without WhatsApp: a terminal chat that runs the real message pipeline against your database.
//   npm run chat -- --phone 919800000001 --name Aman
// Type messages as that person. "/as 919800000002 Raj" switches to a flatmate, "/quit" leaves.
// Replies are printed instead of being sent. Nothing leaves your machine (no WhatsApp, and no AI unless you set an API key).
import readline from 'node:readline';
import { pool } from '../db/index.js';
import { migrate } from '../db/migrate.js';
import { handleInbound } from '../nlu/pipeline.js';
import { makeLlmClient } from '../nlu/llm.js';
import { DryRunClient } from '../whatsapp/client.js';

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(`--${name}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };

async function main() {
  await migrate(pool);
  let phone = arg('phone', '919800000001'), name = arg('name', 'Aman');
  const wa = new DryRunClient();
  const deps = { pool, wa, llm: makeLlmClient(), stt: null };
  const tty = process.stdin.isTTY;
  if (tty) console.log(`Chatting as ${name} (${phone}). AI: ${deps.llm ? 'on' : 'off (rules only)'}. Try: hi\n`);
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  let n = 0;
  for await (const raw of rl) {
    const line = raw.trim();
    if (!line) continue;
    if (line === '/quit') break;
    const as = line.match(/^\/as\s+(\d{8,15})(?:\s+(.+))?$/);
    if (as) { phone = as[1]; name = as[2] ?? name; console.log(`-- now chatting as ${name} (${phone})`); continue; }
    const before = wa.sent.length;
    const r = await handleInbound(deps, { waMessageId: `cli.${Date.now()}.${++n}`, phone, type: 'text', text: line, profileName: name });
    const replies = wa.sent.slice(before).filter(s => s.to === phone).map(s => s.body);
    if (!replies.length && r.outcome !== 'processed') console.log(`  (${r.outcome})`);
    for (const t of replies) console.log(t.split('\n').map(l => `  bot> ${l}`).join('\n'));
  }
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
