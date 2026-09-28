create extension if not exists pgcrypto;
create table if not exists public.clients(id uuid primary key default gen_random_uuid(),name text not null unique,slug text unique,active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,username text not null unique,full_name text not null,role text not null check(role in('admin','strategist','copywriter','designer')),active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.team_client_assignments(id uuid primary key default gen_random_uuid(),profile_id uuid not null references public.profiles(id) on delete cascade,client_id uuid not null references public.clients(id) on delete cascade,can_view boolean not null default true,can_edit boolean not null default true,created_at timestamptz not null default now(),unique(profile_id,client_id));
create table if not exists public.content_items(id uuid primary key default gen_random_uuid(),client_id uuid not null references public.clients(id) on delete cascade,title text not null,platform text not null check(platform in('Instagram','TikTok','Facebook','YouTube','LinkedIn','Threads')),content_date date not null,content_time time,due_date date,status text not null default 'Draft' check(status in('Draft','In Progress','Review Design','Revisi','Disetujui','Siap Posting','Posted')),approval text not null default 'Pending' check(approval in('Pending','Approved','Revision Requested','Not Required')),pic_id uuid references public.profiles(id) on delete set null,pillar text,goal text,content_type text,format text,caption_copy text,canva_design_url text,drive_url text,published_url text,work_label text not null default 'Not Evaluated' check(work_label in('Work','Not Work','Not Evaluated')),learning_reason text,created_by uuid references public.profiles(id) on delete set null,updated_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.performance_metrics(id uuid primary key default gen_random_uuid(),content_id uuid not null unique references public.content_items(id) on delete cascade,views bigint not null default 0 check(views>=0),reach bigint not null default 0 check(reach>=0),likes bigint not null default 0 check(likes>=0),comments bigint not null default 0 check(comments>=0),shares bigint not null default 0 check(shares>=0),saves bigint not null default 0 check(saves>=0),clicks bigint not null default 0 check(clicks>=0),leads bigint not null default 0 check(leads>=0),updated_at timestamptz not null default now());
create table if not exists public.tasks(id uuid primary key default gen_random_uuid(),content_id uuid not null references public.content_items(id) on delete cascade,division text not null check(division in('strategist','copywriter','designer')),assigned_to uuid references public.profiles(id) on delete set null,status text not null default 'Not Started' check(status in('Not Started','In Progress','Review','Done','Blocked')),due_date date,priority text not null default 'Normal' check(priority in('Low','Normal','High','Urgent')),note text,fee_amount numeric(12,2) not null default 0 check(fee_amount>=0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(content_id,division));
create table if not exists public.activity_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles(id) on delete set null,action text not null,entity_type text,entity_id uuid,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists clients_updated_at on public.clients; create trigger clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
drop trigger if exists profiles_updated_at on public.profiles; create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists content_updated_at on public.content_items; create trigger content_updated_at before update on public.content_items for each row execute function public.set_updated_at();
drop trigger if exists performance_updated_at on public.performance_metrics; create trigger performance_updated_at before update on public.performance_metrics for each row execute function public.set_updated_at();
drop trigger if exists tasks_updated_at on public.tasks; create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $ begin insert into public.profiles(id,username,full_name,role) values(new.id,coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)),coalesce(new.raw_user_meta_data->>'full_name',new.email),'copywriter') on conflict(id) do update set username=excluded.username,full_name=excluded.full_name; return new; end; $;
drop trigger if exists on_auth_user_created on auth.users; create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create or replace function public.app_role() returns text language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() and active=true limit 1 $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select public.app_role()='admin' $$;
create or replace function public.is_manager() returns boolean language sql stable security definer set search_path=public as $$ select public.app_role() in('admin','strategist') $$;
create or replace function public.can_view_client(p_client_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select public.is_manager() or exists(select 1 from public.team_client_assignments a where a.profile_id=auth.uid() and a.client_id=p_client_id and a.can_view=true) $$;
create or replace function public.can_edit_client(p_client_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select public.is_manager() or exists(select 1 from public.team_client_assignments a where a.profile_id=auth.uid() and a.client_id=p_client_id and a.can_edit=true) $$;
alter table public.clients enable row level security; alter table public.profiles enable row level security; alter table public.team_client_assignments enable row level security; alter table public.content_items enable row level security; alter table public.performance_metrics enable row level security; alter table public.tasks enable row level security; alter table public.activity_logs enable row level security;
drop policy if exists clients_select on public.clients;drop policy if exists clients_insert on public.clients;drop policy if exists clients_update on public.clients;drop policy if exists clients_delete on public.clients;
create policy clients_select on public.clients for select to authenticated using(public.can_view_client(id));create policy clients_insert on public.clients for insert to authenticated with check(public.is_manager());create policy clients_update on public.clients for update to authenticated using(public.is_manager()) with check(public.is_manager());create policy clients_delete on public.clients for delete to authenticated using(public.is_admin());
drop policy if exists profiles_select on public.profiles;drop policy if exists profiles_update on public.profiles;create policy profiles_select on public.profiles for select to authenticated using(true);create policy profiles_update on public.profiles for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists assignment_select on public.team_client_assignments;drop policy if exists assignment_write on public.team_client_assignments;create policy assignment_select on public.team_client_assignments for select to authenticated using(profile_id=auth.uid() or public.is_admin());create policy assignment_write on public.team_client_assignments for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists content_select on public.content_items;drop policy if exists content_insert on public.content_items;drop policy if exists content_update on public.content_items;drop policy if exists content_delete on public.content_items;create policy content_select on public.content_items for select to authenticated using(public.can_view_client(client_id));create policy content_insert on public.content_items for insert to authenticated with check(public.can_edit_client(client_id));create policy content_update on public.content_items for update to authenticated using(public.can_edit_client(client_id)) with check(public.can_edit_client(client_id));create policy content_delete on public.content_items for delete to authenticated using(public.is_manager());
drop policy if exists perf_select on public.performance_metrics;drop policy if exists perf_write on public.performance_metrics;create policy perf_select on public.performance_metrics for select to authenticated using(exists(select 1 from public.content_items c where c.id=content_id and public.can_view_client(c.client_id)));create policy perf_write on public.performance_metrics for all to authenticated using(public.is_manager()) with check(public.is_manager());
drop policy if exists task_select on public.tasks;drop policy if exists task_insert on public.tasks;drop policy if exists task_update on public.tasks;create policy task_select on public.tasks for select to authenticated using(public.is_manager() or assigned_to=auth.uid() or exists(select 1 from public.content_items c where c.id=content_id and public.can_view_client(c.client_id)));create policy task_insert on public.tasks for insert to authenticated with check(public.is_manager() or(assigned_to=auth.uid() and division=public.app_role()));create policy task_update on public.tasks for update to authenticated using(public.is_manager() or(assigned_to=auth.uid() and division=public.app_role())) with check(public.is_manager() or(assigned_to=auth.uid() and division=public.app_role()));
drop policy if exists activity_select on public.activity_logs;drop policy if exists activity_insert on public.activity_logs;create policy activity_select on public.activity_logs for select to authenticated using(true);create policy activity_insert on public.activity_logs for insert to authenticated with check(actor_id=auth.uid());
insert into public.clients(name,slug) values('Indo Pride','indo-pride'),('Meranti','meranti'),('Young Generation','young-generation'),('Dewana','dewana'),('Hubbun','hubbun'),('Aflah Apparel','aflah-apparel'),('Teman Wisata','teman-wisata'),('Warung Sateku','warung-sateku') on conflict(name) do nothing;

create index if not exists idx_content_client_date on public.content_items(client_id,content_date);
create index if not exists idx_content_pic on public.content_items(pic_id);
create index if not exists idx_tasks_assigned_status on public.tasks(assigned_to,status,due_date);
create index if not exists idx_tasks_content_division on public.tasks(content_id,division);
create index if not exists idx_activity_created_at on public.activity_logs(created_at desc);

drop policy if exists task_select on public.tasks;
create policy task_select on public.tasks for select to authenticated
using (public.is_manager() or assigned_to=auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using(public.is_admin())
with check(public.is_admin());


-- Public sign-up should be disabled in Supabase Auth because this is an internal-only workspace.
-- Admin-created users are provisioned by the protected Edge Function, then their profile role is set server-side.


create or replace function public.guard_task_fee() returns trigger language plpgsql security definer set search_path=public, pg_temp as $$ begin if public.app_role() not in('admin','strategist') then if tg_op='UPDATE' then new.fee_amount:=old.fee_amount; else new.fee_amount:=0; end if; end if; return new; end; $$;
drop trigger if exists tasks_guard_fee on public.tasks; create trigger tasks_guard_fee before insert or update on public.tasks for each row execute function public.guard_task_fee();
create index if not exists idx_tasks_fee_due on public.tasks(fee_amount,due_date,assigned_to,status);

create or replace function public.sync_task_client_access()
returns trigger language plpgsql security definer set search_path=public, pg_temp as $$
declare cid uuid;
begin
  if new.assigned_to is null or new.content_id is null then return new; end if;
  select client_id into cid from public.content_items where id=new.content_id;
  if cid is not null then
    insert into public.team_client_assignments(profile_id,client_id,can_view,can_edit)
    values(new.assigned_to,cid,true,true)
    on conflict(profile_id,client_id) do update set can_view=true,can_edit=true;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_sync_client_access on public.tasks;
create trigger tasks_sync_client_access after insert or update of assigned_to,content_id on public.tasks
for each row execute function public.sync_task_client_access();

create or replace function public.can_view_client(p_client_id uuid)
returns boolean language sql stable security definer set search_path=public, pg_temp as $$
  select public.is_manager()
  or exists(select 1 from public.team_client_assignments a where a.profile_id=auth.uid() and a.client_id=p_client_id and a.can_view=true)
  or exists(select 1 from public.content_items c join public.tasks t on t.content_id=c.id where c.client_id=p_client_id and t.assigned_to=auth.uid());
$$;

insert into public.team_client_assignments(profile_id,client_id,can_view,can_edit)
select distinct t.assigned_to,c.client_id,true,true
from public.tasks t join public.content_items c on c.id=t.content_id
where t.assigned_to is not null
on conflict(profile_id,client_id) do update set can_view=true,can_edit=true;
