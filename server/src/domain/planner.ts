import { passesFilter, type RecipeLike } from './filters.js';
import { estimateCost, type PriceMap } from './pricebook.js';

export type Recipe = RecipeLike & { name: string; region: string; ingredients: { item: string; qty: number; unit: string }[]; base_servings: number; protein_g_per_serving: number };

export type PlanRequest = {
  budget: number; days: number; servings: number; startDate: string; // YYYY-MM-DD
  slots: ('breakfast' | 'lunch' | 'dinner')[];
  diets: string[]; allergens: string[]; equipment: string[]; maxMinutes: number;
  regions?: string[]; pantryItems?: string[];
  /** 'YYYY-MM-DD:slot' where nobody is free to cook: only quick recipes (<= QUICK_MINUTES) are used there. */
  quickSlots?: string[];
  /** Learned preference per recipe id (ratings, swapped-away, cooked). Positive = liked. */
  prefs?: Record<string, number>;
};
export const QUICK_MINUTES = 20;
export type DraftMeal = { day: string; slot: string; recipeId: string; servings: number; estCost: number };
export type PlanResult = {
  meals: DraftMeal[]; estTotal: number; fits: boolean; cheapestPossible: number | null; shortfall: number; notes: string[];
};

export function recipeCost(r: Recipe, servings: number, prices: PriceMap): { cost: number; unknownItems: string[] } {
  let cost = 0; const unknownItems: string[] = [];
  for (const ing of r.ingredients) {
    const c = estimateCost(prices, ing.item, (ing.qty * servings) / r.base_servings, ing.unit);
    if (c == null) unknownItems.push(ing.item); else cost += c;
  }
  return { cost: Math.round(cost * 100) / 100, unknownItems };
}

