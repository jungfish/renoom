-- Persiste la palette générale du projet (dominante/secondaire/sol/accents) — colonne additive, nullable.
alter table projects add column if not exists global_palette jsonb;
