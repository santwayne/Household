// Deterministic diet / allergy gate. Every suggestion passes through this before it is shown. The AI never decides this.
export type Diet = 'vegan' | 'veg' | 'egg' | 'nonveg';
const RANK: Record<Diet, number> = { vegan: 0, veg: 1, egg: 2, nonveg: 3 };

export type RecipeLike = { id: string; diet_tags: string[]; allergens: string[]; equipment: string[]; prep_minutes: number; slot: string[] };

export function dietAllows(householdDiet: string, recipeDiet: string): boolean {
  const h = RANK[householdDiet as Diet], r = RANK[recipeDiet as Diet];
  if (h === undefined || r === undefined) return false; // unknown -> fail closed
  return r <= h;
}

export function passesFilter(
  r: RecipeLike,
  opts: { diets: string[]; allergens: string[]; equipment?: string[]; maxMinutes?: number; slot?: string },
): boolean {
  // The household diet is the strictest member diet.
  const strictest = opts.diets.reduce((a, b) => (RANK[a as Diet] <= RANK[b as Diet] ? a : b), 'nonveg');
  if (!r.diet_tags.every(t => dietAllows(strictest, t))) return false;
  const avoid = new Set(opts.allergens.map(a => a.toLowerCase().trim()));
  if (r.allergens.some(a => avoid.has(a.toLowerCase()))) return false;
  if (opts.equipment && r.equipment.some(e => !opts.equipment!.includes(e))) return false;
  if (opts.maxMinutes && r.prep_minutes > opts.maxMinutes) return false;
  if (opts.slot && !r.slot.includes(opts.slot)) return false;
  return true;
}
