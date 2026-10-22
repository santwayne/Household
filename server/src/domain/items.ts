import { ITEM_ALIASES } from './data.js';

export type BaseUnit = 'g' | 'ml' | 'piece';

const UNIT_MAP: Record<string, { base: BaseUnit; factor: number }> = {
  g: { base: 'g', factor: 1 }, gm: { base: 'g', factor: 1 }, gram: { base: 'g', factor: 1 }, grams: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 }, kilo: { base: 'g', factor: 1000 }, kgs: { base: 'g', factor: 1000 }, 'किलो': { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 }, l: { base: 'ml', factor: 1000 }, ltr: { base: 'ml', factor: 1000 }, litre: { base: 'ml', factor: 1000 },
  liter: { base: 'ml', factor: 1000 }, litres: { base: 'ml', factor: 1000 }, 'लीटर': { base: 'ml', factor: 1000 },
  piece: { base: 'piece', factor: 1 }, pieces: { base: 'piece', factor: 1 }, pc: { base: 'piece', factor: 1 }, pcs: { base: 'piece', factor: 1 },
  dozen: { base: 'piece', factor: 12 }, darjan: { base: 'piece', factor: 12 },
};

export function normalizeUnit(u?: string | null): { base: BaseUnit; factor: number } | null {
  if (!u) return null;
  return UNIT_MAP[u.toLowerCase().replace(/\.$/, '')] ?? null;
}

/** Convert a quantity into its base unit (g / ml / piece). Returns null when the unit is unknown (cannot be safely normalised). */
export function toBase(qty: number, unit?: string | null): { qty: number; unit: BaseUnit } | null {
  const u = normalizeUnit(unit);
  return u ? { qty: qty * u.factor, unit: u.base } : null;
}

export function canonicalItem(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (ITEM_ALIASES[s]) return ITEM_ALIASES[s];
  const parts = s.split(' ');
  if (parts.length === 1 && ITEM_ALIASES[parts[0]]) return ITEM_ALIASES[parts[0]];
  if (s.endsWith('es') && ITEM_ALIASES[s.slice(0, -2)]) return ITEM_ALIASES[s.slice(0, -2)];
  return s;
}

/** Parse "2 kg milk", "milk 2kg", "1 litre doodh", "paneer" -> {item, qty, unit} */
export function parseItemPhrase(raw: string): { item: string; qty: number | null; unit: string | null } {
  const s = raw.trim().replace(/\s+/g, ' ');
  const unitRe = '(kg|kgs|kilo|g|gm|gram|grams|l|ltr|litre|liter|litres|ml|pcs|pc|pieces|piece|dozen|darjan)';
  let m = s.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*${unitRe}?\\s+(.+)$`, 'i'));
  if (m) return { item: canonicalItem(m[3]), qty: Number(m[1]), unit: m[2]?.toLowerCase() ?? null };
  m = s.match(new RegExp(`^(.+?)\\s+(\\d+(?:\\.\\d+)?)\\s*${unitRe}?$`, 'i'));
  if (m) return { item: canonicalItem(m[1]), qty: Number(m[2]), unit: m[3]?.toLowerCase() ?? null };
  return { item: canonicalItem(s), qty: null, unit: null };
}
