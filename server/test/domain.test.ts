import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, mkHousehold } from './helpers.js';
import { recordPurchase, recordContribution, moneySummary, undoLast, recordSettlement } from '../src/domain/ledger.js';
import { addItems, mergedList, markBought } from '../src/domain/shopping.js';
import { generatePlan, getCurrentPlan, swapMeal } from '../src/domain/plans.js';
import { updateHousehold, exportData, deleteMemberData, deleteHousehold } from '../src/domain/households.js';
import { loadPrices } from '../src/domain/pricebook.js';
import { rankProteinPerRupee } from '../src/domain/protein.js';
import { setPantry } from '../src/domain/pantry.js';
import { q } from '../src/db/index.js';

let db: Awaited<ReturnType<typeof freshDb>>;
before(async () => { db = await freshDb(); });

test('purchase updates budget and ledger; retry with same message id is idempotent', async () => {
  db = await freshDb();
  const { household: h, members: [aman, raj] } = await mkHousehold(db);
  const a = await recordPurchase(db, { householdId: h.id, payerId: aman.id, amount: 650, waMessageId: 'wamid.1' });
  const b = await recordPurchase(db, { householdId: h.id, payerId: aman.id, amount: 650, waMessageId: 'wamid.1' });
  assert.equal(a.duplicate, false); assert.equal(b.duplicate, true); assert.equal(a.id, b.id);
  const s = await moneySummary(db, h.id);
  assert.equal(s.spentThisMonth, 650);
  assert.equal(s.remaining, 2350);
  assert.equal(s.balances.find(x => x.memberId === raj.id)!.net, -325);
  assert.equal(s.suggestions[0].amount, 325);
  assert.equal(s.suggestions[0].toName, 'Aman');
});

test('contributions, pool purchases, settlement, undo', async () => {
  db = await freshDb();
  const { household: h, members: [aman, raj] } = await mkHousehold(db);
  await recordContribution(db, { householdId: h.id, memberId: raj.id, amount: 1000 });
  await recordPurchase(db, { householdId: h.id, payerId: aman.id, amount: 400, paidFrom: 'pool' });
  let s = await moneySummary(db, h.id);
  assert.equal(s.potBalance, 600);
  await recordSettlement(db, { householdId: h.id, from: aman.id, to: raj.id, amount: 100 });
  s = await moneySummary(db, h.id);
  assert.equal(Math.round((s.balances.reduce((x, y) => x + y.net, 0) - s.potBalance) * 100), 0); // member nets add up to the kitty cash
  const undone = await undoLast(db, h.id, aman.id);
  assert.equal(undone?.kind, 'settlement');
});

test('invalid inputs are rejected (negative, foreign payer)', async () => {
  db = await freshDb();
  const one = await mkHousehold(db);
  const two = await mkHousehold(db, ['Zed']);
  await assert.rejects(recordPurchase(db, { householdId: one.household.id, payerId: one.members[0].id, amount: -5 }));
  await assert.rejects(recordPurchase(db, { householdId: one.household.id, payerId: two.members[0].id, amount: 100 }));
});

test('price book learns from logged item prices', async () => {
  db = await freshDb();
  const { household: h, members: [a] } = await mkHousehold(db);
  const before = (await loadPrices(db, h.id)).get('paneer')!;
  assert.equal(before.source, 'default');
  await recordPurchase(db, { householdId: h.id, payerId: a.id, amount: 100, items: [{ item: 'paneer', qty: 250, unit: 'g', price: 100 }] });
  const after = (await loadPrices(db, h.id)).get('paneer')!;
  assert.equal(after.source, 'purchase');
  assert.equal(after.price, 400); // 100 for 250 g -> 400/kg
});

test('shopping list merges manual + plan rows; pantry subtracts safely', async () => {
  db = await freshDb();
  const { household: h, members: [a] } = await mkHousehold(db);
  await addItems(db, h.id, ['milk', '1 kg rice', '2 kg rice'], a.id, 'wamid.x');
  await addItems(db, h.id, ['milk'], a.id, 'wamid.x'); // retry
  await setPantry(db, h.id, { item: 'rice', qty: 500, unit: 'g' });
  const list = await mergedList(db, h.id);
  const rice = list.find(i => i.item === 'rice')!;
  assert.equal(rice.qty, 3000); assert.equal(rice.toBuyQty, 2500);
  assert.equal(list.filter(i => i.item === 'milk').length, 1);
  await markBought(db, h.id, 'milk', a.id);
  assert.equal((await mergedList(db, h.id)).find(i => i.item === 'milk')!.status, 'bought');
});

