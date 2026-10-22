import { q, one, type Db } from '../db/index.js';
import { NotFoundError } from './scope.js';

// Food-related reminders only (for example "soak rajma tonight"). Not a general to-do app.
const FOOD_WORDS = /(soak|bhig|भिग|ਭਿ|cook|bana|बना|ਬਣਾ|dal|rajma|chole|chawal|rice|sabzi|roti|atta|aata|dough|gund|ferment|batter|marinat|defrost|thaw|grocery|saman|saaman|sabji|milk|doodh|dahi|curd|set|khana|khaana|meal|lunch|dinner|breakfast|tiffin|fridge|buy|kharid|le aana|order|menu|recipe|paneer|egg|anda|veg|fruit|prep|pantry)/i;

export const isFoodReminder = (text: string) => FOOD_WORDS.test(text);

export async function createReminder(db: Db, o: { householdId: string; memberId: string; text: string; dueAt: Date; tz: string; waMessageId?: string }) {
  if (!isFoodReminder(o.text)) return { rejected: true as const };
  if (o.waMessageId) {
    const ex = await one<{ id: string }>(db, 'select id from reminders where wa_message_id=$1 and household_id=$2', [o.waMessageId, o.householdId]);
    if (ex) return { id: ex.id, duplicate: true as const };
  }
  const r = (await q<{ id: string }>(db, 'insert into reminders (household_id, member_id, text, due_at, tz, wa_message_id) values ($1,$2,$3,$4,$5,$6) returning id',
    [o.householdId, o.memberId, o.text.slice(0, 200), o.dueAt, o.tz, o.waMessageId ?? null]))[0];
  return { id: r.id, duplicate: false as const };
}

export const listReminders = (db: Db, householdId: string, memberId: string) =>
  q(db, `select id, text, due_at, status from reminders where household_id=$1 and member_id=$2 and status='pending' order by due_at`, [householdId, memberId]);

export async function cancelReminder(db: Db, householdId: string, memberId: string, id: string) {
  const r = await db.query(`update reminders set status='cancelled' where id=$1 and household_id=$2 and member_id=$3`, [id, householdId, memberId]);
  if (!r.rowCount) throw new NotFoundError('Reminder not found');
}
