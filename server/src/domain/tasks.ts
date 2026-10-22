import { q, one, type Db } from '../db/index.js';
import { listMembers } from './households.js';
import { NotFoundError } from './scope.js';

export type TaskKind = 'cooking' | 'grocery_run' | 'cleaning' | 'prep' | 'chore';

export async function createTask(db: Db, o: { householdId: string; title: string; kind?: TaskKind; ownerId?: string | null; dueAt?: string | null; recurrence?: string | null }) {
  return (await q<{ id: string }>(db, 'insert into tasks (household_id, title, kind, owner_id, due_at, recurrence) values ($1,$2,$3,$4,$5,$6) returning id',
    [o.householdId, o.title, o.kind ?? 'chore', o.ownerId ?? null, o.dueAt ?? null, o.recurrence ?? null]))[0];
}

export const listTasks = (db: Db, householdId: string, status = 'open') =>
  q(db, `select t.*, m.name as owner_name from tasks t left join members m on m.id=t.owner_id where t.household_id=$1 and t.status=$2 order by t.due_at nulls last, t.created_at`, [householdId, status]);

export async function completeTask(db: Db, householdId: string, taskId: string) {
  const t = await one<any>(db, 'select * from tasks where id=$1 and household_id=$2', [taskId, householdId]);
  if (!t) throw new NotFoundError('Task not found');
  await db.query(`update tasks set status='done', done_at=now() where id=$1`, [taskId]);
  if (t.recurrence === 'rotate_weekly' || t.recurrence === 'weekly' || t.recurrence === 'daily') {
    const members = await listMembers(db, householdId);
    let owner = t.owner_id;
    if (t.recurrence === 'rotate_weekly' && members.length) {
      const idx = members.findIndex(m => m.id === t.owner_id);
      owner = members[(idx + 1) % members.length].id;
    }
    const step = t.recurrence === 'daily' ? '1 day' : '7 days';
    await db.query(`insert into tasks (household_id, title, kind, owner_id, due_at, recurrence) values ($1,$2,$3,$4, coalesce($5::timestamptz, now()) + $6::interval, $7)`,
      [householdId, t.title, t.kind, owner, t.due_at, step, t.recurrence]);
  }
}

export async function swapTaskOwner(db: Db, householdId: string, taskId: string, newOwner: string) {
  const r = await db.query('update tasks set owner_id=$3 where id=$1 and household_id=$2 and exists (select 1 from members where id=$3 and household_id=$2)', [taskId, householdId, newOwner]);
  if (!r.rowCount) throw new NotFoundError('Task or member not found');
}

/** "Sunday Household Reset": fair rotation of duties for the week. */
export async function sundayReset(db: Db, householdId: string, weekStart: string) {
  const members = (await listMembers(db, householdId)).filter(m => !m.opted_out_at);
  if (!members.length) return [];
  const duties: [string, TaskKind][] = [['Grocery run', 'grocery_run'], ['Kitchen cleaning', 'cleaning'], ['Take out trash', 'chore']];
  const created: string[] = [];
  const offset = Math.floor(new Date(weekStart).getTime() / (7 * 86400000)) % members.length;
  duties.forEach(([title, kind], i) => created.push(title + ' -> ' + members[(i + offset) % members.length].name));
  for (let i = 0; i < duties.length; i++) {
    await createTask(db, { householdId, title: duties[i][0], kind: duties[i][1], ownerId: members[(i + offset) % members.length].id, dueAt: `${weekStart}T18:00:00Z`, recurrence: 'rotate_weekly' });
  }
  return created;
}
