ALTER TABLE public.chapter_profile ADD COLUMN IF NOT EXISTS login_bg_url text;

CREATE OR REPLACE FUNCTION public.get_chapter_branding()
RETURNS TABLE (name text, logo_url text, login_bg_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.name, cp.logo_url, cp.login_bg_url
  FROM public.chapter_profile cp
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_chapter_branding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chapter_branding() TO anon, authenticated;