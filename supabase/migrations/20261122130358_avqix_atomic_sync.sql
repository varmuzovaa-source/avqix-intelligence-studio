-- Atomic, owner-scoped workspace saves with optimistic concurrency.
-- These narrow RPCs intentionally own writes; no caller-supplied owner or dynamic SQL.
-- Both require auth.uid(), filter every row by that owner, pin search_path, and
-- revoke PUBLIC/anon execution. Direct API mutations are revoked to enforce CAS.
create table public.avqix_sync_state (
  owner_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  revision bigint not null default 0 check (revision >= 0)
);
alter table public.avqix_sync_state enable row level security;
create policy avqix_sync_owner on public.avqix_sync_state for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke all on public.avqix_sync_state from anon;
grant select on public.avqix_sync_state to authenticated;
-- Force all writes through the atomic RPC: old browser tabs cannot bypass revisions.
revoke insert, update, delete on public.avqix_clients, public.avqix_goals, public.avqix_tasks from authenticated;
create index if not exists avqix_goals_client_idx on public.avqix_goals(client_id);
create index if not exists avqix_tasks_client_idx on public.avqix_tasks(client_id);

create or replace function public.avqix_read_workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); rev bigint; result jsonb;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  insert into public.avqix_sync_state(owner_id) values(uid) on conflict do nothing;
  select revision into rev from public.avqix_sync_state where owner_id=uid for share;
  select jsonb_build_object('revision',rev,'snapshot',jsonb_build_object(
    'version',1,'savedAt',now(),
    'clients',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'name',c.name,'slug',c.slug,'model',c.business_model,'googleId',c.google_ads_id,'metaId',c.meta_ads_id
    )) order by c.created_at,c.slug) from public.avqix_clients c where c.owner_id=uid),'[]'::jsonb),
    'goals',coalesce((select jsonb_object_agg(c.name,jsonb_build_object('business',g.business_goal,
      'marketing',g.marketing_goal,'kpis',g.kpis,'updatedAt',g.updated_at))
      from public.avqix_goals g join public.avqix_clients c on c.id=g.client_id
      where g.owner_id=uid and c.owner_id=uid),'{}'::jsonb),
    'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'clientName',c.name,
      'sourceKey',t.source_key,'title',t.title,'action',t.action,'source',t.source,
      'recipient',t.recipient,'impact',t.impact,'priority',t.priority,'owner',t.assignee,
      'status',t.status,'createdAt',t.created_at) order by t.created_at desc,t.id)
      from public.avqix_tasks t join public.avqix_clients c on c.id=t.client_id
      where t.owner_id=uid and c.owner_id=uid),'[]'::jsonb)
  )) into result;
  return result;
end $$;

create or replace function public.avqix_save_workspace(p_snapshot jsonb,p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); rev bigint; c jsonb; g jsonb; t jsonb; cid uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_snapshot->>'version' is distinct from '1'
    or jsonb_typeof(p_snapshot->'clients') is distinct from 'array'
    or jsonb_typeof(p_snapshot->'goals') is distinct from 'object'
    or jsonb_typeof(p_snapshot->'tasks') is distinct from 'array' then
    raise exception 'INVALID_SNAPSHOT';
  end if;
  if jsonb_array_length(p_snapshot->'clients')>500 or jsonb_array_length(p_snapshot->'tasks')>10000 then
    raise exception 'SNAPSHOT_TOO_LARGE';
  end if;
  if (select count(distinct x->>'slug') from jsonb_array_elements(p_snapshot->'clients') x)
    <> jsonb_array_length(p_snapshot->'clients')
    or (select count(distinct x->>'name') from jsonb_array_elements(p_snapshot->'clients') x)
    <> jsonb_array_length(p_snapshot->'clients') then raise exception 'DUPLICATE_CLIENT'; end if;
  if exists(select 1 from jsonb_array_elements(p_snapshot->'tasks') x
    where not exists(select 1 from jsonb_array_elements(p_snapshot->'clients') y where y->>'name'=x->>'clientName'))
    then raise exception 'TASK_CLIENT_REQUIRED'; end if;
  if (select count(*) from (select distinct x->>'clientName',x->>'sourceKey' from jsonb_array_elements(p_snapshot->'tasks') x) d)
    <> jsonb_array_length(p_snapshot->'tasks') then raise exception 'DUPLICATE_TASK'; end if;
  insert into public.avqix_sync_state(owner_id) values(uid) on conflict do nothing;
  select revision into rev from public.avqix_sync_state where owner_id=uid for update;
  if p_expected_revision is null or rev<>p_expected_revision then
    raise exception 'WORKSPACE_CONFLICT' using errcode='40001';
  end if;
  -- All subsequent writes either commit together or roll back together.
  for c in select value from jsonb_array_elements(p_snapshot->'clients') loop
    insert into public.avqix_clients(owner_id,name,slug,business_model,google_ads_id,meta_ads_id)
    values(uid,c->>'name',c->>'slug',c->>'model',c->>'googleId',c->>'metaId')
    on conflict(owner_id,slug) do update set name=excluded.name,business_model=excluded.business_model,
      google_ads_id=excluded.google_ads_id,meta_ads_id=excluded.meta_ads_id,updated_at=now()
    returning id into cid;
    g := p_snapshot->'goals'->(c->>'name');
    if g is not null then
      insert into public.avqix_goals(owner_id,client_id,business_goal,marketing_goal,kpis)
      values(uid,cid,g->>'business',g->>'marketing',g->'kpis')
      on conflict(owner_id,client_id) do update set business_goal=excluded.business_goal,
        marketing_goal=excluded.marketing_goal,kpis=excluded.kpis,updated_at=now();
    else delete from public.avqix_goals where owner_id=uid and client_id=cid;
    end if;
    for t in select value from jsonb_array_elements(p_snapshot->'tasks') where value->>'clientName'=c->>'name' loop
      insert into public.avqix_tasks(owner_id,client_id,source_key,title,action,source,recipient,impact,priority,assignee,status,created_at)
      values(uid,cid,t->>'sourceKey',t->>'title',t->>'action',t->>'source',t->>'recipient',t->>'impact',
        t->>'priority',t->>'owner',t->>'status',(t->>'createdAt')::timestamptz)
      on conflict(owner_id,client_id,source_key) do update set title=excluded.title,action=excluded.action,
        source=excluded.source,recipient=excluded.recipient,impact=excluded.impact,priority=excluded.priority,
        assignee=excluded.assignee,status=excluded.status;
    end loop;
    delete from public.avqix_tasks old where old.owner_id=uid and old.client_id=cid
      and not exists(select 1 from jsonb_array_elements(p_snapshot->'tasks') x
        where x->>'clientName'=c->>'name' and x->>'sourceKey'=old.source_key);
  end loop;
  delete from public.avqix_clients old where old.owner_id=uid
    and not exists(select 1 from jsonb_array_elements(p_snapshot->'clients') x where x->>'slug'=old.slug);
  update public.avqix_sync_state set revision=rev+1 where owner_id=uid;
  return rev+1;
end $$;
revoke all on function public.avqix_read_workspace() from public, anon;
revoke all on function public.avqix_save_workspace(jsonb,bigint) from public, anon;
grant execute on function public.avqix_read_workspace() to authenticated;
grant execute on function public.avqix_save_workspace(jsonb,bigint) to authenticated;
