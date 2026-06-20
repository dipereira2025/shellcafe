-- SHELL CAFÉ PONTO V2
-- Execute no Supabase SQL Editor

create extension if not exists "pgcrypto";

create type user_role as enum ('admin', 'employee');
create type punch_type as enum ('entrada', 'saida_intervalo', 'volta_intervalo', 'saida');

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  name text not null,
  role user_role not null default 'employee',
  shift text,
  position text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists time_punches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type punch_type not null,
  punched_at timestamptz not null default now(),
  latitude numeric not null,
  longitude numeric not null,
  distance_meters numeric,
  selfie_path text,
  note text,
  device_info text,
  created_at timestamptz not null default now()
);

create table if not exists punch_adjustments (
  id uuid primary key default gen_random_uuid(),
  punch_id uuid references time_punches(id) on delete cascade,
  requested_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reason text not null,
  old_type text,
  new_type text,
  old_punched_at timestamptz,
  new_punched_at timestamptz,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table time_punches enable row level security;
alter table punch_adjustments enable row level security;
alter table audit_logs enable row level security;

-- Helper: verifica se usuário atual é admin
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
    and active = true
  );
$$;

-- PROFILES
drop policy if exists "profiles_select_own_or_admin" on profiles;
drop policy if exists "profiles_insert_admin" on profiles;
drop policy if exists "profiles_update_admin" on profiles;

create policy "profiles_select_own_or_admin"
on profiles for select
using (id = auth.uid() or is_admin());

create policy "profiles_insert_admin"
on profiles for insert
with check (is_admin());

create policy "profiles_update_admin"
on profiles for update
using (is_admin())
with check (is_admin());

-- TIME PUNCHES
drop policy if exists "time_punches_select_own_or_admin" on time_punches;
drop policy if exists "time_punches_insert_own" on time_punches;
drop policy if exists "time_punches_update_admin" on time_punches;
drop policy if exists "time_punches_delete_admin" on time_punches;

create policy "time_punches_select_own_or_admin"
on time_punches for select
using (user_id = auth.uid() or is_admin());

create policy "time_punches_insert_own"
on time_punches for insert
with check (user_id = auth.uid());

create policy "time_punches_update_admin"
on time_punches for update
using (is_admin())
with check (is_admin());

create policy "time_punches_delete_admin"
on time_punches for delete
using (is_admin());

-- ADJUSTMENTS
drop policy if exists "adjustments_select_own_or_admin" on punch_adjustments;
drop policy if exists "adjustments_insert_own" on punch_adjustments;
drop policy if exists "adjustments_update_admin" on punch_adjustments;

create policy "adjustments_select_own_or_admin"
on punch_adjustments for select
using (requested_by = auth.uid() or is_admin());

create policy "adjustments_insert_own"
on punch_adjustments for insert
with check (requested_by = auth.uid());

create policy "adjustments_update_admin"
on punch_adjustments for update
using (is_admin())
with check (is_admin());

-- AUDIT
drop policy if exists "audit_select_admin" on audit_logs;
drop policy if exists "audit_insert_authenticated" on audit_logs;

create policy "audit_select_admin"
on audit_logs for select
using (is_admin());

create policy "audit_insert_authenticated"
on audit_logs for insert
with check (actor_id = auth.uid());

-- Storage policies para bucket ponto-selfies
-- Crie o bucket ponto-selfies como private antes.
drop policy if exists "selfies_read_own_or_admin" on storage.objects;
drop policy if exists "selfies_insert_own" on storage.objects;

create policy "selfies_read_own_or_admin"
on storage.objects for select
using (
  bucket_id = 'ponto-selfies'
  and (
    is_admin()
    or owner = auth.uid()
  )
);

create policy "selfies_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'ponto-selfies'
  and owner = auth.uid()
);

-- View útil para relatório admin
create or replace view v_time_punches_report as
select
  tp.id,
  tp.user_id,
  p.name,
  p.email,
  p.shift,
  p.position,
  tp.type,
  tp.punched_at,
  tp.latitude,
  tp.longitude,
  tp.distance_meters,
  tp.selfie_path,
  tp.note,
  tp.device_info,
  tp.created_at
from time_punches tp
join profiles p on p.id = tp.user_id;
