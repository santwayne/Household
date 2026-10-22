import { q, type Db } from '../db/index.js';
import { canonicalItem, toBase } from './items.js';

export async function setPantry(db: Db, householdId: string, o: { item: string; qty: number; unit: string; bestBefore?: string | null; leftover?: boolean }) {
  const b = toBase(o.qty, o.unit);
  const [qty, unit] = b ? [b.qty, b.unit] : [o.qty, o.unit]; // store normalised when the unit is known
  await db.query(
    `insert into pantry_items (household_id, item, qty, unit, best_before, is_leftover) values ($1,$2,$3,$4,$5,$6)
     on conflict (household_id, item, unit) do update set qty=excluded.qty, best_before=excluded.best_before, is_leftover=excluded.is_leftover, updated_at=now()`,
    [householdId, canonicalItem(o.item), qty, unit, o.bestBefore ?? null, o.leftover ?? false]);
}
export const listPantry = (db: Db, householdId: string) => q(db, 'select * from pantry_items where household_id=$1 order by best_before nulls last, item', [householdId]);
export const removePantry = (db: Db, householdId: string, id: string) => db.query('delete from pantry_items where id=$1 and household_id=$2', [id, householdId]);
export const expiringSoon = (db: Db, householdId: string, days = 3) =>
  q(db, `select * from pantry_items where household_id=$1 and best_before is not null and best_before <= current_date + $2::int order by best_before`, [householdId, days]);
