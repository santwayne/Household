import type { Member } from '../domain/households.js';

export type Resolved = { member: Member } | { ambiguous: Member[] } | { none: true };

/** Resolve a spoken name to a household member: exact, then first-name, then unique prefix. null/first-person = the sender. */
export function resolveMember(members: Member[], name: string | null | undefined, sender: Member): Resolved {
  if (!name) return { member: sender };
  const n = name.trim().toLowerCase().replace(/[.,!?]/g, '');
  if (!n) return { member: sender };
  const nm = (m: Member) => m.name.toLowerCase();
  let hits = members.filter(m => nm(m) === n);
  if (!hits.length) hits = members.filter(m => nm(m).split(/\s+/)[0] === n);
  if (!hits.length && n.length >= 3) hits = members.filter(m => nm(m).startsWith(n) || n.startsWith(nm(m).split(/\s+/)[0]));
  if (hits.length === 1) return { member: hits[0] };
  if (hits.length > 1) return { ambiguous: hits };
  return { none: true };
}
