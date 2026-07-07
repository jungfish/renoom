-- Ces 3 tables sont lues via des abonnements postgres_changes côté client
-- (src/App.jsx) mais n'avaient jamais été ajoutées à la publication realtime,
-- donc les events INSERT/UPDATE n'étaient jamais diffusés aux autres membres
-- du projet (reload de page nécessaire pour voir les changements des autres).
alter publication supabase_realtime add table activity_log;
alter publication supabase_realtime add table room_items;
alter publication supabase_realtime add table mention_notifications;
