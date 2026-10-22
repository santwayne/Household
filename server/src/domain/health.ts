import { q, type Db } from '../db/index.js';

// General balance feedback only. Not medical advice. Personal logs are private by default.
export async function logMeal(db: Db, o: { householdId: string; memberId: string; meal: string; kind?: 'home' | 'ordered' | 'outside'; hasVegetables?: boolean; hasProtein?: boolean; date?: string; shared?: boolean; waMessageId?: string }) {
  const r = await db.query(
    `insert into meal_logs (member_id, household_id, meal, kind, has_vegetables, has_protein, date, shared_with_household, wa_message_id)
     values ($1,$2,$3,$4,$5,$6, coalesce($7::date, current_date), $8, $9) on conflict (wa_message_id) do nothing returning id`,
    [o.memberId, o.householdId, o.meal, o.kind ?? 'home', o.hasVegetables ?? false, o.hasProtein ?? false, o.date ?? null, o.shared ?? false, o.waMessageId ?? null]);
  return { duplicate: r.rowCount === 0 };
}

export type Balance = { total: number; home: number; ordered: number; withVeg: number; withProtein: number; tips: { key: 'few_logs' | 'more_veg' | 'more_protein' | 'ordered_often' | 'looks_balanced'; }[] };

export async function weeklyBalance(db: Db, householdId: string, memberId: string): Promise<Balance> {
  const [r] = await q<{ total: number; home: number; ordered: number; veg: number; prot: number }>(db,
    `select count(*) as total, count(*) filter (where kind='home') as home, count(*) filter (where kind<>'home') as ordered,
            count(*) filter (where has_vegetables) as veg, count(*) filter (where has_protein) as prot
       from meal_logs where household_id=$1 and member_id=$2 and date >= current_date - 6`, [householdId, memberId]);
  const tips: Balance['tips'] = [];
  if (r.total < 4) tips.push({ key: 'few_logs' });
  else {
    if (r.veg / r.total < 0.5) tips.push({ key: 'more_veg' });
    if (r.prot / r.total < 0.5) tips.push({ key: 'more_protein' });
    if (r.ordered / r.total > 0.4) tips.push({ key: 'ordered_often' });
    if (!tips.length) tips.push({ key: 'looks_balanced' });
  }
  return { total: r.total, home: r.home, ordered: r.ordered, withVeg: r.veg, withProtein: r.prot, tips };
}

/** Shared view: only members who opted in, only aggregate counts (never meal text). */
export async function sharedSummary(db: Db, householdId: string) {
  return q(db,
    `select m.name, count(*) as meals, count(*) filter (where l.kind='home') as home_cooked
       from meal_logs l join members m on m.id=l.member_id
      where l.household_id=$1 and l.shared_with_household and l.date >= current_date - 6 group by m.name`, [householdId]);
}

export const listMyLogs = (db: Db, householdId: string, memberId: string, limit = 30) =>
  q(db, 'select id, meal, kind, has_vegetables, has_protein, date, shared_with_household from meal_logs where household_id=$1 and member_id=$2 order by date desc, created_at desc limit $3', [householdId, memberId, limit]);

export async function setLogShared(db: Db, householdId: string, memberId: string, shared: boolean) {
  await db.query('update meal_logs set shared_with_household=$3 where household_id=$1 and member_id=$2', [householdId, memberId, shared]);
}
