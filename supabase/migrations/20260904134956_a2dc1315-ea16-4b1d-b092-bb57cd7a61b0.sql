CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

ALTER TABLE public.security_answers ADD COLUMN IF NOT EXISTS answer_norm text;

CREATE OR REPLACE FUNCTION public.normalize_security_answer(_a text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(regexp_replace(regexp_replace(lower(coalesce(_a,'')), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.save_security_answers(
  _q1 text, _a1 text, _q2 text, _a2 text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _q1 = _q2 THEN RAISE EXCEPTION 'Pick two different questions'; END IF;
  IF btrim(coalesce(_a1,'')) = '' OR btrim(coalesce(_a2,'')) = '' THEN
    RAISE EXCEPTION 'Both answers are required';
  END IF;

  DELETE FROM public.security_answers WHERE user_id = auth.uid();
  INSERT INTO public.security_answers (user_id, question_key, answer_hash, answer_norm)
  VALUES
    (auth.uid(), _q1, encode(extensions.digest(lower(btrim(_a1)), 'sha256'), 'hex'), public.normalize_security_answer(_a1)),
    (auth.uid(), _q2, encode(extensions.digest(lower(btrim(_a2)), 'sha256'), 'hex'), public.normalize_security_answer(_a2));
END
$$;

REVOKE ALL ON FUNCTION public.save_security_answers(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_security_answers(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_security_questions_for_email(_email text)
RETURNS TABLE(question_key text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sa.question_key
  FROM public.security_answers sa
  JOIN public.profiles p ON p.id = sa.user_id
  WHERE btrim(coalesce(_email,'')) <> ''
    AND lower(btrim(coalesce(p.email,''))) = lower(btrim(_email))
  ORDER BY sa.created_at;
$$;

REVOKE ALL ON FUNCTION public.get_security_questions_for_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_security_questions_for_email(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_security_answers(_email text, _answers jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user uuid;
  v_total int := 0;
  r record;
  v_given text;
  v_stored text;
BEGIN
  SELECT p.id INTO v_user
  FROM public.profiles p
  WHERE btrim(coalesce(_email,'')) <> ''
    AND lower(btrim(coalesce(p.email,''))) = lower(btrim(_email))
  LIMIT 1;

  IF v_user IS NULL THEN RETURN NULL; END IF;

  FOR r IN SELECT question_key, answer_norm FROM public.security_answers WHERE user_id = v_user LOOP
    v_total := v_total + 1;
    v_given := public.normalize_security_answer(_answers ->> r.question_key);
    v_stored := coalesce(r.answer_norm, '');
    IF v_given = '' OR v_stored = '' THEN RETURN NULL; END IF;
    IF v_given <> v_stored AND extensions.similarity(v_given, v_stored) < 0.85 THEN
      RETURN NULL;
    END IF;
  END LOOP;

  IF v_total = 0 THEN RETURN NULL; END IF;
  RETURN v_user;
END
$$;

REVOKE ALL ON FUNCTION public.verify_security_answers(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_security_answers(text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.normalize_security_answer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_security_answer(text) TO service_role;