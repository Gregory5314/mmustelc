ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mentorship_activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scholar_recognition;
ALTER TABLE public.events REPLICA IDENTITY FULL;
ALTER TABLE public.mentorship_activities REPLICA IDENTITY FULL;
ALTER TABLE public.quotes REPLICA IDENTITY FULL;
ALTER TABLE public.scholar_recognition REPLICA IDENTITY FULL;