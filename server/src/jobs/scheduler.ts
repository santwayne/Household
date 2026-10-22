import type { Pool } from 'pg';
import { q, tx } from '../db/index.js';
import { config } from '../config.js';
import { enqueue, processOutbox } from '../whatsapp/outbox.js';
import type { WaClient } from '../whatsapp/client.js';
import { moneySummary } from '../domain/ledger.js';
import { asLang, type Lang } from '../nlu/lang.js';
import { money, t } from '../nlu/i18n.js';

const WINDOW_MS = 24 * 3600 * 1000;

type Mem = { id: string; phone: string; language: string | null; consent_at: string | null; opted_out_at: string | null; last_inbound_at: string | null; household_id: string };

/** Inside the 24-hour window: free-form text. Outside: an approved (paid) template, which must exist in Meta Business Manager [verify]. */
async function notify(db: Pool | any, m: Mem, now: Date, text: string, template: { name: string; params: string[] }) {
  if (!m.consent_at || m.opted_out_at) return 'skipped';
  const inWindow = m.last_inbound_at && now.getTime() - new Date(m.last_inbound_at).getTime() <= WINDOW_MS;
  if (inWindow) await enqueue(db, { phone: m.phone, householdId: m.household_id, payload: { text } });
  else await enqueue(db, { phone: m.phone, householdId: m.household_id, payload: { template: template.name, lang: 'en', params: template.params } });
  return inWindow ? 'text' : 'template';
}

export async function runDueReminders(pool: Pool, now = new Date()) {
  let n = 0;
  await tx(async (db) => {
    const due = await q<any>(db,
      `select r.id, r.text, r.household_id, m.id as mid, m.phone, m.language, m.consent_at, m.opted_out_at, m.last_inbound_at
         from reminders r join members m on m.id=r.member_id
        where r.status='pending' and r.due_at <= $1 order by r.due_at limit 100 for update of r skip locked`, [now]);
    for (const r of due) {
      const lang = asLang(r.language);
      await notify(db, { id: r.mid, phone: r.phone, language: r.language, consent_at: r.consent_at, opted_out_at: r.opted_out_at, last_inbound_at: r.last_inbound_at, household_id: r.household_id }, now,
        t(lang, 'reminder_fire', { text: r.text }), { name: config.wa.templates.reminder, params: [r.text] });
      await db.query(`update reminders set status='sent', sent_at=now() where id=$1`, [r.id]);
      n++;
    }
  });
  return n;
}

/** Weekly recap: Sundays 18:00-23:59 household time, once a week, only for households active in the last 14 days (templates cost money). */
export async function runWeeklyRecaps(pool: Pool, now = new Date()) {
  let n = 0;
  const hs = await q<any>(pool,
    `select id, name, timezone, currency, language, monthly_budget from households
      where deleted_at is null and (last_recap_at is null or last_recap_at < $1 - interval '6 days')
        and last_activity_at > $1 - interval '14 days'`, [now]);
  for (const h of hs) {
    const local = new Date(now.toLocaleString('en-US', { timeZone: h.timezone }));
    if (local.getDay() !== 0 || local.getHours() < 18) continue;
    await tx(async (db) => {
      const claimed = await db.query(`update households set last_recap_at=$2 where id=$1 and (last_recap_at is null or last_recap_at < $2 - interval '6 days')`, [h.id, now]);
      if (!claimed.rowCount) return;
      const s = await moneySummary(db, h.id);
      const open = (await q<{ c: number }>(db, `select count(*) as c from shopping_list_items where household_id=$1 and status='open'`, [h.id]))[0].c;
      const tasks = (await q<{ c: number }>(db, `select count(*) as c from tasks where household_id=$1 and status='open'`, [h.id]))[0].c;
      const members = await q<Mem>(db, 'select * from members where household_id=$1', [h.id]);
      for (const m of members) {
        const lang: Lang = asLang(m.language ?? h.language);
        const params = { household: h.name, spent: money(h.currency, s.spentThisMonth), budget: money(h.currency, h.monthly_budget), remaining: s.remaining == null ? '-' : money(h.currency, s.remaining), open, tasks };
        await notify(db, m, now, t(lang === 'en' ? 'en' : 'hinglish', 'recap', params), { name: config.wa.templates.weeklyRecap, params: Object.values(params).map(String) });
        n++;
      }
    });
  }
  return n;
}

export async function cleanup(pool: Pool) {
  await pool.query('delete from conversation_state where expires_at < now()');
  await pool.query(`delete from login_tokens where expires_at < now() - interval '1 day'`);
}

export function startScheduler(pool: Pool, wa: WaClient) {
  if (!config.jobs.enabled) return () => {};
  let busy = false;
  const tick = async () => {
    if (busy) return; busy = true;
    try { await runDueReminders(pool); await runWeeklyRecaps(pool); await processOutbox(pool, wa); await cleanup(pool); }
    catch (e) { console.error('scheduler tick failed', e); }
    finally { busy = false; }
  };
  const id = setInterval(tick, config.jobs.tickMs);
  return () => clearInterval(id);
}
