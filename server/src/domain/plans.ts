import { q, one, type Db } from '../db/index.js';
import { getHousehold, listMembers } from './households.js';
import { loadPrices } from './pricebook.js';
import { buildPlan, recipeCost, swapCandidates, type Recipe } from './planner.js';
import { addMealItems, removeMealItems } from './shopping.js';
import { moneySummary } from './ledger.js';
import { NotFoundError, ValidationError } from './scope.js';
import { passesFilter } from './filters.js';

export const loadRecipes = (db: Db) => q<Recipe>(db, 'select id, name, region, diet_tags, allergens, ingredients, base_servings, protein_g_per_serving, prep_minutes, equipment, slot from recipes');

function strictDiets(h: { diet: string }, members: { diet: string | null }[]) { return [h.diet, ...members.map(m => m.diet).filter(Boolean) as string[]]; }
function allAllergens(h: { allergens: string[] }, members: { allergens: string[] }[]) { return [...new Set([...h.allergens, ...members.flatMap(m => m.allergens)])]; }

export type GenerateOpts = { diet?: string; budget?: number; days?: number; servings?: number; startDate?: string; slots?: ('breakfast' | 'lunch' | 'dinner')[]; regions?: string[]; actor?: string };

export async function generatePlan(db: Db, householdId: string, o: GenerateOpts = {}) {
  const h = await getHousehold(db, householdId);
  const members = await listMembers(db, householdId);
  const prices = await loadPrices(db, householdId, h.country);
  const recipes = await loadRecipes(db);
  const pantry = await q<{ item: string }>(db, 'select item from pantry_items where household_id=$1', [householdId]);
  const money = await moneySummary(db, householdId);
  const days = o.days ?? 7;
  const budget = o.budget ?? (money.remaining != null ? Math.min(money.remaining, money.perDayLeft != null ? money.perDayLeft * days : money.remaining) : 0);
  if (!(budget > 0)) throw new ValidationError('Set a budget first');
  const servings = o.servings ?? members.length;
  const startDate = o.startDate ?? (await one<{ d: string }>(db, `select (now() at time zone $1)::date as d`, [h.timezone]))!.d;
  const result = buildPlan(recipes, {
    budget, days, servings, startDate, slots: o.slots ?? ['lunch', 'dinner'], diets: strictDiets({ diet: o.diet ?? h.diet }, members), allergens: allAllergens(h, members),
    equipment: h.cooking_equipment, maxMinutes: h.cooking_minutes_max, regions: o.regions ?? [h.region, 'general'], pantryItems: pantry.map(p => p.item),
  }, prices);

  // Replace the previous draft: remove its open shopping rows, then create the new plan and rows.
  await db.query(`delete from shopping_list_items where household_id=$1 and status='open' and source_meal_id in (select pm.id from planned_meals pm join meal_plans mp on mp.id=pm.plan_id where mp.household_id=$1 and mp.status='draft')`, [householdId]);
  await db.query(`delete from meal_plans where household_id=$1 and status='draft'`, [householdId]);
  const plan = (await q<{ id: string }>(db, 'insert into meal_plans (household_id, week_start, budget, servings, est_total) values ($1,$2,$3,$4,$5) returning id',
    [householdId, startDate, budget, servings, result.estTotal]))[0];
  const cooks = members.filter(m => !m.opted_out_at);
  let k = 0;
  for (const m of result.meals) {
    const cook = cooks.length ? (cooks.find(c => c.role === 'cook') ?? cooks[k++ % cooks.length]) : null;
    const pm = (await q<{ id: string }>(db, 'insert into planned_meals (plan_id, day, slot, recipe_id, servings, est_cost, assigned_cook) values ($1,$2,$3,$4,$5,$6,$7) returning id',
      [plan.id, m.day, m.slot, m.recipeId, m.servings, m.estCost, cook?.id ?? null]))[0];
    const r = recipes.find(x => x.id === m.recipeId)!;
    await addMealItems(db, householdId, pm.id, r.ingredients, m.servings, r.base_servings);
  }
  return { planId: plan.id, ...result, budget };
}

