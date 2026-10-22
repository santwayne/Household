import type { When } from './schema.js';

function parts(tz: string, d: Date) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(d)) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year, m: o.month, d: o.day, h: o.hour, mi: o.minute };
}

function offsetMs(tz: string, at: Date) {
  const p = parts(tz, at);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(at.getTime() / 60000) * 60000;
}

/** Local wall-clock time in tz -> UTC Date. */
export function zonedToUtc(tz: string, y: number, m: number, d: number, h: number, mi: number): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = new Date(guess - offsetMs(tz, new Date(guess)));
  return new Date(guess - offsetMs(tz, first));
}

export const localDate = (tz: string, now: Date) => { const p = parts(tz, now); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; };

const PART_HOUR = { morning: 8, afternoon: 13, evening: 18, night: 21 } as const;

/** Resolve a relative "when" to an absolute instant in the household time zone. Returns null when no usable time was given. */
export function resolveWhen(when: When | null | undefined, tz: string, now = new Date()): Date | null {
  if (!when) return null;
  if (when.hour == null && !when.part) return null;
  const p = parts(tz, now);
  const hour = when.hour ?? PART_HOUR[when.part!];
  const minute = when.minute ?? 0;
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d));
  const addDays = when.day === 'tomorrow' ? 1 : when.day === 'day_after' ? 2 : 0;
  base.setUTCDate(base.getUTCDate() + addDays);
  let at = zonedToUtc(tz, base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hour, minute);
  if (!when.day && at.getTime() <= now.getTime()) { base.setUTCDate(base.getUTCDate() + 1); at = zonedToUtc(tz, base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hour, minute); }
  if (at.getTime() <= now.getTime()) return null; // refuses to set reminders in the past
  return at;
}

export const weekday = (isoDate: string) => ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(isoDate + 'T00:00:00Z').getUTCDay()];

export function describeWhen(at: Date, tz: string, now = new Date()): string {
  const p = parts(tz, at), n = parts(tz, now);
  const day = p.d === n.d && p.m === n.m ? 'today' : `${p.d}/${p.m}`;
  const hh = p.h % 12 || 12;
  return `${day} ${hh}:${String(p.mi).padStart(2, '0')} ${p.h >= 12 ? 'pm' : 'am'}`;
}
