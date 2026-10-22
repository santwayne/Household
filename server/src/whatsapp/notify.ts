import type { Db } from '../db/index.js';
import { config } from '../config.js';
import { enqueue } from './outbox.js';

const WINDOW_MS = 24 * 3600 * 1000;

export type Recipient = { phone: string; household_id: string; consent_at: string | null; opted_out_at: string | null; last_inbound_at: string | null };

/**
 * Inside the 24-hour window: free-form text. Outside: an approved (paid) template, which must exist in Meta Business Manager [verify].
 * allowTemplate=false means "only if it is free": used for optional nudges so we never pay for them.
 */
export async function notify(db: Db, m: Recipient, now: Date, text: string, template: { name: string; params: string[] }, allowTemplate = true): Promise<'text' | 'template' | 'skipped'> {
  if (!m.consent_at || m.opted_out_at) return 'skipped';
  const inWindow = !!m.last_inbound_at && now.getTime() - new Date(m.last_inbound_at).getTime() <= WINDOW_MS;
  if (inWindow) { await enqueue(db, { phone: m.phone, householdId: m.household_id, payload: { text } }); return 'text'; }
  if (!allowTemplate) return 'skipped';
  await enqueue(db, { phone: m.phone, householdId: m.household_id, payload: { template: template.name, lang: 'en', params: template.params } });
  return 'template';
}

export const budgetAlertUsesTemplates = () => process.env.BUDGET_ALERT_TEMPLATES === '1';
export const budgetAlertTemplate = () => process.env.WA_TPL_BUDGET ?? config.wa.templates.budgetAlert;
