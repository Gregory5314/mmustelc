ALTER TABLE public.chapter_profile
  ADD COLUMN IF NOT EXISTS mission text,
  ADD COLUMN IF NOT EXISTS vision text;

CREATE TABLE IF NOT EXISTS public.chapter_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  bg_kind text NOT NULL DEFAULT 'solid',
  bg_image_url text,
  bg_color text DEFAULT '#0f3460',
  gradient_from text DEFAULT '#c81e3a',
  gradient_to text DEFAULT '#1e40af',
  text_color text DEFAULT '#ffffff',
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_sections TO authenticated;
GRANT ALL ON public.chapter_sections TO service_role;

ALTER TABLE public.chapter_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view active chapter sections"
ON public.chapter_sections FOR SELECT TO authenticated
USING (is_active OR public.has_permission(auth.uid(), 'profile.chapter.edit'));

CREATE POLICY "Chapter editors can insert chapter sections"
ON public.chapter_sections FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'profile.chapter.edit'));

CREATE POLICY "Chapter editors can update chapter sections"
ON public.chapter_sections FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'profile.chapter.edit'))
WITH CHECK (public.has_permission(auth.uid(), 'profile.chapter.edit'));

CREATE POLICY "Chapter editors can delete chapter sections"
ON public.chapter_sections FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'profile.chapter.edit'));

CREATE TRIGGER chapter_sections_set_updated_at
BEFORE UPDATE ON public.chapter_sections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.get_chapter_public()
RETURNS TABLE(name text, motto text, mission text, vision text, about text, logo_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT cp.name, cp.motto, cp.mission, cp.vision, cp.about, cp.logo_url
  FROM public.chapter_profile cp
  WHERE auth.uid() IS NOT NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_chapter_public() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chapter_public() TO authenticated;

DROP FUNCTION IF EXISTS public.get_chapter_branding();

CREATE FUNCTION public.get_chapter_branding()
RETURNS TABLE(name text, logo_url text, login_bg_url text, motto text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT cp.name, cp.logo_url, cp.login_bg_url, cp.motto
  FROM public.chapter_profile cp
  LIMIT 1;
$$;