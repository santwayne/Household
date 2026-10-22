import type { Pool, PoolClient } from 'pg';
import { one, q, tx } from '../db/index.js';
import { config } from '../config.js';
import { createHousehold, createInvite, getHousehold, getMemberByPhone, joinByInvite, listMembers, normalizePhone, peekInvite, touchInbound, updateHousehold, type Household, type Member } from '../domain/households.js';
import { enqueue, processOutbox } from '../whatsapp/outbox.js';
import type { WaClient } from '../whatsapp/client.js';
import { costUsd, parseWithLlm, type LlmClient } from './llm.js';
import { transcribeVoice, type SttClient } from './stt.js';
import { asLang, detectLang, type Lang } from './lang.js';
import { t, money } from './i18n.js';
import { parseByRules, parseAmount } from './rules.js';
import { missingField, type Action } from './schema.js';
import { confirmDelete, executeAction, waLink, type Ctx, type ExecResult, type Pending } from './execute.js';
import { resolveMember } from './names.js';
import { localDate } from './tz.js';
import { scopeTo } from '../db/tenant.js';

export type InboundMsg = {
  waMessageId: string; phone: string; profileName?: string | null;
  type: 'text' | 'audio' | 'image' | 'other'; text?: string; mediaId?: string; timestamp?: number;
};
export type Deps = { pool: Pool; wa: WaClient; llm: LlmClient | null; stt: SttClient | null; now?: () => Date };

type State = { step: string; [k: string]: unknown };

const STATE_TTL_MIN = 60;

async function getState(db: PoolClient, phone: string): Promise<State | null> {
  const r = await one<{ state: State }>(db, 'select state from conversation_state where phone=$1 and expires_at > now()', [phone]);
  return r?.state ?? null;
}
const setState = (db: PoolClient, phone: string, s: State | null) =>
  s ? db.query(`insert into conversation_state (phone, state, expires_at) values ($1,$2, now() + interval '${STATE_TTL_MIN} minutes') on conflict (phone) do update set state=excluded.state, expires_at=excluded.expires_at`, [phone, JSON.stringify(s)])
    : db.query('delete from conversation_state where phone=$1', [phone]);

const ALLERGEN_WORDS: [RegExp, string][] = [
  [/peanut|moongfali|groundnut/, 'peanut'], [/\bnuts?\b/, 'peanut'], [/dairy|milk|doodh|lactose/, 'dairy'], [/gluten|wheat|gehu/, 'gluten'],
  [/soy/, 'soy'], [/\begg|anda/, 'egg'], [/fish/, 'fish'], [/sesame|til\b/, 'sesame'], [/mustard|sarson/, 'mustard'],
];
export function parseDietAndAllergens(text: string): { diet: 'vegan' | 'veg' | 'egg' | 'nonveg' | null; allergens: string[] } {
  const s = text.toLowerCase();
  // allergens come only from segments that say "allergy/allergic" (or follow "allergic to ..."), so "egg, dairy allergy" means egg diet + dairy allergy
  const segments = s.split(/,|;|\band\b|\baur\b/);
  const allergyText = [
    ...segments.filter(x => /allerg/.test(x)),
    ...(s.match(/allerg(?:ic|y|ies)\s*(?:to|:)\s*(.+)$/)?.[1] ? [s.match(/allerg(?:ic|y|ies)\s*(?:to|:)\s*(.+)$/)![1]] : []),
  ].join(' ');
  const allergens = [...new Set(ALLERGEN_WORDS.filter(([r]) => r.test(allergyText)).map(([, a]) => a))];
  const dietText = segments.filter(x => !/allerg/.test(x)).join(' ');
  const diet = /non[- ]?veg|nonveg|chicken|meat/.test(dietText) ? 'nonveg' : /eggetarian|\begg\b/.test(dietText) ? 'egg' : /vegan/.test(dietText) ? 'vegan' : /\bveg\b|vegetarian|shakahari/.test(dietText) ? 'veg' : null;
  return { diet, allergens };
}

export type HandleResult = { outcome: 'processed' | 'duplicate' | 'ignored' | 'error'; replies: string[]; action?: Action | null; source?: string };

