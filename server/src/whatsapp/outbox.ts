import { q, one, type Db } from '../db/index.js';
import type { WaClient } from './client.js';

// Outbound messages go through a durable outbox: written in the same transaction as the data change
// (so we only ever confirm what was committed), then sent with retries, consent and 24-hour window checks.
export type OutPayload =
  | { text: string; allowOptedOut?: boolean }
  | { template: string; lang: string; params: string[] };

export async function enqueue(db: Db, o: { phone: string; householdId?: string | null; payload: OutPayload }) {
  const kind = 'template' in o.payload ? 'template' : 'text';
  await db.query('insert into outbound_messages (to_phone, household_id, kind, payload) values ($1,$2,$3,$4)', [o.phone, o.householdId ?? null, kind, JSON.stringify(o.payload)]);
}

const WINDOW_MS = 24 * 3600 * 1000;
const MAX_ATTEMPTS = 5;

export async function processOutbox(db: Db, wa: WaClient, now = new Date(), limit = 25): Promise<{ sent: number; blocked: number; failed: number }> {
  const stats = { sent: 0, blocked: 0, failed: 0 };
  const rows = await q<any>(db,
    `select * from outbound_messages where status='queued' and next_attempt_at <= greatest($1::timestamptz, now()) order by created_at limit $2`, [now, limit]);
  for (const r of rows) {
    // claim the row; another worker that claims it first wins
    const claimed = await db.query(`update outbound_messages set attempts = attempts + 1 where id=$1 and status='queued' and attempts=$2`, [r.id, r.attempts]);
    if (!claimed.rowCount) continue;
    const member = await one<{ consent_at: string | null; opted_out_at: string | null; last_inbound_at: string | null }>(db, 'select consent_at, opted_out_at, last_inbound_at from members where phone=$1', [r.to_phone]);
    const payload = r.payload as OutPayload;
    const allowOptedOut = 'text' in payload && payload.allowOptedOut;
    const noMember = !member && 'text' in payload; // onboarding replies to a number that just messaged us
    if (member && !member.consent_at && !noMember && !allowOptedOut) { await mark(db, r.id, 'blocked_consent', 'no consent'); stats.blocked++; continue; }
    if (member?.opted_out_at && !allowOptedOut) { await mark(db, r.id, 'blocked_consent', 'opted out'); stats.blocked++; continue; }
    if (r.kind === 'text') {
      const lastIn = member?.last_inbound_at ? new Date(member.last_inbound_at).getTime() : null;
      // onboarding replies (no member row yet) are always inside the window: the user just messaged us
      if (member && (lastIn == null || now.getTime() - lastIn > WINDOW_MS)) { await mark(db, r.id, 'blocked_window', 'outside 24h window, template required'); stats.blocked++; continue; }
    }
    try {
      const res = 'template' in payload ? await wa.sendTemplate(r.to_phone, payload.template, payload.lang, payload.params) : await wa.sendText(r.to_phone, payload.text);
      await db.query(`update outbound_messages set status='sent', wa_message_id=$2, sent_at=now(), error=null where id=$1`, [r.id, res.id]);
      stats.sent++;
    } catch (e) {
      const attempts = r.attempts + 1;
      const permanent = (e as any).status && (e as any).status >= 400 && (e as any).status < 500 && (e as any).status !== 429;
      if (attempts >= MAX_ATTEMPTS || permanent) { await mark(db, r.id, 'failed', (e as Error).message); stats.failed++; }
      else await db.query(`update outbound_messages set next_attempt_at = $2, error=$3 where id=$1`, [r.id, new Date(now.getTime() + 5000 * 2 ** attempts), (e as Error).message]);
    }
  }
  return stats;
}

async function mark(db: Db, id: string, status: string, error: string) {
  await db.query('update outbound_messages set status=$2, error=$3 where id=$1', [id, status, error]);
}
