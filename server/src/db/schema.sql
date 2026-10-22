-- Shared Living: Meals, Groceries & Money. First-cut schema (Developer Brief section 6 + Blueprint entities).
-- Budget limit, contributions, purchases and settlements are separate records. The app records balances; it never moves money.

create extension if not exists pgcrypto;

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'INR',
  country text not null default 'IN',
  timezone text not null default 'Asia/Kolkata',
  language text not null default 'hinglish',          -- en | hinglish | hi | pa
  region text not null default 'north',               -- recipe/price region: north | south | west | east | gujarati | punjabi | bengali ...
  living_type text not null default 'shared_flat',    -- solo | shared_flat | pg_hostel | shared_room | family  (New City Mode)
  monthly_budget numeric(12,2) not null default 0,    -- a plan, not money received
  diet text not null default 'veg',                   -- veg | egg | nonveg | vegan
  allergens text[] not null default '{}',
  cooking_equipment text[] not null default '{stove}',
  cooking_minutes_max int not null default 45,
  new_city_mode boolean not null default true,
  data_sharing jsonb not null default '{"meal_log_summary": false}',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  phone text not null,                                -- E.164 digits, one household per phone
  name text not null,
  role text not null default 'member',                -- admin | member | cook
  language text,                                      -- overrides household language
  consent_at timestamptz,                             -- explicit data-processing consent
  opted_out_at timestamptz,
  last_inbound_at timestamptz,                        -- drives the 24-hour free-reply window
  diet text,
  allergens text[] not null default '{}',
  schedule_prefs jsonb not null default '{}',         -- shifts / class times
  created_at timestamptz not null default now(),
  unique (phone)
);
create index if not exists members_household_idx on members(household_id);

create table if not exists invites (
  code text primary key,
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid references members(id) on delete set null,
  expires_at timestamptz not null,
  used_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists contributions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid not null references members(id) deferrable initially deferred,
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  note text,
  wa_message_id text unique,
  voided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  payer_id uuid not null references members(id) deferrable initially deferred,
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  store text,
  note text,
  paid_from text not null default 'member',           -- member (own pocket) | pool (kitty)
  split_rule jsonb not null default '{"type":"equal"}', -- equal | custom {shares:{memberId:amount}} | percent | members:[ids]
  wa_message_id text unique,
  voided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists purchases_household_date_idx on purchases(household_id, date);

create table if not exists purchase_shares (
  purchase_id uuid not null references purchases(id) on delete cascade,
  member_id uuid not null references members(id) deferrable initially deferred,
  amount numeric(12,2) not null,
  primary key (purchase_id, member_id)
);

create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  item text not null,
  qty numeric(12,3),
  unit text,
  price numeric(12,2)                                  -- line price, feeds the price book
);

create table if not exists price_book (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,  -- null = regional default
  region text,                                          -- set for regional defaults
  country text not null default 'IN',
  item text not null,
  unit text not null,                                   -- kg | l | piece | dozen
  price numeric(12,2) not null,                         -- price per unit
  source text not null default 'default',               -- default | purchase | manual
  updated_at timestamptz not null default now()
);
create unique index if not exists price_book_household_item on price_book(household_id, item, unit) where household_id is not null;
create unique index if not exists price_book_region_item on price_book(region, country, item, unit) where household_id is null;

create table if not exists shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  item text not null,
  qty numeric(12,3),
  unit text,
  status text not null default 'open',                  -- open | bought | removed
  assigned_to uuid references members(id) on delete set null,
  source_meal_id uuid,
  est_price numeric(12,2),
  actual_price numeric(12,2),
  added_by uuid references members(id) on delete set null,
  wa_message_id text,
  created_at timestamptz not null default now(),
  bought_at timestamptz
);
create index if not exists shopping_household_idx on shopping_list_items(household_id, status);

create table if not exists recipes (
  id text primary key,
  name text not null,
  region text not null,
  diet_tags text[] not null,                            -- subset of veg/egg/nonveg/vegan (the strictest diet it satisfies is first)
  allergens text[] not null default '{}',
  ingredients jsonb not null,                           -- [{item, qty, unit}] for base_servings
  base_servings int not null default 2,
  protein_g_per_serving numeric(6,1) not null,
  prep_minutes int not null default 30,
  equipment text[] not null default '{stove}',
  slot text[] not null default '{lunch,dinner}',
  reviewed boolean not null default false               -- expert review flag; unreviewed content shows a disclaimer
);

