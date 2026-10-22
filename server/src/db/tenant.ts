import { AsyncLocalStorage } from 'node:async_hooks';
import type { PoolClient } from 'pg';
import { pool } from './index.js';

/** Switch the current transaction to the tenant role for one household. Everything after this runs under row-level security. */
export async function scopeTo(client: PoolClient, householdId: string) {
  await client.query('set local role sl_app');
  await client.query(`select set_config('app.household_id', $1, true)`, [householdId]);
}

const als = new AsyncLocalStorage<PoolClient>();

/** The tenant-scoped client of the current request. Throws outside withTenant so a handler can never fall back to an unscoped connection by accident. */
export function T(): PoolClient {
  const c = als.getStore();
  if (!c) throw new Error('No tenant context: this code must run inside withTenant()');
  return c;
}

export async function withTenant<R>(householdId: string, fn: (db: PoolClient) => Promise<R>): Promise<R> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await scopeTo(c, householdId);
    const r = await als.run(c, () => fn(c));
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
