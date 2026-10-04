
-- Resolve the sign-in email for a scholar code or email, so login keeps working
-- even after an admin changes a member's scholar code.
CREATE OR REPLACE FUNCTION public.resolve_login_email(_identifier text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(
    (SELECT u.email::text FROM auth.users u
      WHERE lower(u.email) = lower(btrim(_identifier)) LIMIT 1),
    (SELECT u.email::text FROM auth.users u
      JOIN public.profiles p ON p.id = u.id
      WHERE p.scholar_code = btrim(_identifier) LIMIT 1),
    (SELECT u.email::text FROM auth.users u
      WHERE u.raw_user_meta_data->>'scholar_code' = btrim(_identifier) LIMIT 1)
  );
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

-- Assign a role to a member (president / admins.manage only)
CREATE OR REPLACE FUNCTION public.admin_assign_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'admins.manage') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Remove a role from a member (president / admins.manage only)
CREATE OR REPLACE FUNCTION public.admin_remove_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'admins.manage') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
END;
$$;

-- Update a member's profile (president / admins.manage only).
-- Scholar code changes are safe: login resolves via resolve_login_email().
CREATE OR REPLACE FUNCTION public.admin_update_member_profile(
  _user_id uuid,
  _scholar_code text,
  _full_name text,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _course text DEFAULT NULL,
  _mentoring_school text DEFAULT NULL,
  _year integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'admins.manage') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF btrim(coalesce(_scholar_code, '')) = '' OR btrim(coalesce(_full_name, '')) = '' THEN
    RAISE EXCEPTION 'Scholar code and full name are required';
  END IF;
  UPDATE public.profiles SET
    scholar_code = btrim(_scholar_code),
    full_name = btrim(_full_name),
    email = nullif(btrim(coalesce(_email, '')), ''),
    phone = nullif(btrim(coalesce(_phone, '')), ''),
    course = nullif(btrim(coalesce(_course, '')), ''),
    mentoring_school = nullif(btrim(coalesce(_mentoring_school, '')), ''),
    year = _year
  WHERE id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
END;
$$;

-- Finalize a newly created member: set year, assign role, create subscription row.
-- Called right after sign-up by an authorized officer.
CREATE OR REPLACE FUNCTION public.admin_finalize_member(
  _user_id uuid,
  _role app_role DEFAULT 'member',
  _year integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT public.has_permission(auth.uid(), 'members.add.any')
     AND NOT public.has_permission(auth.uid(), 'members.add.y' || coalesce(_year::text, ''))
     AND NOT public.has_permission(auth.uid(), 'admins.manage') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _role IN ('admin', 'president', 'vice_president')
     AND NOT public.has_permission(auth.uid(), 'admins.manage') THEN
    RAISE EXCEPTION 'Only the president can grant elevated roles';
  END IF;
  IF _year IS NOT NULL THEN
    UPDATE public.profiles SET year = _year WHERE id = _user_id;
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.subscriptions (profile_id, status)
  VALUES (_user_id, 'inactive')
  ON CONFLICT DO NOTHING;
END;
$$;

-- Delete a member (Chapter President only). Removes profile, roles and related rows.
CREATE OR REPLACE FUNCTION public.admin_delete_member(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_name text; v_code text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'president') THEN
    RAISE EXCEPTION 'Only the Chapter President can delete members.';
  END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot delete your own account.'; END IF;
  SELECT full_name, scholar_code INTO v_name, v_code FROM public.profiles WHERE id = _user_id;
  DELETE FROM public.profiles WHERE id = _user_id;
  PERFORM public.notify_users_with_permission(
    'admins.manage', 'member_deleted', 'Member deleted',
    coalesce(v_name, 'A member') || ' (' || coalesce(v_code, '') || ') was removed.',
    '/admin/members'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_member_profile(uuid, text, text, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finalize_member(uuid, app_role, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_member(uuid) TO authenticated;
