import { q, one, type Db } from '../db/index.js';
import { loadPrices, estimateCost, learnPrice } from './pricebook.js';
import { getHousehold } from './households.js';
import { parseItemPhrase, toBase, canonicalItem } from './items.js';
import { NotFoundError } from './scope.js';

export type ListRow = { id: string; item: string; qty: number | null; unit: string | null; status: string; assigned_to: string | null; source_meal_id: string | null; est_price: number | null; actual_price: number | null };

export async function addItems(db: Db, householdId: string, phrases: string[], addedBy: string | null, waMessageId?: string) {
  const h = await getHousehold(db, householdId);
  const prices = await loadPrices(db, householdId, h.country);
  const added: { item: string; qty: number | null; unit: string | null }[] = [];
  for (const phrase of phrases) {
    const p = parseItemPhrase(phrase);
    if (!p.item) continue;
    if (waMessageId) {
      const ex = await one(db, 'select 1 from shopping_list_items where household_id=$1 and wa_message_id=$2 and item=$3 and qty is not distinct from $4 and unit is not distinct from $5', [householdId, waMessageId, p.item, p.qty, p.unit]);
      if (ex) continue; // retry of the same message
    }
    const est = p.qty != null ? estimateCost(prices, p.item, p.qty, p.unit) : null;
    await db.query(
      'insert into shopping_list_items (household_id, item, qty, unit, est_price, added_by, wa_message_id) values ($1,$2,$3,$4,$5,$6,$7)',
      [householdId, p.item, p.qty, p.unit, est, addedBy, waMessageId ?? null]);
    added.push(p);
  }
  return added;
}

export type MergedItem = {
  item: string; unit: string | null; qty: number | null; pantryQty: number | null; toBuyQty: number | null;
  status: 'open' | 'bought'; assignedTo: string | null; estPrice: number | null; actualPrice: number | null; rowIds: string[]; mealIds: string[];
};

/** One merged list: manual adds and plan-derived rows combine; pantry stock is subtracted only when units normalise safely. */
export async function mergedList(db: Db, householdId: string): Promise<MergedItem[]> {
  const rows = await q<ListRow>(db, `select * from shopping_list_items where household_id=$1 and status<>'removed' order by created_at`, [householdId]);
  const pantry = await q<{ item: string; qty: number; unit: string }>(db, 'select item, qty, unit from pantry_items where household_id=$1', [householdId]);
  const groups = new Map<string, MergedItem & { _base: boolean }>();
  for (const r of rows) {
    const b = r.qty != null ? toBase(r.qty, r.unit) : null;
    const key = `${r.item}|${b ? b.unit : (r.unit ?? '')}|${r.status}`;
    const g = groups.get(key) ?? { item: r.item, unit: b ? b.unit : r.unit, qty: r.qty == null ? null : 0, pantryQty: null, toBuyQty: null, status: r.status as 'open' | 'bought', assignedTo: r.assigned_to, estPrice: null, actualPrice: null, rowIds: [], mealIds: [], _base: !!b };
    if (r.qty != null) g.qty = (g.qty ?? 0) + (b ? b.qty : r.qty);
    if (r.est_price != null) g.estPrice = (g.estPrice ?? 0) + r.est_price;
    if (r.actual_price != null) g.actualPrice = (g.actualPrice ?? 0) + r.actual_price;
    g.rowIds.push(r.id);
    if (r.source_meal_id) g.mealIds.push(r.source_meal_id);
    groups.set(key, g);
  }
  const out: MergedItem[] = [];
  for (const g of groups.values()) {
    if (g.status === 'open' && g.qty != null && g._base) {
      const have = pantry.filter(p => p.item === g.item).map(p => toBase(p.qty, p.unit)).filter(b => b && b.unit === g.unit) as { qty: number }[];
      const haveQty = have.reduce((s, b) => s + b.qty, 0);
      g.pantryQty = haveQty || null;
      g.toBuyQty = Math.max(0, g.qty - haveQty);
    } else g.toBuyQty = g.qty;
    const { _base, ...rest } = g;
    out.push(rest);
  }
  return out.sort((a, b) => a.item.localeCompare(b.item));
}

export async function markBought(db: Db, householdId: string, itemOrId: string, byMember: string, actualPrice?: number | null) {
  const name = canonicalItem(itemOrId);
  const rows = await q<ListRow>(db,
    `select * from shopping_list_items where household_id=$1 and status='open' and (id::text=$2 or item=$3)`, [householdId, itemOrId, name]);
  if (!rows.length) throw new NotFoundError('Item not on the list');
  for (const r of rows) {
    await db.query(`update shopping_list_items set status='bought', bought_at=now(), actual_price=coalesce($3, actual_price), assigned_to=coalesce(assigned_to,$4) where id=$1 and household_id=$2`,
      [r.id, householdId, rows.length === 1 ? (actualPrice ?? null) : null, byMember]);
    if (actualPrice && rows.length === 1 && r.qty) await learnPrice(db, householdId, r.item, r.qty, r.unit, actualPrice);
  }
  return rows.length;
}

export async function removeItem(db: Db, householdId: string, itemOrId: string) {
  const name = canonicalItem(itemOrId);
  const r = await db.query(`update shopping_list_items set status='removed' where household_id=$1 and status='open' and (id::text=$2 or item=$3)`, [householdId, itemOrId, name]);
  if (!r.rowCount) throw new NotFoundError('Item not on the list');
  return r.rowCount;
}

export async function assignItem(db: Db, householdId: string, itemOrId: string, memberId: string | null) {
  const name = canonicalItem(itemOrId);
  await db.query(`update shopping_list_items set assigned_to=$3 where household_id=$1 and (id::text=$2 or item=$4)`, [householdId, itemOrId, memberId, name]);
}

/** Add one plan meal's ingredients. Each row remembers its meal so a swap only touches that meal's items. */
export async function addMealItems(db: Db, householdId: string, mealId: string, ingredients: { item: string; qty: number; unit: string }[], servings: number, baseServings: number) {
  const h = await getHousehold(db, householdId);
  const prices = await loadPrices(db, householdId, h.country);
  for (const ing of ingredients) {
    const qty = Math.round(((ing.qty * servings) / baseServings) * 100) / 100;
    const est = estimateCost(prices, ing.item, qty, ing.unit);
    await db.query('insert into shopping_list_items (household_id, item, qty, unit, source_meal_id, est_price) values ($1,$2,$3,$4,$5,$6)',
      [householdId, ing.item, qty, ing.unit, mealId, est]);
  }
}

export async function removeMealItems(db: Db, householdId: string, mealId: string) {
  await db.query(`delete from shopping_list_items where household_id=$1 and source_meal_id=$2 and status='open'`, [householdId, mealId]);
}
