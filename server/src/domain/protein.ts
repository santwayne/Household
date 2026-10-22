import { PROTEIN_SOURCES } from './data.js';
import { estimateCost, type PriceMap } from './pricebook.js';

export type ProteinRank = { item: string; gramsProteinPerRupee: number; costPer100gProtein: number };

/** Rank cheap protein sources by grams of protein per rupee. Nutrition values still need expert review before launch. */
export function rankProteinPerRupee(prices: PriceMap): ProteinRank[] {
  const out: ProteinRank[] = [];
  for (const s of PROTEIN_SOURCES) {
    const cost100g = estimateCost(prices, s.item, 100, 'g') ?? (s.gramsPerPiece ? (estimateCost(prices, s.item, 100 / s.gramsPerPiece, 'piece') ?? null) : null);
    if (cost100g == null || cost100g <= 0) continue;
    const gpr = s.per100g / cost100g;
    out.push({ item: s.item, gramsProteinPerRupee: Math.round(gpr * 100) / 100, costPer100gProtein: Math.round((100 / gpr) * 100) / 100 });
  }
  return out.sort((a, b) => b.gramsProteinPerRupee - a.gramsProteinPerRupee);
}
