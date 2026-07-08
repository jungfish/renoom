-- Objectif budgétaire par projet (vue Budget) — colonne additive, nullable.
alter table projects add column if not exists budget_target numeric;

alter table projects drop constraint if exists projects_budget_target_check;
alter table projects add constraint projects_budget_target_check
  check (budget_target is null or budget_target >= 0);
