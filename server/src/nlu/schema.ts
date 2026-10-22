import { z } from 'zod';

export const INTENTS = [
  'record_purchase', 'record_contribution', 'record_settlement', 'add_items', 'mark_bought', 'remove_items', 'show_list',
  'budget_remaining', 'show_balances', 'set_budget', 'plan_week', 'show_plan', 'show_today', 'swap_meal', 'log_meal',
  'weekly_balance', 'protein_rank', 'create_reminder', 'list_reminders', 'substitution', 'undo', 'dashboard', 'invite',
  'help', 'greeting', 'stop', 'start', 'delete_data', 'export_data', 'show_tasks', 'complete_task', 'sunday_reset',
  'cook_from_pantry', 'expiring', 'set_pantry', 'show_pantry', 'suggestions',
  'yes', 'no', 'unknown',
] as const;
export type Intent = typeof INTENTS[number];

export const WhenSchema = z.object({
  day: z.enum(['today', 'tomorrow', 'day_after']).optional(),
  part: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
  hour: z.number().int().min(0).max(23).optional(),
  minute: z.number().int().min(0).max(59).optional(),
});
export type When = z.infer<typeof WhenSchema>;

/** The strict structure the AI (or the rules) may propose. The backend validates it, does all arithmetic and writes. */
export const ActionSchema = z.object({
  intent: z.enum(INTENTS),
  confidence: z.number().min(0).max(1).default(1),
  payer: z.string().max(60).nullish(),          // null/absent = the sender
  member: z.string().max(60).nullish(),
  from: z.string().max(60).nullish(),
  to: z.string().max(60).nullish(),
  amount: z.number().positive().max(10_000_000).nullish(),
  items: z.array(z.string().max(80)).max(30).nullish(),
  store: z.string().max(80).nullish(),
  split: z.enum(['equal']).nullish(),
  split_members: z.array(z.string().max(60)).max(12).nullish(),  // names the purchase is split between (default: everyone)
  split_amounts: z.record(z.string().max(60), z.number().min(0).max(10_000_000)).nullish(),   // name -> amount, must add up to the total
  split_percents: z.record(z.string().max(60), z.number().min(0).max(100)).nullish(),       // name -> percent, must add up to 100
  budget: z.number().positive().max(10_000_000).nullish(),
  people: z.number().int().min(1).max(30).nullish(),
  days: z.number().int().min(1).max(31).nullish(),
  diet: z.enum(['vegan', 'veg', 'egg', 'nonveg']).nullish(),
  allergens: z.array(z.string().max(30)).max(10).nullish(),
  text: z.string().max(200).nullish(),
  when: WhenSchema.nullish(),
  slot: z.enum(['breakfast', 'lunch', 'dinner']).nullish(),
  day_name: z.string().max(20).nullish(),
  kind: z.enum(['home', 'ordered', 'outside']).nullish(),
  has_vegetables: z.boolean().nullish(),
  has_protein: z.boolean().nullish(),
  needs_confirmation: z.boolean().default(false),
  reply_language: z.enum(['en', 'hinglish', 'hi', 'pa']).nullish(),
});
export type Action = z.infer<typeof ActionSchema>;

/** JSON schema handed to the model (kept in sync by hand; zod remains the authority and rejects anything that does not match). */
export const ACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intent: { type: 'string', enum: INTENTS },
    confidence: { type: 'number' },
    payer: { type: ['string', 'null'] }, member: { type: ['string', 'null'] }, from: { type: ['string', 'null'] }, to: { type: ['string', 'null'] },
    amount: { type: ['number', 'null'] }, items: { type: ['array', 'null'], items: { type: 'string' } }, store: { type: ['string', 'null'] },
    split: { type: ['string', 'null'], enum: ['equal', null] }, split_members: { type: ['array', 'null'], items: { type: 'string' } },
    split_amounts: { type: ['object', 'null'], additionalProperties: { type: 'number' } }, split_percents: { type: ['object', 'null'], additionalProperties: { type: 'number' } }, budget: { type: ['number', 'null'] }, people: { type: ['integer', 'null'] },
    days: { type: ['integer', 'null'] }, diet: { type: ['string', 'null'], enum: ['vegan', 'veg', 'egg', 'nonveg', null] },
    allergens: { type: ['array', 'null'], items: { type: 'string' } }, text: { type: ['string', 'null'] },
    when: { type: ['object', 'null'], properties: { day: { type: ['string', 'null'], enum: ['today', 'tomorrow', 'day_after', null] }, part: { type: ['string', 'null'], enum: ['morning', 'afternoon', 'evening', 'night', null] }, hour: { type: ['integer', 'null'] }, minute: { type: ['integer', 'null'] } } },
    slot: { type: ['string', 'null'], enum: ['breakfast', 'lunch', 'dinner', null] }, day_name: { type: ['string', 'null'] },
    kind: { type: ['string', 'null'], enum: ['home', 'ordered', 'outside', null] }, has_vegetables: { type: ['boolean', 'null'] }, has_protein: { type: ['boolean', 'null'] },
    needs_confirmation: { type: 'boolean' }, reply_language: { type: ['string', 'null'], enum: ['en', 'hinglish', 'hi', 'pa', null] },
  },
  required: ['intent', 'confidence'],
} as const;

/** Per-intent required fields, checked in code. Returns the first missing field or null. */
export function missingField(a: Action): string | null {
  switch (a.intent) {
    case 'record_purchase': case 'record_contribution': case 'record_settlement': return a.amount ? null : 'amount';
    case 'add_items': case 'mark_bought': case 'remove_items': case 'set_pantry': return a.items?.length ? null : 'items';
    case 'set_budget': return a.budget ?? a.amount ? null : 'budget';
    case 'create_reminder': return a.text ? null : 'text';
    case 'substitution': return a.items?.length || a.text ? null : 'item';
    case 'log_meal': return a.text ? null : 'meal';
    default: return null;
  }
}
