import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseByRules, parseAmount } from '../src/nlu/rules.js';
import { detectLang } from '../src/nlu/lang.js';
import { resolveWhen, zonedToUtc, localDate } from '../src/nlu/tz.js';
import { parseDietAndAllergens } from '../src/nlu/pipeline.js';
import { passesFilter } from '../src/domain/filters.js';
import { t, hasKey } from '../src/nlu/i18n.js';
import { ActionSchema } from '../src/nlu/schema.js';

const msgs: any[] = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../eval/messages200.json'), 'utf8'));

test('eval set: every message not flagged needs_llm is parsed correctly by rules; flagged ones are either left to the model or parsed correctly', () => {
  const problems: string[] = [];
  for (const m of msgs) {
    const r = parseByRules(m.text);
    const e = m.expected;
    if (!r) { if (!m.needs_llm) problems.push(`not handled: ${m.text}`); continue; }
    const ok = r.intent === e.intent && (e.amount == null || r.amount === e.amount) && (e.payer === undefined || ((r.payer ?? null) === null ? null : String(r.payer).toLowerCase()) === (e.payer ?? null)) && (e.budget == null || r.budget === e.budget);
    if (!ok) problems.push(`wrong: ${m.text} -> ${r.intent}`);
  }
  assert.deepEqual(problems, []);
  assert.ok(msgs.length >= 200);
});

test('amounts', () => {
  assert.equal(parseAmount('₹1,200'), 1200); assert.equal(parseAmount('1.5k'), 1500); assert.equal(parseAmount('650/-'), 650); assert.equal(parseAmount('rs 90'), 90); assert.equal(parseAmount('abc'), null);
});

test('language detection follows script', () => {
  assert.equal(detectLang('how much is left?'), 'en'); assert.equal(detectLang('kitna bacha hai'), 'hinglish');
  assert.equal(detectLang('ab kya karein'), 'hinglish'); assert.equal(detectLang('kya karna chahiye'), 'hinglish'); assert.equal(detectLang('what should we do next'), 'en');
  assert.equal(detectLang('कितना बचा'), 'hi'); assert.equal(detectLang('ਕਿੰਨਾ ਬਚਿਆ'), 'pa');
});

test('reminder times resolve in the household time zone and never land in the past', () => {
  const now = new Date('2026-10-22T10:00:00Z'); // 15:30 in Kolkata
  const tonight = resolveWhen({ day: 'today', part: 'night' }, 'Asia/Kolkata', now)!;
  assert.equal(tonight.toISOString(), '2026-10-22T15:30:00.000Z'); // 21:00 IST
  const tomorrow8 = resolveWhen({ day: 'tomorrow', part: 'morning' }, 'Asia/Kolkata', now)!;
  assert.equal(tomorrow8.toISOString(), '2026-10-23T02:30:00.000Z'); // 08:00 IST
  assert.equal(resolveWhen({ day: 'today', part: 'morning' }, 'Asia/Kolkata', now), null); // 08:00 today already passed
  assert.equal(resolveWhen(null, 'Asia/Kolkata', now), null);
  const toronto = resolveWhen({ day: 'tomorrow', hour: 19, minute: 0 }, 'America/Toronto', now)!;
  assert.equal(toronto.toISOString(), '2026-10-23T23:00:00.000Z');
  assert.equal(zonedToUtc('Asia/Kolkata', 2026, 1, 1, 0, 0).toISOString(), '2025-12-31T18:30:00.000Z');
  assert.equal(localDate('Asia/Kolkata', new Date('2026-10-22T20:00:00Z')), '2026-10-23');
});

test('diet and allergy answers are parsed deterministically', () => {
  assert.deepEqual(parseDietAndAllergens('veg, peanut allergy'), { diet: 'veg', allergens: ['peanut'] });
  assert.deepEqual(parseDietAndAllergens('non-veg'), { diet: 'nonveg', allergens: [] });
  assert.deepEqual(parseDietAndAllergens('egg, dairy allergy and gluten allergy'), { diet: 'egg', allergens: ['dairy', 'gluten'] });
  assert.deepEqual(parseDietAndAllergens('veg, allergic to peanut'), { diet: 'veg', allergens: ['peanut'] });
});

test('allergy and diet filter fails closed', () => {
  const r = { id: 'x', diet_tags: ['veg'], allergens: ['dairy'], equipment: ['stove'], prep_minutes: 20, slot: ['lunch'] };
  assert.equal(passesFilter(r, { diets: ['veg'], allergens: [] }), true);
  assert.equal(passesFilter(r, { diets: ['veg'], allergens: ['Dairy'] }), false);
  assert.equal(passesFilter(r, { diets: ['vegan'], allergens: [] }), false);
  assert.equal(passesFilter({ ...r, diet_tags: ['weird'] }, { diets: ['nonveg'], allergens: [] }), false);
  assert.equal(passesFilter(r, { diets: ['veg'], allergens: [], equipment: ['microwave'] }), false);
  // strictest member diet wins
  assert.equal(passesFilter({ ...r, diet_tags: ['egg'] }, { diets: ['nonveg', 'veg'], allergens: [] }), false);
});

test('every reply key used exists and has Hinglish + English', () => {
  for (const k of ['purchase_saved', 'remaining', 'plan_header', 'opted_out', 'welcome_consent']) { assert.ok(hasKey(k)); assert.ok(t('en', k).length > 0); assert.ok(t('hinglish', k).length > 0); }
});

test('the action schema rejects bad model output', () => {
  assert.equal(ActionSchema.safeParse({ intent: 'record_purchase', confidence: 1, amount: -5 }).success, false);
  assert.equal(ActionSchema.safeParse({ intent: 'drop_database', confidence: 1 }).success, false);
  assert.equal(ActionSchema.safeParse({ intent: 'add_items', confidence: 2 }).success, false);
  assert.equal(ActionSchema.safeParse({ intent: 'add_items', confidence: 0.9, items: ['milk'] }).success, true);
});
