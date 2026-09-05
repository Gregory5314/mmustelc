CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('keep_backend_awake');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'keep_backend_awake',
  '7 * * * *',
  $job$
  SELECT net.http_get(
    url := 'https://wjtybwesjqbewxfxfrep.supabase.co/rest/v1/role_permissions?select=id&limit=1',
    headers := jsonb_build_object(
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqdHlid2VzanFiZXd4ZnhmcmVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNDM0NjgsImV4cCI6MjA5NTYxOTQ2OH0.OSCB8daGOMxs7oUp71IotxxF0WjcJyJDUDN4DYO293A'
    )
  );
  $job$
);