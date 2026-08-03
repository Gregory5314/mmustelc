CREATE OR REPLACE FUNCTION public.list_chapter_officials()
RETURNS TABLE (
  id uuid,
  role text,
  full_name text,
  course text,
  year int,
  avatar_url text,
  email text,
  phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, ur.role::text, p.full_name, p.course, p.year, p.avatar_url, p.email, p.phone
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE auth.uid() IS NOT NULL
    AND ur.role::text NOT IN ('member', 'admin')
  ORDER BY CASE ur.role::text
    WHEN 'president' THEN 1
    WHEN 'vice_president' THEN 2
    WHEN 'secretary_general' THEN 3
    WHEN 'assistant_secretary' THEN 4
    WHEN 'treasurer' THEN 5
    WHEN 'event_manager' THEN 6
    WHEN 'alumni_manager' THEN 7
    WHEN 'mentorship_coordinator' THEN 8
    WHEN 'welfare_coordinator' THEN 9
    ELSE 10
  END, p.full_name;
$$;

REVOKE ALL ON FUNCTION public.list_chapter_officials() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_chapter_officials() TO authenticated;