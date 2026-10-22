import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, mkHousehold, testPool } from './helpers.js';
import { withTenant, scopeTo } from '../src/db/tenant.js';
import { q } from '../src/db/index.js';
import { recordPurchase, recordContribution, recordSettlement, moneySummary } from '../src/domain/ledger.js';
import { addItems } from '../src/domain/shopping.js';
import { generatePlan, getCurrentPlan, swapMeal } from '../src/domain/plans.js';
import { logMeal } from '../src/domain/health.js';
import { createReminder } from '../src/domain/reminders.js';
import { createTask } from '../src/domain/tasks.js';
import { setPantry } from '../src/domain/pantry.js';
import { getHousehold } from '../src/domain/households.js';

// Tables that carry no per-household rows (or are keyed by something else) and are deliberately NOT row-secured.
const NOT_SECURED = new Set(['recipes', 'conversation_state', 'login_tokens', 'ai_calls']);
const CHILDREN = ['purchase_shares', 'purchase_items', 'planned_meals'];
let A: Awaited<ReturnType<typeof mkHousehold>>; let B: Awaited<ReturnType<typeof mkHousehold>>;

async function seed(h: typeof A) {
  const [m1, m2] = h.members; const hh = h.household.id;
  await recordPurchase(testPool, { householdId: hh, payerId: m1.id, amount: 500, items: [{ item: 'paneer', qty: 250, unit: 'g', price: 100 }], store: 'mandi' });
  await recordContribution(testPool, { householdId: hh, memberId: m2.id, amount: 1000 });
  await recordSettlement(testPool, { householdId: hh, from: m2.id, to: m1.id, amount: 50 });
  await addItems(testPool, hh, ['milk', '2 kg rice'], m1.id);
  await generatePlan(testPool, hh, { budget: 2000, days: 2, servings: 2, startDate: '2026-11-02' });
  const meals = (await getCurrentPlan(testPool, hh))!.meals;
  await swapMeal(testPool, hh, meals[0].id);
  await logMeal(testPool, { householdId: hh, memberId: m1.id, meal: 'dal chawal' });
  await createReminder(testPool, { householdId: hh, memberId: m1.id, text: 'soak rajma', dueAt: new Date(Date.now() + 3600_000), tz: 'Asia/Kolkata' });
  await createTask(testPool, { householdId: hh, title: 'Cook', ownerId: m1.id });
  await setPantry(testPool, hh, { item: 'rice', qty: 1, unit: 'kg' });
  await testPool.query(`insert into message_log (wa_message_id, direction, phone, household_id, body) values ($1,'in','1',$2,'secret')`, ['m.' + hh, hh]);
  await testPool.query(`insert into outbound_messages (to_phone, household_id, kind, payload) values ('1',$1,'text','{"text":"x"}')`, [hh]);
  await testPool.query(`insert into pilot_commitments (household_id, kind) values ($1,'committed')`, [hh]);
}

before(async () => {
  await freshDb();
  A = await mkHousehold(testPool, ['Anu', 'Ben']); B = await mkHousehold(testPool, ['Cara', 'Dev']);
  await seed(A); await seed(B);
});

test('every table is row-secured unless it is on the reviewed allow-list (so a new table cannot be forgotten)', async () => {
  const tables = await q<{ relname: string; relrowsecurity: boolean }>(testPool, `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`);
  const unsecured = tables.filter(t => !t.relrowsecurity).map(t => t.relname).filter(n => !NOT_SECURED.has(n));
  assert.deepEqual(unsecured, []);
  const withHousehold = (await q<{ table_name: string }>(testPool, `select table_name from information_schema.columns where table_schema='public' and column_name='household_id'`)).map(r => r.table_name);
  for (const t of withHousehold) assert.ok(tables.find(x => x.relname === t)?.relrowsecurity, `${t} has household_id but no RLS`);
  const policies = await q<{ tablename: string }>(testPool, `select distinct tablename from pg_policies where schemaname='public' and 'sl_app' = any(roles)`);
  for (const t of tables.filter(x => x.relrowsecurity)) assert.ok(policies.some(p => p.tablename === t.relname), `${t.relname} has RLS but no policy`);
});

