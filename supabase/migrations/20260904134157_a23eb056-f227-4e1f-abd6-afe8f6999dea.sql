-- 1) Block duplicate phone numbers (in addition to email + exact names)
CREATE OR REPLACE FUNCTION public.prevent_duplicate_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND btrim(NEW.email) <> ''
     AND EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id <> NEW.id AND lower(btrim(p.email)) = lower(btrim(NEW.email))
     ) THEN
    RAISE EXCEPTION 'An account with this email address already exists';
  END IF;

  IF NEW.phone IS NOT NULL AND regexp_replace(NEW.phone, '\D', '', 'g') <> ''
     AND EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id <> NEW.id
         AND right(regexp_replace(coalesce(p.phone,''), '\D', '', 'g'), 9)
           = right(regexp_replace(NEW.phone, '\D', '', 'g'), 9)
         AND length(regexp_replace(coalesce(p.phone,''), '\D', '', 'g')) >= 9
     ) THEN
    RAISE EXCEPTION 'An account with this mobile number already exists';
  END IF;

  IF btrim(coalesce(NEW.full_name, '')) <> ''
     AND EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id <> NEW.id
         AND lower(regexp_replace(btrim(p.full_name), '\s+', ' ', 'g'))
           = lower(regexp_replace(btrim(NEW.full_name), '\s+', ' ', 'g'))
     ) THEN
    RAISE EXCEPTION 'A member with these exact names already exists';
  END IF;

  RETURN NEW;
END
$$;

-- 2) Security questions storage
CREATE TABLE IF NOT EXISTS public.security_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  answer_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_key)
);

GRANT SELECT, INSERT, DELETE ON public.security_answers TO authenticated;
GRANT ALL ON public.security_answers TO service_role;
ALTER TABLE public.security_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own security answers" ON public.security_answers;
CREATE POLICY "own security answers" ON public.security_answers
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3) Pre-signup availability check (case/format insensitive)
CREATE OR REPLACE FUNCTION public.is_signup_identity_available(_email text, _phone text)
RETURNS TABLE(email_taken boolean, phone_taken boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.profiles p WHERE lower(btrim(p.email)) = lower(btrim(coalesce(_email,'')))
            AND btrim(coalesce(_email,'')) <> ''),
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE length(regexp_replace(coalesce(p.phone,''), '\D', '', 'g')) >= 9
              AND length(regexp_replace(coalesce(_phone,''), '\D', '', 'g')) >= 9
              AND right(regexp_replace(coalesce(p.phone,''), '\D', '', 'g'), 9)
                = right(regexp_replace(coalesce(_phone,''), '\D', '', 'g'), 9));
$$;

REVOKE ALL ON FUNCTION public.is_signup_identity_available(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_signup_identity_available(text, text) TO anon, authenticated;

-- 4) Save the two security answers picked at signup (from auth metadata)
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
  INSERT INTO public.security_answers (user_id, question_key, answer_hash)
  VALUES
    (auth.uid(), _q1, encode(extensions.digest(lower(btrim(_a1)), 'sha256'), 'hex')),
    (auth.uid(), _q2, encode(extensions.digest(lower(btrim(_a2)), 'sha256'), 'hex'));
END
$$;

REVOKE ALL ON FUNCTION public.save_security_answers(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_security_answers(text, text, text, text) TO authenticated;
