import { randomBytes } from 'node:crypto';
import { q, one, type Db } from '../db/index.js';
import { ConsentError, NotFoundError, ValidationError } from './scope.js';

export type Household = {
  id: string; name: string; currency: string; country: string; timezone: string; language: string; region: string;
  living_type: string; monthly_budget: number; diet: string; allergens: string[]; cooking_equipment: string[];
  cooking_minutes_max: number; new_city_mode: boolean; data_sharing: { meal_log_summary: boolean };
};
export type Member = {
  id: string; household_id: string; phone: string; name: string; role: string; language: string | null;
  consent_at: string | null; opted_out_at: string | null; last_inbound_at: string | null; diet: string | null; allergens: string[];
  schedule_prefs: { busy?: string[] };
};

export async function audit(db: Db, householdId: string | null, actor: string | null, action: string, entity: string, entityId?: string | null, detail?: unknown) {
  await db.query('insert into audit_log (household_id, actor_member_id, action, entity, entity_id, detail) values ($1,$2,$3,$4,$5,$6)',
    [householdId, actor, action, entity, entityId ?? null, detail ? JSON.stringify(detail) : null]);
}

export function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length < 8 || d.length > 15) throw new ValidationError('Invalid phone number');
  return d;
}

export async function getMemberByPhone(db: Db, phone: string): Promise<Member | undefined> {
  return one<Member>(db, 'select * from members where phone=$1', [phone]);
}
export async function getMember(db: Db, householdId: string, memberId: string): Promise<Member> {
  const m = await one<Member>(db, 'select * from members where id=$1 and household_id=$2', [memberId, householdId]);
  if (!m) throw new NotFoundError('Member not found');
  return m;
}
export async function getHousehold(db: Db, householdId: string): Promise<Household> {
  const h = await one<Household>(db, 'select * from households where id=$1 and deleted_at is null', [householdId]);
  if (!h) throw new NotFoundError('Household not found');
  return h;
}
export const listMembers = (db: Db, householdId: string) =>
  q<Member>(db, 'select * from members where household_id=$1 order by created_at', [householdId]);

export type NewHousehold = {
  phone: string; memberName: string; householdName?: string; language?: string; currency?: string; country?: string; timezone?: string;
  living_type?: string; monthly_budget?: number; diet?: string; allergens?: string[]; region?: string; joined_via?: string;
};

/** Consent is explicit: the caller must already have asked the user. consent_at is stamped here. */
export async function createHousehold(db: Db, n: NewHousehold): Promise<{ household: Household; member: Member }> {
  const phone = normalizePhone(n.phone);
  if (await getMemberByPhone(db, phone)) throw new ValidationError('This phone is already in a household');
  const h = (await q<Household>(db,
    `insert into households (name, currency, country, timezone, language, living_type, monthly_budget, diet, allergens, region, joined_via)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
    [n.householdName ?? `${n.memberName}'s home`, n.currency ?? 'INR', n.country ?? 'IN', n.timezone ?? 'Asia/Kolkata', n.language ?? 'hinglish',
      n.living_type ?? 'shared_flat', n.monthly_budget ?? 0, n.diet ?? 'veg', n.allergens ?? [], n.region ?? 'north', n.joined_via ?? 'direct']))[0];
  const m = (await q<Member>(db,
    `insert into members (household_id, phone, name, role, consent_at, last_inbound_at) values ($1,$2,$3,'admin',now(),now()) returning *`,
    [h.id, phone, n.memberName]))[0];
  await audit(db, h.id, m.id, 'create', 'household', h.id);
  return { household: h, member: m };
}

export async function createInvite(db: Db, householdId: string, createdBy: string, days = 7): Promise<string> {
  const code = randomBytes(4).toString('hex').toUpperCase();
  await db.query('insert into invites (code, household_id, created_by, expires_at) values ($1,$2,$3, now() + ($4 || \' days\')::interval)', [code, householdId, createdBy, String(days)]);
  return code;
}

export async function peekInvite(db: Db, code: string) {
  return one<{ household_id: string; name: string }>(db,
    `select i.household_id, h.name from invites i join households h on h.id=i.household_id
     where i.code=$1 and i.expires_at > now() and h.deleted_at is null`, [code.toUpperCase()]);
}

export async function joinByInvite(db: Db, code: string, phone: string, memberName: string): Promise<{ household: Household; member: Member }> {
  const inv = await peekInvite(db, code);
  if (!inv) throw new NotFoundError('Invite not found or expired');
  const p = normalizePhone(phone);
  if (await getMemberByPhone(db, p)) throw new ValidationError('This phone is already in a household');
  const m = (await q<Member>(db,
    `insert into members (household_id, phone, name, consent_at, last_inbound_at) values ($1,$2,$3,now(),now()) returning *`,
    [inv.household_id, p, memberName]))[0];
  await db.query('update invites set used_count = used_count + 1 where code=$1', [code.toUpperCase()]);
  await db.query(`update households set joined_via='invite' where false`); // household origin stays with the founder
  await audit(db, inv.household_id, m.id, 'join', 'member', m.id, { via: 'invite' });
  return { household: await getHousehold(db, inv.household_id), member: m };
}