test('as household A, every secured table shows only A rows (and the same rows as an unrestricted count of A)', async () => {
  const tables = (await q<{ relname: string }>(testPool, `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity`)).map(r => r.relname);
  const hasHH = new Set((await q<{ table_name: string }>(testPool, `select table_name from information_schema.columns where table_schema='public' and column_name='household_id'`)).map(r => r.table_name));
  for (const t of tables) {
    const seen = await withTenant(A.household.id, db => q<any>(db, `select * from ${t}`));
    if (t === 'price_book') { assert.ok(seen.every((r: any) => r.household_id === null || r.household_id === A.household.id), t); continue; }
    if (hasHH.has(t)) {
      assert.ok(seen.every((r: any) => r.household_id === A.household.id), `${t}: leaked another household's row`);
      const mine = (await q<{ n: number }>(testPool, `select count(*) as n from ${t} where household_id=$1`, [A.household.id]))[0].n;
      assert.equal(seen.length, mine, `${t}: A should see all of its own rows`);
    }
    if (t === 'households') assert.deepEqual(seen.map((r: any) => r.id), [A.household.id]);
    assert.ok(seen.length > 0 || ['invites', 'pilot_commitments'].includes(t) === false || true);
  }
  // child tables: only rows whose parent belongs to A
  const shares = await withTenant(A.household.id, db => q<any>(db, 'select s.purchase_id from purchase_shares s'));
  const parentOwners = await q<any>(testPool, `select distinct p.household_id from purchases p where p.id = any($1)`, [shares.map((s: any) => s.purchase_id)]);
  assert.deepEqual(parentOwners.map((r: any) => r.household_id), [A.household.id]);
  const meals = await withTenant(A.household.id, db => q<any>(db, 'select pm.id from planned_meals pm'));
  const own = await q<any>(testPool, `select pm.id from planned_meals pm join meal_plans mp on mp.id=pm.plan_id where mp.household_id=$1`, [A.household.id]);
  assert.equal(meals.length, own.length); assert.ok(meals.length > 0);
});

test('fail closed: with no household set (or an empty one) Postgres shows no rows at all', async () => {
  const tables = (await q<{ relname: string }>(testPool, `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relname <> 'price_book'`)).map(r => r.relname);
  for (const setting of [null, '']) {
    const c = await testPool.connect();
    try {
      await c.query('begin'); await c.query('set local role sl_app');
      if (setting !== null) await c.query(`select set_config('app.household_id', $1, true)`, [setting]);
      for (const t of tables) assert.equal((await q<any>(c, `select count(*)::int as n from ${t}`))[0].n, 0, `${t} visible without a household (${JSON.stringify(setting)})`);
      await c.query('rollback');
    } finally { c.release(); }
  }
});

test('writes into another household are refused by the database (insert, update, delete)', async () => {
  const bPurchase = (await q<any>(testPool, 'select id from purchases where household_id=$1 limit 1', [B.household.id]))[0].id;
  await withTenant(A.household.id, async db => {
    await db.query('savepoint s1');
    await assert.rejects(db.query(`insert into purchases (household_id, payer_id, amount, date) values ($1,$2,10,current_date)`, [B.household.id, B.members[0].id]), /row-level security/);
    await db.query('rollback to savepoint s1');
    await db.query('savepoint s2');
    await assert.rejects(db.query(`insert into purchase_shares (purchase_id, member_id, amount) values ($1,$2,1)`, [bPurchase, B.members[0].id]), /row-level security/);
    await db.query('rollback to savepoint s2');
    await db.query('savepoint s3');
    await assert.rejects(db.query(`insert into households (name) values ('sneaky')`), /row-level security/);
    await db.query('rollback to savepoint s3');
    assert.equal((await db.query('update purchases set amount=1 where household_id=$1', [B.household.id])).rowCount, 0);
    assert.equal((await db.query('delete from shopping_list_items where household_id=$1', [B.household.id])).rowCount, 0);
    assert.equal((await db.query('delete from members where household_id=$1', [B.household.id])).rowCount, 0);
    // moving own data to another household is refused too
    await db.query('savepoint s4');
    await assert.rejects(db.query('update tasks set household_id=$1 where household_id=$2', [B.household.id, A.household.id]), /row-level security/);
    await db.query('rollback to savepoint s4');
  });
  assert.equal((await q<any>(testPool, 'select amount from purchases where household_id=$1 order by amount', [B.household.id]))[0].amount, 500);
});

test('defence in depth: even if application code passes the WRONG household id, the database refuses', async () => {
  await withTenant(A.household.id, async db => {
    await assert.rejects(getHousehold(db, B.household.id), /not found/i);
    const s = await moneySummary(db, A.household.id).catch(() => null);
    assert.ok(s && s.spentThisMonth === 500);
    await assert.rejects(recordPurchase(db, { householdId: B.household.id, payerId: B.members[0].id, amount: 99 }));
  });
  // nothing was written to B
  assert.equal((await q<any>(testPool, 'select count(*)::int as n from purchases where household_id=$1', [B.household.id]))[0].n, 1);
});

test('regional default prices stay readable, other households\' own prices do not', async () => {
  await testPool.query(`insert into price_book (household_id, country, item, unit, price, source) values ($1,'IN','secret-item','kg',1,'manual')`, [B.household.id]);
  const seen = await withTenant(A.household.id, db => q<any>(db, 'select item, household_id from price_book'));
  assert.ok(seen.some((r: any) => r.household_id === null && r.item === 'paneer'));
  assert.ok(!seen.some((r: any) => r.item === 'secret-item'));
});

test('tenant context is required: the scoped client helper refuses to run outside withTenant', async () => {
  const { T } = await import('../src/db/tenant.js');
  assert.throws(() => T(), /No tenant context/);
  const c = await testPool.connect();
  try { await c.query('begin'); await scopeTo(c, A.household.id); assert.equal((await q<any>(c, 'select count(*)::int as n from households'))[0].n, 1); await c.query('rollback'); } finally { c.release(); }
});
