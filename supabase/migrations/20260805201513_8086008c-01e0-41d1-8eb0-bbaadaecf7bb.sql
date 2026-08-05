-- 1. Name parts on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS middle_name text,
  ADD COLUMN IF NOT EXISTS surname text,
  ADD COLUMN IF NOT EXISTS is_alumni boolean NOT NULL DEFAULT false;

GRANT SELECT (first_name, middle_name, surname, is_alumni) ON public.profiles TO authenticated;

UPDATE public.profiles
SET first_name = COALESCE(first_name, split_part(btrim(full_name), ' ', 1)),
    surname = COALESCE(surname, NULLIF(split_part(btrim(full_name), ' ', greatest(array_length(regexp_split_to_array(btrim(full_name), '\s+'), 1), 1)), ''))
WHERE full_name IS NOT NULL AND btrim(full_name) <> '';

-- 2. Duplicate protection (forward-looking; existing rows untouched)
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
END $$;

REVOKE ALL ON FUNCTION public.prevent_duplicate_profiles() FROM anon, authenticated;

DROP TRIGGER IF EXISTS profiles_prevent_duplicates ON public.profiles;
CREATE TRIGGER profiles_prevent_duplicates
  BEFORE INSERT OR UPDATE OF email, full_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_profiles();

-- 3. Alumni role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'alumni'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'alumni';
  END IF;
END $$;

-- 4. Link alumni register rows to accounts
ALTER TABLE public.alumni
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS alumni_profile_id_unique_idx ON public.alumni (profile_id) WHERE profile_id IS NOT NULL;

DROP POLICY IF EXISTS "Alumni can view own record" ON public.alumni;
CREATE POLICY "Alumni can view own record" ON public.alumni
  FOR SELECT TO authenticated USING (profile_id = auth.uid());
