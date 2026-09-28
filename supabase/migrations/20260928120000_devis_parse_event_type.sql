-- L'import IA de devis (parse-devis) journalise event_type = 'devis_parse',
-- refusé jusqu'ici par la contrainte : l'insert échouait sans bruit et les
-- imports n'étaient jamais décomptés du quota.
alter table ai_usage_events drop constraint if exists ai_usage_events_event_type_check;
alter table ai_usage_events add constraint ai_usage_events_event_type_check
  check (event_type in ('chat_message', 'image_generation', 'image_analysis', 'devis_parse'));
