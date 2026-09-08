-- Fluvia.ai operations cockpit — schema and access rules.
--
-- This file is the security boundary. Everything in src/ is cosmetic: the
-- bundle is public, so any check made in the browser can be edited out by
-- whoever downloads it. The policies below run in Postgres, on the server,
-- on every request. See ACCESS.md.
--
-- Run it in Supabase → SQL Editor → New query. Re-running it is safe.
--
-- ONE THING TO CHANGE: put your real address in owner_emails() below.

-- ---------------------------------------------------------------------------
-- Who is an owner
-- ---------------------------------------------------------------------------

-- The allowlist. Add addresses to the array; one row per owner.
-- This is the server's copy — VITE_OWNER_EMAILS is only the browser's, and it
-- decides which buttons render, nothing more. Keep the two in step.
create or replace function public.owner_emails()
returns text[]
language sql
immutable
as $$
  select array[
    'you@example.com'  -- ← change this
  ]::text[]
$$;

-- True when the caller signed in with an allowlisted address.
-- auth.jwt() is the verified token Supabase attaches to the request, so this
-- cannot be spoofed from the client.
create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
  select coalesce(
    lower(nullif(auth.jwt() ->> 'email', '')) = any (
      select lower(unnest(public.owner_emails()))
    ),
    false
  )
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Work items on the twenty-week grid.
--
-- week_index is stored rather than computed from due_date, on purpose: a bar
-- can be dragged on the grid without moving its deadline. weekIndexOf() in
-- src/lib/weeks.js supplies the default at creation; after that the two are
-- allowed to diverge.
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  detail       text,
  workstream   text not null,
  status       text not null default 'todo',
  week_index   integer not null,
  due_date     date,
  effort       numeric,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint tasks_week_index_range check (week_index between 1 and 20),
  constraint tasks_status_valid check (status in ('todo', 'doing', 'blocked', 'done'))
);

-- The milestone rail.
create table if not exists public.milestones (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  detail       text,
  week_index   integer not null,
  target_date  date,
  achieved_at  date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint milestones_week_index_range check (week_index between 1 and 20)
);

-- Sales pipeline.
create table if not exists public.deals (
  id             uuid primary key default gen_random_uuid(),
  client         text not null,
  contact        text,
  stage          text not null default 'lead',
  value_sgd      numeric not null default 0,
  retainer_sgd   numeric not null default 0,
  probability    numeric not null default 0,
  grant_funded   boolean not null default false,
  expected_close date,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint deals_probability_range check (probability between 0 and 1),
  constraint deals_stage_valid check (stage in ('lead', 'qualified', 'proposal', 'won', 'lost'))
);

-- Personal attendance. day_key is a local SGT calendar day, written by ymd()
-- in src/lib/format.js — never toISOString().slice(0,10), which rolls a
-- midnight-SGT date back into the previous UTC day.
create table if not exists public.attendance_logs (
  id          uuid primary key default gen_random_uuid(),
  day_key     date not null unique,
  clock_in    timestamptz,
  clock_out   timestamptz,
  hours       numeric,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tasks_week_index_idx on public.tasks (week_index);
create index if not exists tasks_due_date_idx on public.tasks (due_date);
create index if not exists milestones_week_index_idx on public.milestones (week_index);
create index if not exists deals_stage_idx on public.deals (stage);
create index if not exists attendance_logs_day_key_idx on public.attendance_logs (day_key);

-- Keep updated_at honest without the client having to remember.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['tasks', 'milestones', 'deals', 'attendance_logs'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
         for each row execute function public.touch_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security — the lock
-- ---------------------------------------------------------------------------
--
-- With RLS enabled and no policy matching, Postgres denies. So every access
-- below is opt-in, and anything not listed is refused.
--
-- Read is open to everyone, including signed-out visitors. That is a
-- deliberate choice and it is worth understanding before you share the URL:
-- it exposes client names, deal values and your attendance record to anyone
-- with the link. ACCESS.md lays out the three ways to handle that, including
-- how to close reads down to authenticated users or to redact just deals and
-- attendance. Change these on purpose, not by leaving them alone.

alter table public.tasks           enable row level security;
alter table public.milestones      enable row level security;
alter table public.deals           enable row level security;
alter table public.attendance_logs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tasks', 'milestones', 'deals', 'attendance_logs'] loop
    execute format('drop policy if exists %1$s_read_public on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert_owner on public.%1$s', t);
    execute format('drop policy if exists %1$s_update_owner on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete_owner on public.%1$s', t);

    -- Anyone may read.
    execute format(
      'create policy %1$s_read_public on public.%1$s
         for select using (true)', t);

    -- Only an allowlisted, signed-in owner may write. The with-check clause
    -- on update matters as much as the using clause: without it an owner
    -- could be tricked into writing a row they then could not see.
    execute format(
      'create policy %1$s_insert_owner on public.%1$s
         for insert to authenticated with check (public.is_owner())', t);
    execute format(
      'create policy %1$s_update_owner on public.%1$s
         for update to authenticated using (public.is_owner()) with check (public.is_owner())', t);
    execute format(
      'create policy %1$s_delete_owner on public.%1$s
         for delete to authenticated using (public.is_owner())', t);
  end loop;
end;
$$;

-- Live updates for the dashboard's subscriptions. Reads still go through the
-- select policies above, so this publishes nothing a visitor could not fetch.
do $$
declare t text;
begin
  foreach t in array array['tasks', 'milestones', 'deals', 'attendance_logs'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%1$s', t);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- After running this, verify the lock. Signed out, in a private window, open
-- the browser console on the deployed site and attempt a write against the
-- anon key. It must fail with a row-level security error. Step-by-step in
-- ACCESS.md → "Verify the lock actually holds". Until you have watched that
-- insert be refused, assume the data is open.
-- ---------------------------------------------------------------------------
