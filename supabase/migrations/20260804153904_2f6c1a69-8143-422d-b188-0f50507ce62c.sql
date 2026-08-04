-- Remove blanket column access so scholar_code can never be selected directly
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;

GRANT SELECT (
  id, full_name, email, phone, course, mentoring_school,
  avatar_url, created_at, updated_at, year, email_opt_in
) ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;

-- Secure listing for member management (scholar codes only for admins.manage holders)
CREATE OR REPLACE FUNCTION public.list_members_manage()
RETURNS TABLE(id uuid, full_name text, scholar_code text, course text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'admins.manage') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.scholar_code, p.course
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_members_manage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_members_manage() TO authenticated;