create table if not exists meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  week_start date not null,
  budget numeric(12,2) not null,
  servings int not null,
  est_total numeric(12,2) not null default 0,
  status text not null default 'draft',                 -- draft | approved
  created_at timestamptz not null default now()
);

create table if not exists planned_meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references meal_plans(id) on delete cascade,
  day date not null,
  slot text not null,                                   -- breakfast | lunch | dinner
  recipe_id text not null references recipes(id),
  servings int not null,
  est_cost numeric(12,2) not null default 0,
  assigned_cook uuid references members(id) on delete set null,
  cooked_at timestamptz,
  rating int,
  swapped boolean not null default false
);

create table if not exists meal_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  meal text not null,
  kind text not null default 'home',                    -- home | ordered | outside
  has_vegetables boolean not null default false,
  has_protein boolean not null default false,
  date date not null,
  shared_with_household boolean not null default false, -- private by default
  wa_message_id text unique,
  created_at timestamptz not null default now()
);

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  text text not null,
  due_at timestamptz not null,
  tz text not null,
  status text not null default 'pending',               -- pending | sent | cancelled
  sent_at timestamptz,
  wa_message_id text unique
);
create index if not exists reminders_due_idx on reminders(status, due_at);

create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  from_member uuid not null references members(id) deferrable initially deferred,
  to_member uuid not null references members(id) deferrable initially deferred,
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  confirmed_at timestamptz,
  wa_message_id text unique,
  voided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  kind text not null default 'chore',                   -- cooking | grocery_run | cleaning | prep | chore
  owner_id uuid references members(id) on delete set null,
  due_at timestamptz,
  recurrence text,                                      -- null | daily | weekly | rotate_weekly
  status text not null default 'open',                  -- open | done
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  item text not null,
  qty numeric(12,3) not null,
  unit text not null,
  best_before date,
  is_leftover boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (household_id, item, unit)
);

create table if not exists conversation_state (
  phone text primary key,
  state jsonb not null,
  expires_at timestamptz not null
);

create table if not exists message_log (
  id uuid primary key default gen_random_uuid(),
  wa_message_id text unique,
  direction text not null,                              -- in | out
  phone text,
  household_id uuid,
  member_id uuid,
  msg_type text,
  body text,
  parsed_json jsonb,
  outcome text,                                         -- received | processed | ignored | error | duplicate
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists ai_calls (
  id uuid primary key default gen_random_uuid(),
  message_log_id uuid,
  kind text not null,                                   -- parse | plan_text | recap | transcribe
  model text,
  prompt_tokens int,
  completion_tokens int,
  cost_usd numeric(10,6),
  latency_ms int,
  parsed_json jsonb,
  outcome text,                                         -- ok | schema_rejected | error
  created_at timestamptz not null default now()
);

create table if not exists outbound_messages (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,
  household_id uuid,
  kind text not null,                                   -- text | template
  payload jsonb not null,
  status text not null default 'queued',                -- queued | sent | failed | blocked_window | blocked_consent
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  wa_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists outbound_queue_idx on outbound_messages(status, next_attempt_at);

create table if not exists login_tokens (
  token_hash text primary key,
  member_id uuid not null references members(id) on delete cascade,
  kind text not null,                                   -- link | session
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists audit_log (
  id bigserial primary key,
  household_id uuid,
  actor_member_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb,
  at timestamptz not null default now()
);

-- Pilot tooling (Target Market PDF: success and stop rules, paid commitments)
create table if not exists pilot_commitments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  kind text not null,                                   -- committed | paid | declined
  price numeric(10,2),
  currency text,
  note text,
  at timestamptz not null default now()
);

alter table households add column if not exists joined_via text not null default 'direct';  -- direct | invite

alter table households add column if not exists last_recap_at timestamptz;
alter table households add column if not exists last_activity_at timestamptz;
