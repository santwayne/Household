import { createHash, randomBytes } from 'node:crypto';
import { one, type Db } from '../db/index.js';
import { config } from '../config.js';

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

/** One-time links (kind link / export) and sessions (kind session). Only a hash is stored. */
export async function issueToken(db: Db, memberId: string, kind: 'link' | 'export' | 'session', ttlMinutes: number): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await db.query(`insert into login_tokens (token_hash, member_id, kind, expires_at) values ($1,$2,$3, now() + ($4 || ' minutes')::interval)`, [hash(token), memberId, kind, String(ttlMinutes)]);
  return token;
}

/** Consumes a one-time token (link / export). */
export async function consumeToken(db: Db, token: string, kind: 'link' | 'export'): Promise<{ member_id: string } | undefined> {
  const r = await db.query(`update login_tokens set used_at=now() where token_hash=$1 and kind=$2 and used_at is null and expires_at > now() returning member_id`, [hash(token), kind]);
  return r.rows[0];
}

export async function sessionMember(db: Db, token: string | undefined) {
  if (!token) return undefined;
  return one<{ id: string; household_id: string; name: string; role: string }>(db,
    `select m.id, m.household_id, m.name, m.role from login_tokens t join members m on m.id=t.member_id
      where t.token_hash=$1 and t.kind='session' and t.expires_at > now() and m.opted_out_at is null and m.consent_at is not null`, [hash(token)]);
}

export const startSession = (db: Db, memberId: string) => issueToken(db, memberId, 'session', config.sessionTtlDays * 24 * 60);
export const endSession = (db: Db, token: string) => db.query(`delete from login_tokens where token_hash=$1 and kind='session'`, [hash(token)]);