test('budget-fit plan stays within budget, honours diet and allergies, swap touches only that meal', async () => {
  db = await freshDb();
  const { household: h, members } = await mkHousehold(db, ['Aman', 'Raj'], { diet: 'veg', allergens: ['dairy'] });
  const plan = await generatePlan(db, h.id, { budget: 1200, days: 7, servings: 2 });
  assert.ok(plan.fits, plan.notes.join('; '));
  assert.ok(plan.estTotal <= 1200);
  const cur = await getCurrentPlan(db, h.id);
  assert.equal(cur!.meals.length, 14);
  const ids = cur!.meals.map((m: any) => m.recipe_id);
  const recipes = await q(db, 'select id, diet_tags, allergens from recipes where id = any($1)', [ids]);
  for (const r of recipes) { assert.ok(!r.allergens.includes('dairy')); assert.ok(!r.diet_tags.includes('nonveg') && !r.diet_tags.includes('egg')); }

  const before = await q(db, 'select id, source_meal_id, item from shopping_list_items where household_id=$1', [h.id]);
  const target = cur!.meals[3];
  await swapMeal(db, h.id, target.id);
  const after = await q(db, 'select id, source_meal_id, item from shopping_list_items where household_id=$1', [h.id]);
  const untouchedBefore = before.filter((r: any) => r.source_meal_id !== target.id).map((r: any) => r.id).sort();
  const untouchedAfter = after.filter((r: any) => r.source_meal_id !== target.id).map((r: any) => r.id).sort();
  assert.deepEqual(untouchedAfter, untouchedBefore);
});

test('impossible budget is reported honestly, never silently exceeded', async () => {
  db = await freshDb();
  const { household: h } = await mkHousehold(db);
  const plan = await generatePlan(db, h.id, { budget: 50, days: 7, servings: 2 });
  assert.equal(plan.fits, false);
  assert.ok(plan.shortfall > 0);
});

test('protein per rupee ranks soya/dal above paneer', async () => {
  db = await freshDb();
  const { household: h } = await mkHousehold(db);
  const rank = rankProteinPerRupee(await loadPrices(db, h.id));
  const pos = (n: string) => rank.findIndex(r => r.item === n);
  assert.ok(pos('soya chunks') < pos('paneer'));
});

test('tenant isolation: one household cannot read another household\'s data through any domain function', async () => {
  db = await freshDb();
  const A = await mkHousehold(db, ['Anu', 'Ben']);
  const B = await mkHousehold(db, ['Cara', 'Dev']);
  await recordPurchase(db, { householdId: A.household.id, payerId: A.members[0].id, amount: 777 });
  await addItems(db, A.household.id, ['secret item'], A.members[0].id);
  await generatePlan(db, A.household.id, { budget: 1500, days: 3, servings: 2 });
  const sB = await moneySummary(db, B.household.id);
  assert.equal(sB.spentThisMonth, 0);
  assert.equal((await mergedList(db, B.household.id)).length, 0);
  assert.equal(await getCurrentPlan(db, B.household.id), null);
  const exp = await exportData(db, B.household.id, B.members[0].id);
  assert.equal(JSON.stringify(exp).includes('777'), false);
  assert.equal(JSON.stringify(exp).includes('secret item'), false);
  await assert.rejects(markBought(db, B.household.id, 'secret item', B.members[0].id));
  const hb = await q(db, 'select * from planned_meals pm join meal_plans mp on mp.id=pm.plan_id where mp.household_id=$1', [B.household.id]);
  assert.equal(hb.length, 0);
  // cross-household mutation attempts fail
  const aMeal = (await getCurrentPlan(db, A.household.id))!.meals[0];
  await assert.rejects(swapMeal(db, B.household.id, aMeal.id));
});

test('data deletion: member erase keeps balances, household delete removes everything', async () => {
  db = await freshDb();
  const { household: h, members: [a, b] } = await mkHousehold(db);
  await recordPurchase(db, { householdId: h.id, payerId: a.id, amount: 200 });
  await deleteMemberData(db, h.id, b.id);
  const s = await moneySummary(db, h.id);
  assert.equal(s.balances.reduce((x, y) => x + y.net, 0), 0);
  await deleteHousehold(db, h.id);
  assert.equal((await q(db, 'select * from purchases')).length, 0);
  assert.equal((await q(db, 'select * from members')).length, 0);
});

