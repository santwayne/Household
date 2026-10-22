import type { Db } from './index.js';
import { RECIPES, DEFAULT_PRICES_INR } from '../domain/data.js';

export async function seedReferenceData(db: Db) {
  for (const r of RECIPES) {
    await db.query(
      `insert into recipes (id,name,region,diet_tags,allergens,ingredients,base_servings,protein_g_per_serving,prep_minutes,equipment,slot,reviewed)
       values ($1,$2,$3,$4,$5,$6,2,$7,$8,$9,$10,false)
       on conflict (id) do update set name=excluded.name, region=excluded.region, diet_tags=excluded.diet_tags,
         allergens=excluded.allergens, ingredients=excluded.ingredients, protein_g_per_serving=excluded.protein_g_per_serving,
         prep_minutes=excluded.prep_minutes, equipment=excluded.equipment, slot=excluded.slot`,
      [r.id, r.name, r.region, [r.diet], r.allergens, JSON.stringify(r.ing), r.protein, r.mins, r.equipment ?? ['stove'], r.slot ?? ['lunch', 'dinner']],
    );
  }
  for (const [item, unit, price] of DEFAULT_PRICES_INR) {
    await db.query(
      `insert into price_book (household_id, region, country, item, unit, price, source)
       values (null, 'all', 'IN', $1, $2, $3, 'default')
       on conflict (region, country, item, unit) where household_id is null do nothing`,
      [item, unit, price],
    );
  }
}
