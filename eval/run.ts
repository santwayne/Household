// Evaluation harness (Developer Brief section 5). Run on every prompt or model change:  npm run eval
// Reports parse accuracy (rules only, and rules + model when an API key is configured), correction/confirmation/ cost per message.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseByRules } from '../server/src/nlu/rules.js';
import { makeLlmClient, parseWithLlm, costUsd } from '../server/src/nlu/llm.js';

const dir = dirname(fileURLToPath(import.meta.url));
const msgs: any[] = JSON.parse(readFileSync(join(dir, 'messages200.json'), 'utf8'));
const norm = (v: unknown) => (typeof v === 'string' ? v.toLowerCase().trim() : v ?? null);
const sameSet = (a: string[] = [], b: string[] = []) => a.length === b.length && [...a].map(s => s.toLowerCase().trim()).sort().join('|') === [...b].map(s => s.toLowerCase().trim()).sort().join('|');

function matches(expected: any, got: any): { ok: boolean; why?: string } {
  if (!got) return { ok: false, why: 'no parse' };
  for (const [k, v] of Object.entries(expected)) {
    if (k === 'items') { if (!sameSet(v as string[], got.items ?? [])) return { ok: false, why: `items ${JSON.stringify(got.items)}` }; continue; }
    if (k === 'text') continue;
    if (norm(got[k]) !== norm(v)) return { ok: false, why: `${k}: expected ${JSON.stringify(v)} got ${JSON.stringify(got[k])}` };
  }
  return { ok: true };
}

const llm = makeLlmClient();
let rulesParsed = 0, rulesCorrect = 0, rulesWrong: any[] = [], unparsed = 0, llmTried = 0, llmCorrect = 0, llmRejected = 0, cost = 0, lowConf = 0;
const byKind: Record<string, { n: number; ok: number }> = {};
const bump = (k: string, ok: boolean) => { (byKind[k] ??= { n: 0, ok: 0 }).n++; if (ok) byKind[k].ok++; };

for (const m of msgs) {
  const r = parseByRules(m.text);
  let ok = false;
  if (r) {
    rulesParsed++;
    const c = matches(m.expected, r);
    if (c.ok) { rulesCorrect++; ok = true; } else rulesWrong.push({ id: m.id, text: m.text, why: c.why });
  } else {
    unparsed++;
    if (llm) {
      llmTried++;
      const p = await parseWithLlm(llm, m.text, { memberNames: ['Aman', 'Raj', 'Priya', 'Simran', 'Rahul', 'Neha', 'Gurpreet', 'Karan'], senderName: 'Aman', currency: 'INR', today: '2026-10-22', timezone: 'Asia/Kolkata' });
      if (p.usage) cost += costUsd(p.usage);
      if (!p.action) llmRejected++;
      else { if (p.action.confidence < 0.85 || p.action.needs_confirmation) lowConf++; const c = matches(m.expected, p.action); if (c.ok) { llmCorrect++; ok = true; } }
    }
  }
  bump(m.kind, ok);
}
const total = msgs.length;
const rulesOnly = rulesCorrect / total;
const withLlm = (rulesCorrect + llmCorrect) / total;
const report = {
  total, note: 'Synthetic messages written by the team; replace/extend with real messages from interviews and the pilot.',
  rules: { handled: rulesParsed, correct: rulesCorrect, wrong: rulesParsed - rulesCorrect, precisionOnHandled: rulesParsed ? +(rulesCorrect / rulesParsed).toFixed(3) : null, accuracyOverAll: +rulesOnly.toFixed(3) },
  passedToModel: unparsed,
  model: llm ? { tried: llmTried, correct: llmCorrect, rejectedBySchema: llmRejected, askedForConfirmation: lowConf, costUsd: +cost.toFixed(5), costPerMessageUsd: llmTried ? +(cost / llmTried).toFixed(6) : null, accuracyOverAll: +withLlm.toFixed(3) } : 'not run (set ANTHROPIC_API_KEY or OPENAI_API_KEY)',
  phase1Threshold: 0.9,
  meetsThreshold: llm ? withLlm >= 0.9 : 'unknown: model path not evaluated',
  byKind, rulesWrong,
};
writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report, rulesWrong: report.rulesWrong.length ? report.rulesWrong : 'none', byKind: undefined }, null, 1));
console.table(Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, { messages: v.n, correct: v.ok, pct: Math.round((v.ok / v.n) * 100) + '%' }])));
