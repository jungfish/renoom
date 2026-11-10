-- Quantité des achats (décimale : 12,5 m² de carrelage, 3 L de peinture…).
-- `price` reste le prix unitaire ; les totaux valent price × quantity.
-- NULL = 1 : les lignes existantes ne changent pas de montant.
alter table room_items add column if not exists quantity numeric;

alter table room_items drop constraint if exists room_items_quantity_check;
alter table room_items add constraint room_items_quantity_check
  check (quantity is null or quantity > 0);