test('household settings update', async () => {
  db = await freshDb();
  const { household: h, members: [a] } = await mkHousehold(db);
  const u = await updateHousehold(db, h.id, a.id, { monthly_budget: 5000, diet: 'egg' });
  assert.equal(u.monthly_budget, 5000); assert.equal(u.diet, 'egg');
});

test('schedule: when nobody is free to cook, that slot gets a quick recipe and no cook; free members are assigned', async () => {
  const { updateMember } = await import('../src/domain/households.js');
  db = await freshDb();
  const { household: h, members: [a, b] } = await mkHousehold(db, ['Aman', 'Raj'], { diet: 'veg' });
  const start = '2026-11-02'; // a Monday
  await updateMember(db, h.id, a.id, { schedule_prefs: { busy: ['mon:dinner', 'tue:lunch'] } });
  await updateMember(db, h.id, b.id, { schedule_prefs: { busy: ['mon:dinner'] } });
  await assert.rejects(updateMember(db, h.id, a.id, { schedule_prefs: { busy: ['funday:dinner'] } }));
  const plan = await generatePlan(db, h.id, { budget: 3000, days: 3, servings: 2, startDate: start });
  const cur = await getCurrentPlan(db, h.id);
  const monDinner = cur!.meals.find((m: any) => m.day === '2026-11-02' && m.slot === 'dinner');
  assert.equal(monDinner.assigned_cook, null);                          // both busy
  const r = (await q(db, 'select prep_minutes from recipes where id=$1', [monDinner.recipe_id]))[0];
  assert.ok(r.prep_minutes <= 20, `quick recipe expected, got ${r.prep_minutes} min`);
  const tueLunch = cur!.meals.find((m: any) => m.day === '2026-11-03' && m.slot === 'lunch');
  assert.equal(tueLunch.assigned_cook, b.id);                           // only Raj is free
  assert.ok(plan.fits);
});

test('preference signals: a recipe swapped away repeatedly stops being chosen; a liked one is preferred', async () => {
  const { markCooked } = await import('../src/domain/plans.js');
  db = await freshDb();
  const { household: h } = await mkHousehold(db, ['Aman', 'Raj'], { diet: 'veg' });
  const first = await generatePlan(db, h.id, { budget: 3000, days: 2, servings: 2, startDate: '2026-11-02' });
  const meals = (await getCurrentPlan(db, h.id))!.meals;
  const disliked = meals[0].recipe_id;
  for (let i = 0; i < 3; i++) await db.query(`insert into meal_feedback (household_id, recipe_id, signal, kind) values ($1,$2,-1,'swapped_away')`, [h.id, disliked]);
  const again = await generatePlan(db, h.id, { budget: 3000, days: 2, servings: 2, startDate: '2026-11-02' });
  assert.ok(!(await getCurrentPlan(db, h.id))!.meals.some((m: any) => m.recipe_id === disliked));
  // swapping a meal records the signal; a 5-star rating records a positive one
  const m0 = (await getCurrentPlan(db, h.id))!.meals[0];
  await swapMeal(db, h.id, m0.id);
  await markCooked(db, h.id, (await getCurrentPlan(db, h.id))!.meals[1].id, 5);
  const fb = await q(db, 'select kind, signal from meal_feedback where household_id=$1 order by at', [h.id]);
  assert.ok(fb.some((f: any) => f.kind === 'swapped_away') && fb.some((f: any) => f.kind === 'rating' && f.signal === 2));
  assert.ok(first.meals.length === 4 && again.meals.length === 4);
});

