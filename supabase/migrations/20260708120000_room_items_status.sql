-- Statut détaillé du cycle d'achat pour les items "shopping" (Kanban/Budget).
-- Remplace la lecture des 2 booléens `done`/`selected_for_purchase` comme
-- source de vérité, sans les supprimer (encore lus par l'export PDF, le
-- "Budget global" de TodosGlobalView, et l'outil IA du chat).
alter table room_items add column if not exists status text;

alter table room_items drop constraint if exists room_items_status_check;
alter table room_items add constraint room_items_status_check
  check (status is null or status in (
    'envie', 'devis_demande', 'devis_fait', 'echantillon_commande',
    'selectionne', 'commande', 'achete'
  ));

-- Backfill des lignes existantes à partir des 2 booléens actuels.
update room_items set status = case
  when done then 'achete'
  when selected_for_purchase then 'selectionne'
  else 'envie'
end
where status is null;

alter table room_items alter column status set default 'envie';
