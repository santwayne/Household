// Pure money logic. Integer minor units (paise/cents) everywhere. The AI never touches this.
export const toMinor = (n: number) => Math.round(n * 100);
export const toMajor = (m: number) => m / 100;

export type SplitRule =
  | { type: 'equal'; members?: string[] }
  | { type: 'custom'; shares: Record<string, number> }     // amounts in major units, must sum to total
  | { type: 'percent'; percents: Record<string, number> }; // must sum to 100

export class MoneyError extends Error {}

function largestRemainder(totalMinor: number, weights: [string, number][]): Record<string, number> {
  const sum = weights.reduce((s, [, w]) => s + w, 0);
  if (sum <= 0) throw new MoneyError('Split weights must be positive');
  const raw = weights.map(([id, w]) => ({ id, exact: (totalMinor * w) / sum }));
  const out: Record<string, number> = {};
  let assigned = 0;
  for (const r of raw) { out[r.id] = Math.floor(r.exact); assigned += out[r.id]; }
  let left = totalMinor - assigned;
  const order = [...raw].sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)));
  for (let k = 0; left > 0; k++, left--) out[order[k % order.length].id] += 1;
  return out;
}

export function computeShares(totalMinor: number, rule: SplitRule, allMemberIds: string[]): Record<string, number> {
  if (!Number.isInteger(totalMinor) || totalMinor <= 0) throw new MoneyError('Amount must be positive');
  if (rule.type === 'equal') {
    const ids = rule.members?.length ? rule.members : allMemberIds;
    if (!ids.length) throw new MoneyError('No members to split between');
    for (const id of ids) if (!allMemberIds.includes(id)) throw new MoneyError('Unknown member in split');
    return largestRemainder(totalMinor, ids.map(id => [id, 1]));
  }
  if (rule.type === 'custom') {
    const entries = Object.entries(rule.shares);
    for (const [id] of entries) if (!allMemberIds.includes(id)) throw new MoneyError('Unknown member in split');
    const minor: Record<string, number> = {};
    let sum = 0;
    for (const [id, v] of entries) { minor[id] = toMinor(v); sum += minor[id]; if (minor[id] < 0) throw new MoneyError('Negative share'); }
    if (sum !== totalMinor) throw new MoneyError(`Custom shares add up to ${toMajor(sum)}, expected ${toMajor(totalMinor)}`);
    return minor;
  }
  const entries = Object.entries(rule.percents);
  for (const [id] of entries) if (!allMemberIds.includes(id)) throw new MoneyError('Unknown member in split');
  const pct = entries.reduce((s, [, p]) => s + p, 0);
  if (Math.abs(pct - 100) > 0.001) throw new MoneyError(`Percentages add up to ${pct}, expected 100`);
  return largestRemainder(totalMinor, entries);
}

export type LedgerInput = {
  members: string[];
  contributions: { member: string; amount: number }[];
  purchases: { payer: string; amount: number; paidFrom: 'member' | 'pool'; shares: Record<string, number> }[];
  settlements: { from: string; to: string; amount: number }[];
};

export const KITTY = 'kitty';

/** net > 0: the household owes this member; net < 0: this member owes the household. Includes a pseudo-party "kitty" so the sum is exactly zero. */
export function computeBalances(l: LedgerInput): Record<string, number> {
  const net: Record<string, number> = {};
  for (const m of l.members) net[m] = 0;
  const add = (m: string, v: number) => { if (!(m in net)) net[m] = 0; net[m] += v; };
  for (const c of l.contributions) add(c.member, c.amount);
  for (const p of l.purchases) {
    if (p.paidFrom === 'member') add(p.payer, p.amount);
    for (const [m, v] of Object.entries(p.shares)) add(m, -v);
  }
  for (const s of l.settlements) { add(s.from, s.amount); add(s.to, -s.amount); }
  const sum = Object.values(net).reduce((a, b) => a + b, 0);
  net[KITTY] = -sum; // kitty cash held in the pool shows as the kitty owing members
  return net;
}

export type Transfer = { from: string; to: string; amount: number };

export function suggestSettlements(net: Record<string, number>): Transfer[] {
  const debtors = Object.entries(net).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const creditors = Object.entries(net).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const out: Transfer[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    if (amt > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: amt });
    debtors[i].v -= amt; creditors[j].v -= amt;
    if (debtors[i].v === 0) i++;
    if (creditors[j].v === 0) j++;
  }
  return out;
}
