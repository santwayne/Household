import pg from 'pg';
import { config } from '../config.js';

// numeric -> string by default in pg; we parse to number explicitly where money is handled.
pg.types.setTypeParser(1700, (v: string) => Number(v));
pg.types.setTypeParser(20, (v: string) => Number(v));
pg.types.setTypeParser(1082, (v: string) => v); // date as YYYY-MM-DD string

export type Db = pg.Pool | pg.PoolClient;

export let pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

export function setPool(p: pg.Pool) { pool = p; }

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const r = await fn(c);
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export async function q<T = any>(db: Db, text: string, params: unknown[] = []): Promise<T[]> {
  const r = await db.query(text, params as any[]);
  return r.rows as T[];
}

export async function one<T = any>(db: Db, text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await q<T>(db, text, params))[0];
}
