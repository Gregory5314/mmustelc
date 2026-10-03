# Project Architecture Rules

- Event RSVPs use the RLS-protected `event_rsvps` table and one shared Realtime subscription on the activities page, so counts stay authoritative and subscriptions are cleaned up.