function addDays(date: string, n: number) {
  const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/**
 * Budget-fit planning. Cost is computed from the price book and quantities, never guessed.
 * Strategy: build the best-scoring plan (protein per rupee, regional preference, pantry use, variety),
 * then swap the priciest meals for cheaper alternatives until the total fits the budget.
 */
export function buildPlan(all: Recipe[], req: PlanRequest, prices: PriceMap): PlanResult {
  const notes: string[] = [];
  const bySlot = new Map<string, { r: Recipe; cost: number; score: number }[]>();
  for (const slot of req.slots) {
    const cands = all
      .filter(r => passesFilter(r, { diets: req.diets, allergens: req.allergens, equipment: req.equipment, maxMinutes: req.maxMinutes, slot }))
      .map(r => ({ r, ...recipeCost(r, req.servings, prices) }))
      .filter(c => c.unknownItems.length === 0 && c.cost > 0)
      .map(c => {
        const perServingCost = c.cost / req.servings;
        const proteinPerRupee = c.r.protein_g_per_serving / Math.max(perServingCost, 1);
        const regionBonus = req.regions?.includes(c.r.region) ? 1.5 : 0;
        const pantryBonus = (req.pantryItems ?? []).filter(p => c.r.ingredients.some(i => i.item === p)).length * 0.5;
        const prefBonus = Math.max(-3, Math.min(3, req.prefs?.[c.r.id] ?? 0)) * 1.2;
        return { r: c.r, cost: c.cost, score: proteinPerRupee + regionBonus + pantryBonus + prefBonus };
      });
    bySlot.set(slot, cands);
  }
  for (const [slot, c] of bySlot) if (!c.length) notes.push(`No ${slot} recipe matches your diet, allergies and kitchen. Add equipment or relax a rule.`);
  const slotsWithRecipes = req.slots.filter(s => (bySlot.get(s) ?? []).length > 0);
  if (!slotsWithRecipes.length) return { meals: [], estTotal: 0, fits: false, cheapestPossible: null, shortfall: 0, notes };

  type Pick = { day: string; slot: string; quick: boolean; c: { r: Recipe; cost: number; score: number } };
  const picks: Pick[] = [];
  const hist: string[] = []; // across ALL slots, so the same dish does not appear for lunch and dinner on one day
  for (let d = 0; d < req.days; d++) {
    for (const slot of slotsWithRecipes) {
      const date = addDays(req.startDate, d);
      const quick = !!req.quickSlots?.includes(`${date}:${slot}`);
      const all_ = bySlot.get(slot)!;
      const cands = quick && all_.some(c => c.r.prep_minutes <= QUICK_MINUTES) ? all_.filter(c => c.r.prep_minutes <= QUICK_MINUTES) : all_;
      const ranked = [...cands]
        .map(c => ({ c, s: c.score - (hist.slice(-4).includes(c.r.id) ? 100 : 0) - (hist.filter(h => h === c.r.id).length * 0.8) + (hash(c.r.id + req.startDate + d) % 100) / 1000 }))
        .sort((a, b) => b.s - a.s);
      const pick = ranked[0].c;
      hist.push(pick.r.id);
      picks.push({ day: date, slot, quick, c: pick });
    }
  }
  const total = () => Math.round(picks.reduce((s, p) => s + p.c.cost, 0) * 100) / 100;

  const allowed = (p: { slot: string; quick: boolean }) => { const l = bySlot.get(p.slot)!; const q = p.quick ? l.filter(c => c.r.prep_minutes <= QUICK_MINUTES) : l; return q.length ? q : l; };
  const cheapest = (p: { slot: string; quick: boolean }) => [...allowed(p)].sort((a, b) => a.cost - b.cost)[0];
  const cheapestPossible = Math.round(picks.reduce((s, p) => s + cheapest(p).cost, 0) * 100) / 100;

  let guard = 0;
  while (total() > req.budget && guard++ < 500) {
    // swap the meal with the biggest potential saving to a cheaper recipe (respecting immediate repeats)
    let best: { idx: number; to: { r: Recipe; cost: number; score: number }; saving: number } | null = null;
    picks.forEach((p, idx) => {
      for (const c of allowed(p)) {
        if (c.cost >= p.c.cost) continue;
        const neighbours = picks.filter(q => q.slot === p.slot && Math.abs(new Date(q.day).getTime() - new Date(p.day).getTime()) <= 86400000 * 1 && q !== p);
        if (neighbours.some(n => n.c.r.id === c.r.id)) continue;
        const saving = p.c.cost - c.cost;
        const lossAdj = saving - Math.max(0, p.c.score - c.score) * 0.01;
        if (!best || lossAdj > best.saving) best = { idx, to: c, saving: lossAdj };
      }
    });
    if (!best) break;
    picks[(best as any).idx].c = (best as any).to;
  }
  if (total() > req.budget) {
    // fall back to strictly cheapest per slot (repeats allowed)
    picks.forEach(p => { p.c = cheapest(p); });
    notes.push('Variety was reduced to stay near your budget.');
  }
  const estTotal = total();
  const fits = estTotal <= req.budget;
  if (!fits) notes.push(`Cheapest possible plan is about ${estTotal}, which is over your budget by ${Math.round((estTotal - req.budget) * 100) / 100}.`);
  return {
    meals: picks.map(p => ({ day: p.day, slot: p.slot, recipeId: p.c.r.id, servings: req.servings, estCost: p.c.cost })),
    estTotal, fits, cheapestPossible, shortfall: fits ? 0 : Math.round((estTotal - req.budget) * 100) / 100, notes,
  };
}

/** Alternatives for swapping one meal (never repeats recipes already used on adjacent days). */
export function swapCandidates(all: Recipe[], meal: { slot: string; recipeId: string; servings: number }, req: Pick<PlanRequest, 'diets' | 'allergens' | 'equipment' | 'maxMinutes'>, prices: PriceMap) {
  return all
    .filter(r => r.id !== meal.recipeId && passesFilter(r, { ...req, slot: meal.slot }))
    .map(r => ({ r, ...recipeCost(r, meal.servings, prices) }))
    .filter(c => c.unknownItems.length === 0)
    .sort((a, b) => a.cost - b.cost);
}
