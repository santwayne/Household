import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './index.js';
import { seedReferenceData } from './seed.js';
import type { Db } from './index.js';

export async function migrate(db: Db = pool) {
  const dir = dirname(fileURLToPath(import.meta.url));
  await db.query(readFileSync(join(dir, 'schema.sql'), 'utf8'));
  await seedReferenceData(db);
  await db.query(readFileSync(join(dir, 'rls.sql'), 'utf8'));
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  migrate().then(() => { console.log('migrated'); return pool.end(); }).catch(e => { console.error(e); process.exit(1); });
}