export async function handleInbound(deps: Deps, msg: InboundMsg): Promise<HandleResult> {
  const now = (deps.now ?? (() => new Date()))();
  const phone = normalizePhone(msg.phone);

  // 1. De-duplicate by WhatsApp message id (Meta retries webhooks).
  const ins = await deps.pool.query(
    `insert into message_log (wa_message_id, direction, phone, msg_type, body, outcome) values ($1,'in',$2,$3,$4,'received') on conflict (wa_message_id) do nothing returning id`,
    [msg.waMessageId, phone, msg.type, msg.type === 'text' ? msg.text ?? null : null]);
  let logId: string | undefined = ins.rows[0]?.id;
  if (!logId) {
    const ex = await one<{ id: string; outcome: string; created_at: string }>(deps.pool, 'select id, outcome, created_at from message_log where wa_message_id=$1', [msg.waMessageId]);
    const stale = ex && ex.outcome === 'received' && now.getTime() - new Date(ex.created_at).getTime() > 60_000;
    if (!stale) return { outcome: 'duplicate', replies: [] };
    logId = ex!.id; // a previous attempt crashed before finishing: safe to retry, all writes are idempotent by message id
  }

  // abuse guard: more than 30 messages from one number in a minute is ignored (no reply, no processing)
  const burst = await one<{ n: number }>(deps.pool, `select count(*) as n from message_log where direction='in' and phone=$1 and created_at > now() - interval '60 seconds'`, [phone]);
  if ((burst?.n ?? 0) > 30) {
    await deps.pool.query(`update message_log set outcome='rate_limited', processed_at=now() where id=$1`, [logId]);
    return { outcome: 'ignored', replies: [] };
  }

  try {
    // 2. Voice notes: transcribe, reject silence / noise / prompt echo.
    let text = msg.text ?? '';
    let viaVoice = false;
    if (msg.type === 'audio') {
      const known = await getMemberByPhone(deps.pool, phone);
      if (!known || !deps.stt || !msg.mediaId) return await finish(deps, logId, phone, null, t('hinglish', 'voice_failed'), 'ignored', null, now);
      const media = await deps.wa.getMedia(msg.mediaId);
      const tr = await transcribeVoice(deps.stt, media.data, media.mime);
      if (!tr.ok) {
        await deps.pool.query('insert into ai_calls (message_log_id, kind, outcome) values ($1,$2,$3)', [logId, 'transcribe', tr.reason.slice(0, 60)]);
        return await finish(deps, logId, phone, known, t(asLang(known.language ?? undefined), 'voice_failed'), 'ignored', null, now); // nothing is saved for noise
      }
      text = tr.text; viaVoice = true;
    }
    if (msg.type === 'image' || msg.type === 'other') {
      const known = await getMemberByPhone(deps.pool, phone);
      return await finish(deps, logId, phone, known ?? null, t(asLang(known?.language ?? 'hinglish'), 'image_unsupported'), 'ignored', null, now);
    }
    text = text.trim();
    if (!text) return { outcome: 'ignored', replies: [] };

    // 3-6. Everything below runs in ONE transaction: parse -> validate -> save -> enqueue reply.
    const result = await tx(async (db) => {
      const member = await getMemberByPhone(db, phone);
      if (!member) return onboarding(db, phone, text, msg.profileName ?? null, now);
      await touchInbound(db, member.id);
      await scopeTo(db, member.household_id); // from here on Postgres only shows this household's rows
      const h = await getHousehold(db, member.household_id);
      const members = await listMembers(db, h.id);
      const lang = detectLang(text, asLang(member.language ?? h.language));
      const ctx: Ctx = { db, h, m: member, members, lang, msgId: msg.waMessageId, now, source: 'rules' };

      // opted-out members only get answers to START / DELETE
      let parsedFirst = parseByRules(text);
      if (member.opted_out_at && !(parsedFirst && ['start', 'delete_data', 'yes'].includes(parsedFirst.intent))) {
        const st0 = await getState(db, phone);
        if (st0?.step !== 'delete_confirm') return { replies: [], action: parsedFirst, source: 'rules', member, suppress: true };
      }

      const state = await getState(db, phone);
      // onboarding setup questions for a brand-new household
      if (state?.step === 'setup_budget' || state?.step === 'setup_diet') return handleSetup(db, ctx, state, text);

      // pending confirmations / clarifications
      if (state) {
        const p = state as unknown as Pending;
        if (p.step === 'confirm' || p.step === 'delete_confirm') {
          const a = parsedFirst?.intent;
          if (a === 'yes') {
            await setState(db, phone, null);
            const r = p.step === 'delete_confirm' ? await confirmDelete(ctx) : await executeAction({ ...ctx, source: 'llm', confirmed: true }, p.action);
            return { ...r, action: p.step === 'confirm' ? p.action : null, source: 'confirm', member, lang };
          }
          if (a === 'no') { await setState(db, phone, null); return { replies: [t(lang, 'confirm_cancelled')], action: null, source: 'confirm', member, lang }; }
          await setState(db, phone, null); // anything else abandons the question and is handled normally
        } else if (p.step === 'who') {
          const r = resolveMember(members, text.replace(/[.!?]/g, ''), member);
          await setState(db, phone, null);
          if ('member' in r && text.trim().length <= 30) {
            const a = { ...p.action, [p.field]: r.member.name } as Action;
            const out = await executeAction(ctx, a);
            await persistPending(db, phone, out);
            return { ...out, action: a, source: 'who', member, lang };
          }
        } else if (p.step === 'reminder_when') {
          const { parseWhen } = await import('./rules.js');
          const w = parseWhen(text.toLowerCase());
          await setState(db, phone, null);
          if (w.when) {
            const a: Action = { intent: 'create_reminder', confidence: 1, needs_confirmation: false, text: p.text, when: w.when };
            const out = await executeAction(ctx, a);
            await persistPending(db, phone, out);
            return { ...out, action: a, source: 'reminder_when', member, lang };
          }
        }
      }

      // 4. rules first, then the model with a strict schema
      let action: Action | null = parsedFirst;
      let source: 'rules' | 'llm' = 'rules';
      if (!action && deps.llm) {
        const parsed = await parseWithLlm(deps.llm, text, { memberNames: members.map(x => x.name), senderName: member.name, currency: h.currency, today: localDate(h.timezone, now), timezone: h.timezone });
        await db.query('insert into ai_calls (message_log_id, kind, model, prompt_tokens, completion_tokens, cost_usd, latency_ms, parsed_json, outcome) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [logId, 'parse', parsed.usage?.model ?? null, parsed.usage?.promptTokens ?? null, parsed.usage?.completionTokens ?? null, parsed.usage ? costUsd(parsed.usage) : null, parsed.usage?.latencyMs ?? null, JSON.stringify(parsed.raw ?? null), parsed.outcome]);
        if (parsed.action) { action = parsed.action; source = 'llm'; }
      }
      // 5. validate: low confidence, unknown intent or missing required field -> ask, never guess
      if (!action || action.intent === 'unknown' || (source === 'llm' && action.confidence < 0.5)) return { replies: [t(lang, 'unknown')], action, source, member, lang };
      const miss = missingField(action);
      if (miss) return { replies: [t(lang, 'unknown')], action, source, member, lang };
      // reply language: explicit model hint wins only for model-parsed actions; otherwise the script of the latest message
      const useLang: Lang = lang;
      const out = await executeAction({ ...ctx, source, lang: useLang }, action);
      await persistPending(db, phone, out);
      return { ...out, action, source, member, lang: useLang };
    });

    return await finish(deps, logId, phone, (result as any).member ?? null, result.replies, 'processed', (result as any).action ?? null, now, (result as any).source, (result as any).allowOptedOut, (result as any).suppress, (result as any).pending ?? null, viaVoice);
  } catch (e) {
    await deps.pool.query(`update message_log set outcome='error', error=$2, processed_at=now() where id=$1`, [logId, String((e as Error).message).slice(0, 300)]);
    const known = await getMemberByPhone(deps.pool, phone);
    const lang = asLang(known?.language ?? 'hinglish');
    await enqueue(deps.pool, { phone, householdId: known?.household_id, payload: { text: t(lang, 'error_generic') } });
    await processOutbox(deps.pool, deps.wa, now).catch(() => {});
    return { outcome: 'error', replies: [t(lang, 'error_generic')] };
  }
}

async function persistPending(db: PoolClient, phone: string, out: ExecResult) {
  if (out.pending) await setState(db, phone, out.pending as unknown as State);
}

/** Write the reply to the outbox (after the data transaction committed), flush it, and close the log row. */
async function finish(deps: Deps, logId: string, phone: string, member: Member | null, replies: string | string[], outcome: 'processed' | 'ignored', action: Action | null, now: Date, source?: string, allowOptedOut?: boolean, suppress?: boolean, pending?: { step?: string } | null, viaVoice?: boolean): Promise<HandleResult> {
  const list = Array.isArray(replies) ? replies : [replies];
  if (!suppress) for (const text of list.filter(Boolean)) await enqueue(deps.pool, { phone, householdId: member?.household_id, payload: { text, allowOptedOut: !!allowOptedOut } });
  await deps.pool.query(`update message_log set outcome=$2, parsed_json=$3, household_id=$4, member_id=$5, processed_at=now() where id=$1`,
    [logId, outcome, JSON.stringify({ source: source ?? null, via_voice: !!viaVoice, action, asked_confirmation: pending?.step === 'confirm' }), member?.household_id ?? null, member?.id ?? null]);
  if (!suppress) await processOutbox(deps.pool, deps.wa, now);
  return { outcome, replies: suppress ? [] : list, action, source };
}

// ---------------------------------------------------------------- onboarding
async function onboarding(db: PoolClient, phone: string, text: string, profileName: string | null, now: Date) {
  const lang = detectLang(text, 'hinglish');
  const parsed = parseByRules(text);
  const state = await getState(db, phone);
  const joinMatch = text.trim().match(/^join\s+([a-z0-9]{6,12})$/i);
  const name = (profileName ?? '').trim().slice(0, 40) || 'Friend';

  if (joinMatch) {
    const inv = await peekInvite(db, joinMatch[1]);
    if (!inv) return { replies: [t(lang, 'invite_bad')], action: null, source: 'onboarding' };
    await setState(db, phone, { step: 'join_consent', code: joinMatch[1].toUpperCase(), name });
    return { replies: [t(lang, 'consent_join', { household: inv.name }) + `\nPrivacy: ${config.publicUrl}/privacy`], action: null, source: 'onboarding' };
  }
  if (state?.step === 'join_consent') {
    if (parsed?.intent === 'yes') {
      await setState(db, phone, null);
      try {
        const { household, member } = await joinByInvite(db, String(state.code), phone, String(state.name));
        return { replies: [t(lang, 'joined', { name: member.name, household: household.name })], action: null, source: 'onboarding' };
      } catch { return { replies: [t(lang, 'invite_bad')], action: null, source: 'onboarding' }; }
    }
    await setState(db, phone, null);
    return { replies: [t(lang, 'consent_declined')], action: null, source: 'onboarding' };
  }
  if (state?.step === 'start_consent' && parsed?.intent === 'yes') {
    const { household, member } = await createHousehold(db, { phone, memberName: name, language: lang === 'en' ? 'en' : lang, timezone: 'Asia/Kolkata' });
    await setState(db, phone, { step: 'setup_budget' });
    return { replies: [t(lang, 'setup_budget', { name: member.name })], action: null, source: 'onboarding' };
  }
  if (state?.step === 'start_consent' && parsed?.intent === 'no') { await setState(db, phone, null); return { replies: [t(lang, 'consent_declined')], action: null, source: 'onboarding' }; }
  // first contact: the user messaged us first, which opens the window; we ask for explicit consent before saving anything
  await setState(db, phone, { step: 'start_consent' });
  return { replies: [t(lang, 'welcome_consent') + `\nPrivacy: ${config.publicUrl}/privacy`], action: null, source: 'onboarding' };
}

async function handleSetup(db: PoolClient, ctx: Ctx, state: State, text: string) {
  const { m, h, lang } = ctx;
  if (/^(skip|baad mein|later)$/i.test(text.trim())) {
    await setState(db, m.phone, null);
    const code = await createInvite(db, h.id, m.id);
    return { replies: [t(lang, 'setup_done', { code, link: waLink(code) })], action: null, source: 'setup', member: m, lang };
  }
  if (state.step === 'setup_budget') {
    const amt = parseAmount(text.replace(/budget|rs|₹/gi, '').trim()) ?? parseAmount((text.match(/\d[\d,]*(?:\.\d+)?\s*k?/)?.[0] ?? ''));
    if (!amt) return { replies: [t(lang, 'setup_budget', { name: m.name })], action: null, source: 'setup', member: m, lang };
    await updateHousehold(ctx.db, h.id, m.id, { monthly_budget: amt });
    await setState(ctx.db, m.phone, { step: 'setup_diet' });
    return { replies: [t(lang, 'setup_diet', { budget: money(h.currency, amt) })], action: null, source: 'setup', member: m, lang };
  }
  const { diet, allergens } = parseDietAndAllergens(text);
  if (!diet && !allergens.length) return { replies: [t(lang, 'setup_diet', { budget: money(h.currency, h.monthly_budget) })], action: null, source: 'setup', member: m, lang };
  await updateHousehold(ctx.db, h.id, m.id, { ...(diet ? { diet } : {}), ...(allergens.length ? { allergens } : {}) });
  await setState(ctx.db, m.phone, null);
  const code = await createInvite(ctx.db, h.id, m.id);
  return { replies: [t(lang, 'setup_done', { code, link: waLink(code) })], action: null, source: 'setup', member: m, lang };
}
