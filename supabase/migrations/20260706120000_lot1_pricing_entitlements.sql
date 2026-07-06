-- Lot 1 : bases pricing/entitlements (plans, profiles), archivage de projets,
-- distinction des event_type sur ai_usage_events (chat/image_generation/image_analysis).
-- Toutes les étapes sont idempotentes (rejouables sans erreur).

-- 1. Catalogue des plans -----------------------------------------------------
create table if not exists plans (
  id text primary key,                 -- 'free' | 'founding_pro' | 'pro' | 'studio'
  name text not null,
  price_monthly_cents int,
  price_yearly_cents int,
  is_purchasable boolean not null default true,
  limits jsonb not null,
  created_at timestamptz not null default now()
);

alter table plans enable row level security;

drop policy if exists "plans_select_all" on plans;
create policy "plans_select_all" on plans
  for select
  to anon, authenticated
  using (true);

insert into plans (id, name, price_monthly_cents, price_yearly_cents, is_purchasable, limits) values
  ('free', 'Gratuit', 0, null, true,
    '{"max_active_projects":1,"ai_messages_per_day":5,"ai_images_per_month":3,"max_members_per_project":2}'),
  ('founding_pro', 'Founding Pro', 4900, 49000, true,
    '{"max_active_projects":5,"ai_messages_per_day":60,"ai_images_per_month":30,"max_members_per_project":5}'),
  ('pro', 'Pro', 7900, null, false,
    '{"max_active_projects":10,"ai_messages_per_day":100,"ai_images_per_month":60,"max_members_per_project":8}'),
  ('studio', 'Studio', 14900, null, false,
    '{"max_active_projects":25,"ai_messages_per_day":200,"ai_images_per_month":150,"max_members_per_project":15}')
on conflict (id) do update set
  name = excluded.name,
  price_monthly_cents = excluded.price_monthly_cents,
  price_yearly_cents = excluded.price_yearly_cents,
  is_purchasable = excluded.is_purchasable,
  limits = excluded.limits;

-- 2. Profil d'abonnement par compte -----------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null references plans(id) default 'free',
  plan_status text not null default 'active'
    check (plan_status in ('active', 'canceled')),
  plan_activated_at timestamptz,
  plan_activated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Pas de policy insert/update pour authenticated : toute écriture passe par
-- une Edge Function en service role (admin-set-plan), pour empêcher un
-- utilisateur de s'auto-attribuer un plan.

-- Backfill : tous les comptes existants démarrent en 'free'.
insert into profiles (id, plan_id)
select id, 'free'
from auth.users
on conflict (id) do nothing;

-- 3. Archivage des projets ---------------------------------------------------
alter table projects add column if not exists status text not null default 'active';

alter table projects drop constraint if exists projects_status_check;
alter table projects add constraint projects_status_check
  check (status in ('active', 'archived'));

-- 4. Type d'événement IA (chat / génération image / analyse image) ----------
alter table ai_usage_events add column if not exists event_type text not null default 'chat_message';

alter table ai_usage_events drop constraint if exists ai_usage_events_event_type_check;
alter table ai_usage_events add constraint ai_usage_events_event_type_check
  check (event_type in ('chat_message', 'image_generation', 'image_analysis'));
