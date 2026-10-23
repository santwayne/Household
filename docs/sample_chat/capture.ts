// Runs a scripted day of a 3-person flat through the REAL message pipeline (no WhatsApp, no AI) and saves the exact replies.
//   cd server && DATABASE_URL=postgres://.../some_empty_db npx tsx ../docs/sample_chat/capture.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from '../../server/src/db/index.js';
import { migrate } from '../../server/src/db/migrate.js';
import { handleInbound } from '../../server/src/nlu/pipeline.js';
import { DryRunClient } from '../../server/src/whatsapp/client.js';

const here = dirname(fileURLToPath(import.meta.url));
const P = { Aman: '919800000101', Raj: '919800000102', Priya: '919800000103' } as const;
type Who = keyof typeof P;

await migrate(pool);
await pool.query('delete from households'); await pool.query('delete from message_log'); await pool.query('delete from outbound_messages'); await pool.query('delete from conversation_state');
const wa = new DryRunClient();
const deps = { pool, wa, llm: null, stt: null };
let n = 0;
async function say(who: Who, text: string) {
  const before = wa.sent.length;
  await handleInbound(deps, { waMessageId: `sample.${++n}`, phone: P[who], type: 'text', text, profileName: who });
  return wa.sent.slice(before).filter(s => s.to === P[who]).map(s => s.body);
}

// off-screen setup: Aman starts the household, Raj and Priya join with the invite code
for (const m of ['hi', 'yes', '6000', 'veg']) await say('Aman', m);
const code = (await pool.query(`select code from invites limit 1`)).rows[0].code;
for (const who of ['Raj', 'Priya'] as Who[]) { await say(who, `JOIN ${code}`); await say(who, 'yes'); }

// the day shown on the page
const script: [Who, string][] = [
  ['Aman', 'Aman ne 650 ka saman liya'],
  ['Priya', 'milk aur paneer add karo'],
  ['Raj', 'kitna bacha hai?'],
  ['Aman', '3 din ka plan, budget 900, 3 log, veg'],
  ['Priya', 'aaj raat rajma bhigona yaad dilana'],
  ['Raj', 'curry leaves nahi milte'],
  ['Raj', 'Raj ne 300 ki sabzi li Raj 100 Priya 200'],
  ['Aman', 'kisko kitna dena hai?'],
  ['Raj', 'ab kya karein'],
];
const out: { who: Who; text: string; bot: string[] }[] = [];
for (const [who, text] of script) out.push({ who, text, bot: await say(who, text) });
writeFileSync(join(here, 'transcript.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.map(o => [o.who, o.text, o.bot.length])));
await pool.end();
