CREATE TABLE public.event_rsvps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.event_rsvps TO authenticated;
GRANT ALL ON public.event_rsvps TO service_role;

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view rsvps" ON public.event_rsvps
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members can rsvp for themselves" ON public.event_rsvps
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can remove their rsvp" ON public.event_rsvps
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.event_rsvps REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rsvps;