export async function touchInbound(db: Db, memberId: string) {
  await db.query('update members set last_inbound_at=now() where id=$1', [memberId]);
  await db.query('update households set last_activity_at=now() where id=(select household_id from members where id=$1)', [memberId]);
}

export async function optOut(db: Db, memberId: string) {
  await db.query('update members set opted_out_at=now() where id=$1', [memberId]);
}
export async function optIn(db: Db, memberId: string) {
  await db.query('update members set opted_out_at=null where id=$1', [memberId]);
}

const UPDATABLE = ['name', 'language', 'region', 'living_type', 'monthly_budget', 'diet', 'allergens', 'cooking_equipment', 'cooking_minutes_max', 'timezone', 'currency', 'new_city_mode', 'data_sharing'] as const;
export async function updateHousehold(db: Db, householdId: string, actor: string, patch: Partial<Record<typeof UPDATABLE[number], unknown>>) {
  const keys = Object.keys(patch).filter(k => (UPDATABLE as readonly string[]).includes(k));
  if (!keys.length) throw new ValidationError('Nothing to update');
  const sets = keys.map((k, i) => `${k}=$${i + 3}`).join(', ');
  const vals = keys.map(k => (k === 'data_sharing' ? JSON.stringify((patch as any)[k]) : (patch as any)[k]));
  await db.query(`update households set ${sets} where id=$1 and $2::uuid is not null`, [householdId, actor, ...vals]);
  await audit(db, householdId, actor, 'update', 'household', householdId, patch);
  return getHousehold(db, householdId);
}

export const BUSY_KEY = /^(mon|tue|wed|thu|fri|sat|sun):(breakfast|lunch|dinner)$/;
export async function updateMember(db: Db, householdId: string, memberId: string, patch: { name?: string; language?: string | null; diet?: string | null; allergens?: string[]; schedule_prefs?: { busy: string[] } }) {
  await getMember(db, householdId, memberId);
  if (patch.schedule_prefs && !patch.schedule_prefs.busy.every(k => BUSY_KEY.test(k))) throw new ValidationError('Busy slots look like "mon:dinner"');
  await db.query(
    `update members set name=coalesce($3,name), language=coalesce($4,language), diet=coalesce($5,diet), allergens=coalesce($6,allergens), schedule_prefs=coalesce($7::jsonb,schedule_prefs) where id=$1 and household_id=$2`,
    [memberId, householdId, patch.name ?? null, patch.language ?? null, patch.diet ?? null, patch.allergens ?? null, patch.schedule_prefs ? JSON.stringify({ busy: [...new Set(patch.schedule_prefs.busy)] }) : null]);
}

export async function requireConsent(m: Member) {
  if (!m.consent_at) throw new ConsentError('Member has not given consent');
  if (m.opted_out_at) throw new ConsentError('Member has opted out');
}

/** Everything the requesting member may see about themself and their household. Other members' private meal logs are never included. */
export async function exportData(db: Db, householdId: string, memberId: string) {
  const t = (name: string, where = 'household_id=$1', params: unknown[] = [householdId]) => q(db, `select * from ${name} where ${where}`, params);
  return {
    exportedAt: new Date().toISOString(),
    household: await getHousehold(db, householdId),
    members: (await listMembers(db, householdId)).map(({ phone, ...m }) => m),
    contributions: await t('contributions'), purchases: await t('purchases'), settlements: await t('settlements'),
    shoppingList: await t('shopping_list_items'), tasks: await t('tasks'), pantry: await t('pantry_items'),
    mealPlans: await t('meal_plans'),
    myMealLogs: await t('meal_logs', 'household_id=$1 and member_id=$2', [householdId, memberId]),
    myReminders: await t('reminders', 'household_id=$1 and member_id=$2', [householdId, memberId]),
  };
}

/** A member leaves: personal data is erased; the shared ledger keeps an anonymised name so balances stay intact. */
export async function deleteMemberData(db: Db, householdId: string, memberId: string) {
  const m = await getMember(db, householdId, memberId);
  await db.query('delete from meal_logs where member_id=$1', [memberId]);
  await db.query('delete from reminders where member_id=$1', [memberId]);
  await db.query('delete from login_tokens where member_id=$1', [memberId]);
  await db.query('delete from conversation_state where phone=$1', [m.phone]);
  await db.query("update message_log set body=null, parsed_json=null, phone=null where member_id=$1", [memberId]);
  await db.query(`update members set name='Former member', phone='deleted:'||id, opted_out_at=now(), consent_at=null, allergens='{}', diet=null where id=$1`, [memberId]);
  await audit(db, householdId, memberId, 'delete_personal_data', 'member', memberId);
}

export async function deleteHousehold(db: Db, householdId: string) {
  const members = await listMembers(db, householdId);
  for (const m of members) {
    await db.query('delete from conversation_state where phone=$1', [m.phone]);
    await db.query('delete from outbound_messages where to_phone=$1', [m.phone]);
  }
  await db.query('delete from message_log where household_id=$1', [householdId]);
  // ledger rows reference members without cascade, so remove them first
  for (const t of ['purchases', 'contributions', 'settlements']) await db.query(`delete from ${t} where household_id=$1`, [householdId]);
  await db.query('delete from audit_log where household_id=$1', [householdId]);
  await db.query('delete from households where id=$1', [householdId]);
}