test('recipe data: every ingredient is priced, allergens/diet are derived from ingredients, and each diet has real choice', async () => {
  const { RECIPES, deriveFromIngredients, SUBSTITUTIONS } = await import('../src/domain/data.js');
  const { estimateCost } = await import('../src/domain/pricebook.js');
  db = await freshDb();
  const { household: h } = await mkHousehold(db);
  const prices = await loadPrices(db, h.id);
  assert.ok(RECIPES.length >= 60);
  assert.equal(new Set(RECIPES.map(r => r.id)).size, RECIPES.length);
  for (const r of RECIPES) {
    for (const ing of r.ing) assert.notEqual(estimateCost(prices, ing.item, ing.qty, ing.unit), null, `${r.id}: no price/unit for ${ing.item}`);
    assert.ok(r.protein >= 3 && r.protein <= 60, `${r.id} protein ${r.protein}`);
  }
  const rows = await q(db, 'select id, diet_tags, allergens from recipes');
  assert.equal(rows.length, RECIPES.length);
  for (const r of RECIPES) {
    const d = deriveFromIngredients(r); const row = rows.find((x: any) => x.id === r.id);
    assert.deepEqual([...row.allergens].sort(), d.allergens, `${r.id} allergens`);
    assert.deepEqual(row.diet_tags, [d.diet], `${r.id} diet`);
  }
  // a recipe that lists paneer can never be dairy-free or vegan, one with eggs is never "veg"
  assert.ok(rows.find((x: any) => x.id === 'paneer-bhurji-roti').allergens.includes('dairy'));
  assert.ok(rows.find((x: any) => x.id === 'upma').allergens.includes('mustard'));
  const byDiet = (d: string) => rows.filter((x: any) => x.diet_tags[0] === d).length;
  assert.ok(byDiet('vegan') >= 15 && byDiet('veg') >= 8 && byDiet('egg') >= 3 && byDiet('nonveg') >= 3);
  const regions = new Map<string, number>(); for (const r of RECIPES) regions.set(r.region, (regions.get(r.region) ?? 0) + 1);
  for (const reg of ['punjabi', 'gujarati', 'south', 'bengali', 'maharashtrian', 'rajasthani']) assert.ok((regions.get(reg) ?? 0) >= 3, reg);
  assert.ok(SUBSTITUTIONS.length >= 25);
});

test('plans work for strict households: vegan with peanut + gluten allergies, and a non-veg household', async () => {
  db = await freshDb();
  const strict = await mkHousehold(db, ['Aman', 'Raj'], { diet: 'vegan', allergens: ['peanut', 'gluten', 'mustard'] });
  const p1 = await generatePlan(db, strict.household.id, { budget: 2500, days: 5, servings: 2, startDate: '2026-11-02' });
  assert.ok(p1.meals.length > 0 && p1.fits, p1.notes.join('; '));
  const used = await q(db, 'select diet_tags, allergens from recipes where id = any($1)', [p1.meals.map(m => m.recipeId)]);
  for (const r of used) { assert.deepEqual(r.diet_tags, ['vegan']); for (const a of ['peanut', 'gluten', 'mustard']) assert.ok(!r.allergens.includes(a)); }
  const nv = await mkHousehold(db, ['Cara', 'Dev'], { diet: 'nonveg' });
  const p2 = await generatePlan(db, nv.household.id, { budget: 4000, days: 7, servings: 2, startDate: '2026-11-02' });
  assert.ok(p2.fits && new Set(p2.meals.map(m => m.recipeId)).size >= 7, 'a week should not repeat the same few dishes');
});

test('per-meal servings: only that meal\'s cost and shopping rows change', async () => {
  const { setMealServings } = await import('../src/domain/plans.js');
  db = await freshDb();
  const { household: h } = await mkHousehold(db, ['Aman', 'Raj'], { diet: 'veg' });
  await generatePlan(db, h.id, { budget: 3000, days: 2, servings: 2, startDate: '2026-11-02' });
  const meals = (await getCurrentPlan(db, h.id))!.meals;
  const target = meals[1];
  const before = await q(db, 'select id, source_meal_id, qty from shopping_list_items where household_id=$1 order by id', [h.id]);
  const r = await setMealServings(db, h.id, target.id, 4);
  assert.ok(Math.abs(r.estCost - target.est_cost * 2) < 0.05, `cost ${r.estCost} should be double ${target.est_cost}`);
  const after = await q(db, 'select id, source_meal_id, qty from shopping_list_items where household_id=$1 order by id', [h.id]);
  const others = (rows: any[]) => rows.filter(x => x.source_meal_id !== target.id).map(x => `${x.id}:${x.qty}`).sort();
  assert.deepEqual(others(after), others(before));
  const mine = (rows: any[]) => rows.filter(x => x.source_meal_id === target.id).reduce((s, x) => s + Number(x.qty), 0);
  assert.ok(Math.abs(mine(after) - mine(before) * 2) < 0.5);
  const plan = (await getCurrentPlan(db, h.id))!;
  assert.equal(plan.meals.find((m: any) => m.id === target.id).servings, 4);
  assert.ok(Math.abs(plan.est_total - (meals.reduce((s: number, m: any) => s + m.est_cost, 0) + r.estCost - target.est_cost)) < 0.05);
  await assert.rejects(setMealServings(db, h.id, target.id, 0)); await assert.rejects(setMealServings(db, h.id, target.id, 31));
  const other = await mkHousehold(db, ['Zed']);
  await assert.rejects(setMealServings(db, other.household.id, target.id, 3)); // another household's meal
});
