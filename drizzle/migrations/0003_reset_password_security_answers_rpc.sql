CREATE OR REPLACE FUNCTION public.reset_password_with_security_answers(_email text, _answers jsonb, _password text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_user uuid;
BEGIN
  IF length(coalesce(_password,'')) < 8 OR length(_password) > 72 THEN
    RAISE EXCEPTION 'Password must be 8-72 characters';
  END IF;
  v_user := public.verify_security_answers(_email, _answers);
  IF v_user IS NULL THEN RETURN false; END IF;
  UPDATE auth.users
     SET encrypted_password = extensions.crypt(_password, extensions.gen_salt('bf')),
         updated_at = now()
   WHERE id = v_user;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reset_password_with_security_answers(text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_password_with_security_answers(text, jsonb, text) TO anon, authenticated;