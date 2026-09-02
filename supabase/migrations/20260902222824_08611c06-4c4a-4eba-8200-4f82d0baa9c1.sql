ALTER TABLE public.meeting_reports
  ADD COLUMN IF NOT EXISTS attendees text,
  ADD COLUMN IF NOT EXISTS agenda text,
  ADD COLUMN IF NOT EXISTS deliberations text,
  ADD COLUMN IF NOT EXISTS aob text;