-- AVQIX cloud storage v1 — free-plan friendly; apply only to a Supabase project
-- whose Free plan and billing configuration have been verified by the owner.
-- No cron, AI API, paid extensions, storage buckets or outbound requests.
-- All app tables are private and scoped to auth.uid() via RLS.
create table if not exists public.avqix_clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 2 and 60),
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  business_model text not null check (business_model in ('ecommerce','services','hybrid','b2b')),
  google_ads_id text,
  meta_ads_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id,slug)
);
create index if not exists avqix_clients_owner_idx on public.avqix_clients(owner_id);

create table if not exists public.avqix_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id uuid not null references public.avqix_clients(id) on delete cascade,
  business_goal text not null default '',
  marketing_goal text not null default '',
  kpis jsonb not null default '[]'::jsonb check(jsonb_typeof(kpis)='array'),
  updated_at timestamptz not null default now(),
  unique(owner_id,client_id)
);
create index if not exists avqix_goals_owner_idx on public.avqix_goals(owner_id);

create table if not exists public.avqix_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id uuid not null references public.avqix_clients(id) on delete cascade,
  source_key text not null,
  title text not null,
  action text not null default '',
  source text not null default '',
  recipient text not null default '',
  impact text not null default '',
  priority text not null check(priority in ('Vysoká','Střední','Nízká')),
  assignee text not null default '',
  status text not null default 'todo' check(status in ('todo','doing','done')),
  created_at timestamptz not null default now(),
  unique(owner_id,client_id,source_key)
);
create index if not exists avqix_tasks_owner_idx on public.avqix_tasks(owner_id);

alter table public.avqix_clients enable row level security;
alter table public.avqix_goals enable row level security;
alter table public.avqix_tasks enable row level security;

-- Only the authenticated owner may read, create, edit or delete rows.
-- Goals/tasks also require the referenced client to belong to that user.
drop policy if exists avqix_clients_owner on public.avqix_clients;
create policy avqix_clients_owner on public.avqix_clients
  for all to authenticated using(owner_id=auth.uid())
  with check(owner_id=auth.uid());

drop policy if exists avqix_goals_owner on public.avqix_goals;
create policy avqix_goals_owner on public.avqix_goals
  for all to authenticated using(owner_id=auth.uid())
  with check(owner_id=auth.uid() and exists(
    select 1 from public.avqix_clients c where c.id=client_id and c.owner_id=auth.uid()
  ));

drop policy if exists avqix_tasks_owner on public.avqix_tasks;
create policy avqix_tasks_owner on public.avqix_tasks
  for all to authenticated using(owner_id=auth.uid())
  with check(owner_id=auth.uid() and exists(
    select 1 from public.avqix_clients c where c.id=client_id and c.owner_id=auth.uid()
  ));

-- Never expose service_role keys in browser. Supabase anon/publishable key
-- is usable only with Auth and RLS. Review policies before production.
