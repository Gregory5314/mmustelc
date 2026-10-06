ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS submitted_by uuid;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_chk CHECK (status IN ('pending','published'));

INSERT INTO public.role_permissions (role, permission) VALUES ('president'::app_role, 'quotes.review') ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "anyone read quotes" ON public.quotes;
CREATE POLICY "read published quotes" ON public.quotes FOR SELECT USING (status = 'published');
CREATE POLICY "read own submitted quotes" ON public.quotes FOR SELECT TO authenticated USING (submitted_by = auth.uid());
CREATE POLICY "reviewers read all quotes" ON public.quotes FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'quotes.manage') OR public.has_permission(auth.uid(), 'quotes.review'));
CREATE POLICY "members submit quotes" ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND status = 'pending' AND is_active = false);
CREATE POLICY "president review quotes" ON public.quotes FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'quotes.review'));
CREATE POLICY "president delete quotes" ON public.quotes FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'quotes.review'));

CREATE OR REPLACE FUNCTION public.guard_quote_publish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'published'
     AND NOT public.has_permission(auth.uid(), 'quotes.review') THEN
    RAISE EXCEPTION 'Only the Chapter President can publish submitted quotes';
  END IF;
  IF NEW.status = 'published' AND OLD.status = 'pending' AND NEW.submitted_by IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (NEW.submitted_by, 'quote', 'Your quote was published', left(NEW.quote_text, 120), '/');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quotes_guard_publish BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.guard_quote_publish();

CREATE OR REPLACE FUNCTION public.on_quote_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM public.notify_users_with_permission('quotes.review', 'quote', 'New quote submitted for review',
      NEW.scholar_name || ': ' || left(NEW.quote_text, 100), '/admin/quotes');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quotes_on_submit AFTER INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.on_quote_submitted();

CREATE POLICY "member quote photo upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'quote-submissions'
  AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "reviewer quote photo upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'quotes'
  AND public.has_permission(auth.uid(), 'quotes.review'));