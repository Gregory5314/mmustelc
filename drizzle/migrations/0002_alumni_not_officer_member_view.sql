CREATE OR REPLACE FUNCTION public.get_member_admin_view(_user_id uuid)
 RETURNS TABLE(id uuid, full_name text, course text, year integer, avatar_url text, email text, phone text, mentoring_school text, scholar_code text, created_at timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE is_officer boolean; can_see_code boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role NOT IN ('member','alumni')) INTO is_officer;
  IF NOT is_officer THEN RAISE EXCEPTION 'Only chapter officials can view member profiles'; END IF;
  can_see_code := public.has_role(auth.uid(), 'president') OR public.has_role(auth.uid(), 'vice_president')
    OR public.has_role(auth.uid(), 'admin') OR auth.uid() = _user_id;
  RETURN QUERY
  SELECT p.id, p.full_name, p.course, p.year, p.avatar_url, p.email, p.phone, p.mentoring_school,
         CASE WHEN can_see_code THEN p.scholar_code ELSE NULL END, p.created_at
  FROM public.profiles p WHERE p.id = _user_id;
END;
$function$;