export async function getCurrentPlan(db: Db, householdId: string) {
  const plan = await one<any>(db, 'select * from meal_plans where household_id=$1 order by created_at desc limit 1', [householdId]);
  if (!plan) return null;
  const meals = await q<any>(db,
    `select pm.*, r.name as recipe_name, r.region, r.protein_g_per_serving, r.reviewed, m.name as cook_name
       from planned_meals pm join recipes r on r.id=pm.recipe_id left join members m on m.id=pm.assigned_cook
      where pm.plan_id=$1 order by pm.day, array_position(array['breakfast','lunch','dinner'], pm.slot)`, [plan.id]);
  const estTotal = meals.reduce((s: number, m: any) => s + m.est_cost, 0);
  return { ...plan, est_total: Math.round(estTotal * 100) / 100, meals, anyUnreviewed: meals.some((m: any) => !m.reviewed) };
}

export async function swapMeal(db: Db, householdId: string, mealId: string, recipeId?: string) {
  const meal = await one<any>(db, `select pm.* from planned_meals pm join meal_plans mp on mp.id=pm.plan_id where pm.id=$1 and mp.household_id=$2`, [mealId, householdId]);
  if (!meal) throw new NotFoundError('Meal not found');
  const h = await getHousehold(db, householdId);
  const members = await listMembers(db, householdId);
  const prices = await loadPrices(db, householdId, h.country);
  const recipes = await loadRecipes(db);
  const filt = { diets: strictDiets(h, members), allergens: allAllergens(h, members), equipment: h.cooking_equipment, maxMinutes: h.cooking_minutes_max };
  const cands = swapCandidates(recipes, { slot: meal.slot, recipeId: meal.recipe_id, servings: meal.servings }, filt, prices);
  let chosen;
  if (recipeId) {
    chosen = cands.find(c => c.r.id === recipeId);
    if (!chosen) throw new ValidationError('That recipe does not fit the household diet, allergies or kitchen');
  } else {
    const neighbours = await q<{ recipe_id: string }>(db, `select recipe_id from planned_meals where plan_id=$1 and slot=$2 and abs(day - $3::date) <= 1 and id<>$4`, [meal.plan_id, meal.slot, meal.day, mealId]);
    const bad = new Set(neighbours.map(n => n.recipe_id));
    chosen = cands.find(c => !bad.has(c.r.id));
    if (!chosen) throw new ValidationError('No alternative meal available');
  }
  await removeMealItems(db, householdId, mealId);            // only this meal's items change
  await db.query('update planned_meals set recipe_id=$2, est_cost=$3, swapped=true where id=$1', [mealId, chosen.r.id, chosen.cost]);
  await addMealItems(db, householdId, mealId, chosen.r.ingredients, meal.servings, chosen.r.base_servings);
  return { mealId, recipeId: chosen.r.id, recipeName: chosen.r.name, estCost: chosen.cost };
}

export async function approvePlan(db: Db, householdId: string, planId: string) {
  const r = await db.query(`update meal_plans set status='approved' where id=$1 and household_id=$2`, [planId, householdId]);
  if (!r.rowCount) throw new NotFoundError('Plan not found');
}

export async function markCooked(db: Db, householdId: string, mealId: string, rating?: number) {
  const r = await db.query(`update planned_meals pm set cooked_at=now(), rating=$3 from meal_plans mp where mp.id=pm.plan_id and pm.id=$1 and mp.household_id=$2`, [mealId, householdId, rating ?? null]);
  if (!r.rowCount) throw new NotFoundError('Meal not found');
}

/** Planned vs actual for the latest plan. */
export async function plannedVsActual(db: Db, householdId: string) {
  const plan = await getCurrentPlan(db, householdId);
  if (!plan) return null;
  const bought = await one<{ est: number; act: number }>(db,
    `select coalesce(sum(est_price),0) as est, coalesce(sum(actual_price),0) as act from shopping_list_items where household_id=$1 and source_meal_id in (select id from planned_meals where plan_id=$2) and status='bought'`, [householdId, plan.id]);
  return {
    planned: plan.meals.length, cooked: plan.meals.filter((m: any) => m.cooked_at).length, estTotal: plan.est_total,
    boughtEstimated: bought!.est, boughtActual: bought!.act,
  };
}

export { recipeCost };
