import pg from 'pg';
import { migrate } from '../src/db/migrate.js';
import { setPool } from '../src/db/index.js';
import { seedReferenceData } from '../src/db/seed.js';

export const TEST_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5433/shared_living_test';
export const testPool = new pg.Pool({ connectionString: TEST_URL, max: 5 });
setPool(testPool);
let ready = false;

export async function freshDb() {
  if (!ready) { await migrate(testPool); ready = true; }
  await testPool.query(`truncate households, message_log, ai_calls, outbound_messages, conversation_state, audit_log, pilot_commitments restart identity cascade`);
  await seedReferenceData(testPool); // TRUNCATE CASCADE also clears the regional price defaults
  return testPool;
}

let n = 0;
export async function mkHousehold(db: pg.Pool, names = ['Aman', 'Raj'], opts: Record<string, unknown> = {}) {
  const { createHousehold, joinByInvite, createInvite } = await import('../src/domain/households.js');
  const base = 9100000000 + (++n) * 10;
  const { household, member } = await createHousehold(db, { phone: String(base), memberName: names[0], monthly_budget: 3000, ...opts });
  const members = [member];
  for (let i = 1; i < names.length; i++) {
    const code = await createInvite(db, household.id, member.id);
    members.push((await joinByInvite(db, code, String(base + i), names[i])).member);
  }
  return { household, members };
}
