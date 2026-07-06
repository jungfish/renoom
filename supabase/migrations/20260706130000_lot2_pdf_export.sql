-- Lot 2 : export PDF pièce — table de comptage/traçabilité + quota par plan.
-- Idempotent, additif uniquement.

create table if not exists project_exports (
  id uuid primary key default gen_random_uuid(),
  project_id text references projects(id) on delete cascade,
  room_key text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- RLS activée sans policy : accès service role uniquement (Edge Function
-- record-export). Personne ne lit/écrit cette table directement depuis le client.
alter table project_exports enable row level security;

-- Ajoute la dimension de quota "exports PDF / mois" aux 4 plans existants.
update plans set limits = limits || '{"pdf_exports_per_month": 1}'::jsonb where id = 'free';
update plans set limits = limits || '{"pdf_exports_per_month": 20}'::jsonb where id = 'founding_pro';
update plans set limits = limits || '{"pdf_exports_per_month": 40}'::jsonb where id = 'pro';
update plans set limits = limits || '{"pdf_exports_per_month": 100}'::jsonb where id = 'studio';
