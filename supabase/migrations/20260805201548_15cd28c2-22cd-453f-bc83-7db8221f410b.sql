CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_first text := btrim(coalesce(new.raw_user_meta_data->>'first_name', ''));
  v_middle text := btrim(coalesce(new.raw_user_meta_data->>'middle_name', ''));
  v_surname text := btrim(coalesce(new.raw_user_meta_data->>'surname', ''));
  v_full text;
  v_is_alumni boolean := coalesce((new.raw_user_meta_data->>'is_alumni')::boolean, false);
BEGIN
  v_full := btrim(regexp_replace(
    coalesce(nullif(btrim(concat_ws(' ', nullif(v_first,''), nullif(v_middle,''), nullif(v_surname,''))), ''),
             coalesce(new.raw_user_meta_data->>'full_name', '')),
    '\s+', ' ', 'g'));

  INSERT INTO public.profiles (id, scholar_code, full_name, first_name, middle_name, surname,
                               email, phone, course, mentoring_school, year, is_alumni)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'scholar_code', new.email),
    v_full,
    nullif(v_first, ''), nullif(v_middle, ''), nullif(v_surname, ''),
    coalesce(new.raw_user_meta_data->>'contact_email', new.email),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'course',
    new.raw_user_meta_data->>'mentoring_school',
    nullif(new.raw_user_meta_data->>'year','')::int,
    v_is_alumni
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_is_alumni THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'alumni')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.alumni (full_name, graduation_year, contact, notes, profile_id)
    VALUES (
      v_full,
      nullif(new.raw_user_meta_data->>'graduation_year','')::int,
      coalesce(new.raw_user_meta_data->>'contact_email', new.email),
      nullif(btrim(coalesce(new.raw_user_meta_data->>'course','')), ''),
      new.id
    );
  END IF;

  RETURN new;
END $function$;