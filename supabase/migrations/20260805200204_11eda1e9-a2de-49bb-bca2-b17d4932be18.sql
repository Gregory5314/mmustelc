CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.expire_pinned_items()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.events
  SET status = 'completed'
  WHERE starts_at < now()
    AND status NOT IN ('completed', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.expire_pinned_items() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pinned_items() TO service_role;