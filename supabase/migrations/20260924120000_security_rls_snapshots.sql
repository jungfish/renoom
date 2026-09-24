-- Corrige les alertes du Security Advisor Supabase.

-- 1. room_items_snapshots était exposée sans RLS (lecture/écriture/suppression par anon).
-- Accès uniquement via service_role (Edge Functions) et cron postgres : aucune policy nécessaire.
alter table public.room_items_snapshots enable row level security;
revoke all on public.room_items_snapshots from anon, authenticated;

-- 2. Fonctions SECURITY DEFINER appelables via /rest/v1/rpc sans authentification.
revoke execute on function public.build_project_state(text) from public, anon, authenticated;
revoke execute on function public.save_snapshot(text, uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public.nightly_auto_snapshot() from public, anon, authenticated;
grant execute on function public.save_snapshot(text, uuid, jsonb, text) to service_role;

-- 3. search_path figé (lint function_search_path_mutable).
alter function public.build_project_state(text) set search_path = public;
alter function public.save_snapshot(text, uuid, jsonb, text) set search_path = public;
alter function public.nightly_auto_snapshot() set search_path = public;
alter function public.update_discussion_on_message() set search_path = public;
