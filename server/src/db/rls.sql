-- Row-level security: a second wall behind the application's household scoping.
-- Application code runs tenant work as role sl_app with app.household_id set; Postgres then only shows and accepts that household's rows.
-- Unset household = no rows (fail closed). The connection's own role (owner/superuser) bypasses RLS: it is used only for trusted
-- cross-household system paths (login by phone, onboarding, outbox, scheduled jobs, pilot admin).

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'sl_app') then create role sl_app nologin; end if;
end $$;
-- let a non-superuser connection user switch to sl_app
do $$ begin
  if not exists (select 1 from pg_auth_members m join pg_roles r on r.oid = m.roleid join pg_roles u on u.oid = m.member where r.rolname = 'sl_app' and u.rolname = current_user)
     and not (select rolsuper from pg_roles where rolname = current_user) then
    execute format('grant sl_app to %I', current_user);
  end if;
end $$;

grant usage on schema public to sl_app;
grant select, insert, update, delete on all tables in schema public to sl_app;
grant usage, select on all sequences in schema public to sl_app;
alter default privileges in schema public grant select, insert, update, delete on tables to sl_app;
alter default privileges in schema public grant usage, select on sequences to sl_app;

create or replace function app_hh() returns uuid language sql stable as
  $$ select nullif(current_setting('app.household_id', true), '')::uuid $$;

-- tables with a household_id column: rows visible/writable only for the current household
do $$
declare t text;
begin
  foreach t in array array['audit_log','contributions','invites','meal_feedback','meal_logs','meal_plans','members','message_log',
                           'outbound_messages','pantry_items','pilot_commitments','purchases','reminders','settlements','shopping_list_items','tasks']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format('create policy tenant_isolation on %I for all to sl_app using (household_id = app_hh()) with check (household_id = app_hh())', t);
  end loop;
end $$;

alter table households enable row level security;
drop policy if exists tenant_isolation on households;
create policy tenant_isolation on households for all to sl_app using (id = app_hh()) with check (id = app_hh());

-- price_book: everyone may read the regional defaults (household_id null); only the household's own rows are writable
alter table price_book enable row level security;
drop policy if exists tenant_read on price_book; drop policy if exists tenant_write on price_book;
create policy tenant_read on price_book for select to sl_app using (household_id is null or household_id = app_hh());
create policy tenant_write on price_book for all to sl_app using (household_id = app_hh()) with check (household_id = app_hh());

-- child tables without their own household_id: through the parent (the parent lookup is itself row-secured)
alter table purchase_shares enable row level security;
drop policy if exists tenant_isolation on purchase_shares;
create policy tenant_isolation on purchase_shares for all to sl_app
  using (exists (select 1 from purchases p where p.id = purchase_id)) with check (exists (select 1 from purchases p where p.id = purchase_id));
alter table purchase_items enable row level security;
drop policy if exists tenant_isolation on purchase_items;
create policy tenant_isolation on purchase_items for all to sl_app
  using (exists (select 1 from purchases p where p.id = purchase_id)) with check (exists (select 1 from purchases p where p.id = purchase_id));
alter table planned_meals enable row level security;
drop policy if exists tenant_isolation on planned_meals;
create policy tenant_isolation on planned_meals for all to sl_app
  using (exists (select 1 from meal_plans mp where mp.id = plan_id)) with check (exists (select 1 from meal_plans mp where mp.id = plan_id));

-- not row-secured on purpose: recipes (shared reference data), conversation_state (keyed by phone, onboarding),
-- login_tokens (only hashes), ai_calls (no household data beyond model JSON). Reviewed in test/rls.test.ts.
