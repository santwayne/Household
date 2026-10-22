import { q, one, type Db } from '../db/index.js';

// Target Market PDF, section 7: success and stop rules for the 4-week pilot. These thresholds are proposals, not data.
export const RULES = { activeWeek3Go: 0.5, activeWeek3Stop: 1 / 3, payGo: 0.2 };

export async function pilotMetrics(db: Db) {
  const [tot] = await q<{ n: number }>(db, 'select count(*) as n from households where deleted_at is null');
  const [active] = await q<{ n: number }>(db, `select count(distinct household_id) as n from message_log where direction='in' and created_at >= now() - interval '7 days' and household_id is not null`);
  const [byInvite] = await q<{ n: number }>(db, `select count(*) as n from members m where m.created_at > (select min(created_at) from members x where x.household_id=m.household_id)`);
  const [members] = await q<{ n: number }>(db, 'select count(*) as n from members');
  const [committed] = await q<{ n: number }>(db, `select count(distinct household_id) as n from pilot_commitments where kind in ('committed','paid')`);
  const [paid] = await q<{ n: number }>(db, `select count(distinct household_id) as n from pilot_commitments where kind='paid'`);
  const weekly = await q<{ week: string; households: number }>(db, `select to_char(date_trunc('week', created_at), 'YYYY-MM-DD') as week, count(distinct household_id) as households from message_log where direction='in' and household_id is not null group by 1 order by 1`);
  const ai = await one<{ calls: number; cost: number }>(db, `select count(*) as calls, coalesce(sum(cost_usd),0) as cost from ai_calls where kind='parse'`);
  const total = tot.n || 0;
  const activeShare = total ? active.n / total : 0;
  const payShare = total ? committed.n / total : 0;
  const decision = total < 5 ? 'not_enough_data'
    : activeShare >= RULES.activeWeek3Go && payShare >= RULES.payGo ? 'go'
    : activeShare < RULES.activeWeek3Stop || (payShare === 0 && total >= 10) ? 'stop_or_rethink' : 'continue_testing';
  return {
    households: total, activeLast7Days: active.n, activeShare: round(activeShare), committedOrPaid: committed.n, paid: paid.n, payShare: round(payShare),
    membersJoinedViaFlatmate: byInvite.n, memberCount: members.n, flatmateInviteShare: members.n ? round(byInvite.n / Math.max(members.n - total, 1)) : 0,
    weeklyActiveHouseholds: weekly, aiParseCalls: ai?.calls ?? 0, aiParseCostUsd: ai?.cost ?? 0, rules: RULES, decision,
    note: 'Thresholds are proposals from the market document. Commitments should be real payment or written commitment, not survey answers.',
  };
}
const round = (n: number) => Math.round(n * 1000) / 1000;
