import { q, one, type Db } from '../db/index.js';
import { toBase, canonicalItem, type BaseUnit } from './items.js';

export type PriceEntry = { item: string; unit: string; price: number; source: string };

const PRICE_UNIT_TO_BASE: Record<string, { base: BaseUnit; per: number }> = {
  kg: { base: 'g', per: 1000 }, l: { base: 'ml', per: 1000 }, piece: { base: 'piece', per: 1 }, dozen: { base: 'piece', per: 12 },
};

export type PriceMap = Map<string, PriceEntry>;

/** Household's own logged prices replace regional defaults. */
export async function loadPrices(db: Db, householdId: string, country = 'IN'): Promise<PriceMap> {
  const rows = await q<PriceEntry & { household_id: string | null }>(
    db,
    `select item, unit, price, source, household_id from price_book
     where (household_id = $1) or (household_id is null and country = $2)
     order by (household_id is null) desc`,
    [householdId, country],
  );
  const m: PriceMap = new Map();
  for (const r of rows) m.set(r.item, r); // household rows come last and override
  return m;
}

/** Estimated cost for qty of item. Returns null when we have no price or cannot normalise the unit. */
export function estimateCost(prices: PriceMap, item: string, qty: number, unit?: string | null): number | null {
  const p = prices.get(canonicalItem(item));
  const b = toBase(qty, unit);
  if (!p || !b) return null;
  const pu = PRICE_UNIT_TO_BASE[p.unit];
  if (!pu || pu.base !== b.unit) return null;
  return Math.round(((p.price / pu.per) * b.qty) * 100) / 100;
}

/** Learn a unit price from a logged purchase line. Smooths against the previous household price. */
export async function learnPrice(db: Db, householdId: string, item: string, qty: number, unit: string | null, linePrice: number) {
  const b = toBase(qty, unit);
  if (!b || qty <= 0 || linePrice <= 0) return;
  const name = canonicalItem(item);
  const [priceUnit, per] = b.unit === 'g' ? ['kg', 1000] : b.unit === 'ml' ? ['l', 1000] : ['piece', 1];
  const unitPrice = Math.round((linePrice / b.qty) * per * 100) / 100;
  const prev = await one<{ price: number }>(db, 'select price from price_book where household_id=$1 and item=$2 and unit=$3', [householdId, name, priceUnit]);
  const next = prev ? Math.round(((prev.price + unitPrice) / 2) * 100) / 100 : unitPrice;
  await db.query(
    `insert into price_book (household_id, country, item, unit, price, source) values ($1,'IN',$2,$3,$4,'purchase')
     on conflict (household_id, item, unit) where household_id is not null do update set price=excluded.price, source='purchase', updated_at=now()`,
    [householdId, name, priceUnit, next],
  );
}

export async function setPrice(db: Db, householdId: string, item: string, unit: 'kg' | 'l' | 'piece', price: number) {
  await db.query(
    `insert into price_book (household_id, country, item, unit, price, source) values ($1,'IN',$2,$3,$4,'manual')
     on conflict (household_id, item, unit) where household_id is not null do update set price=excluded.price, source='manual', updated_at=now()`,
    [householdId, canonicalItem(item), unit, price],
  );
}
