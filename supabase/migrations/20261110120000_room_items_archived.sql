-- Archivage des achats : masque une carte des vues de travail (Kanban, listes,
-- « Tous les achats », contexte IA, export PDF) sans la supprimer ni toucher à
-- son statut. Le budget continue de compter les achats archivés Commandé /
-- Acheté (argent sorti) et ignore les autres (idées ou devis abandonnés).
-- À appliquer AVANT de déployer save-room, qui écrit cette colonne.
alter table room_items add column if not exists archived_at timestamptz;
