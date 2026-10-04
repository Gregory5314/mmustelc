import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, CheckCircle2, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/activities")({
  head: () => ({
    meta: [
      { title: "Chapter Activities — MMUST ELP" },
      { name: "description", content: "Upcoming and past chapter activities." },
      { property: "og:title", content: "Chapter Activities — MMUST ELP" },
      { property: "og:description", content: "Upcoming and past MMUST ELP chapter activities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Activities,
});

type Ev = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  location: string | null;
  status: string;
  photo_url: string | null;
};

function Activities() {
  const { user } = useAuth();
  const [items, setItems] = useState<Ev[]>([]);
  const [rsvpCounts, setRsvpCounts] = useState<Record<string, number>>({});
  const [myRsvps, setMyRsvps] = useState<Set<string>>(new Set());
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [eventsResult, rsvpsResult] = await Promise.all([
      supabase
        .from("events")
        .select("id,title,description,starts_at,location,status,photo_url")
        .order("starts_at", { ascending: false }),
      supabase.from("event_rsvps").select("event_id,user_id"),
    ]);

    setItems((eventsResult.data ?? []) as Ev[]);

    const counts: Record<string, number> = {};
    const mine = new Set<string>();
    for (const rsvp of rsvpsResult.data ?? []) {
      counts[rsvp.event_id] = (counts[rsvp.event_id] ?? 0) + 1;
      if (user && rsvp.user_id === user.id) mine.add(rsvp.event_id);
    }
    setRsvpCounts(counts);
    setMyRsvps(mine);
    setLoading(false);
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel("activities-rsvp-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_rsvps" }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const toggleRsvp = async (eventId: string) => {
    if (!user || updatingId) return;
    setUpdatingId(eventId);
    setMessage(null);

    const isGoing = myRsvps.has(eventId);
    const { error } = isGoing
      ? await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", user.id)
      : await supabase.from("event_rsvps").insert({ event_id: eventId, user_id: user.id });

    if (error) {
      setMessage("Your RSVP could not be updated. Please try again.");
    } else {
      setMyRsvps((current) => {
        const next = new Set(current);
        if (isGoing) next.delete(eventId);
        else next.add(eventId);
        return next;
      });
      setRsvpCounts((current) => ({
        ...current,
        [eventId]: Math.max(0, (current[eventId] ?? 0) + (isGoing ? -1 : 1)),
      }));
      setMessage(isGoing ? "Your RSVP was removed." : "You’re going! Your RSVP is confirmed.");
    }
    setUpdatingId(null);
  };

  const now = Date.now();
  const upcoming = items.filter((e) => new Date(e.starts_at).getTime() >= now);
  const past = items.filter((e) => new Date(e.starts_at).getTime() < now);

  return (
    <AppLayout title="Chapter Activities" subtitle="Workshops, mentorship, and outreach.">
      {message && (
        <p role="status" className="mx-4 mt-4 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
          {message}
        </p>
      )}

      {loading ? (
        <p className="px-4 mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="px-4 mt-6 text-sm text-muted-foreground">No activities yet.</p>
      ) : (
        <>
          {upcoming.length > 0 && (
            <Section
              title="Upcoming"
              items={upcoming}
              rsvpCounts={rsvpCounts}
              myRsvps={myRsvps}
              updatingId={updatingId}
              onRsvp={toggleRsvp}
            />
          )}
          {past.length > 0 && <Section title="Past" items={past} rsvpCounts={rsvpCounts} />}
        </>
      )}
    </main>
  );
}

function Section({
  title,
  items,
  rsvpCounts,
  myRsvps,
  updatingId,
  onRsvp,
}: {
  title: string;
  items: Ev[];
  rsvpCounts: Record<string, number>;
  myRsvps?: Set<string>;
  updatingId?: string | null;
  onRsvp?: (eventId: string) => void;
}) {
  return (
    <section className="px-4 mt-5">
      <h2 className="text-sm font-extrabold tracking-wider text-[var(--brand)] mb-2 uppercase">{title}</h2>
      <div className="space-y-3">
        {items.map((a) => (
          <article key={a.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="aspect-[16/9] bg-muted">
              {a.photo_url ? (
                <img src={a.photo_url} alt={a.title} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-brand-foreground font-extrabold text-lg">
                  Upcoming Event
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="text-base font-extrabold text-[var(--brand)]">{a.title}</h3>
              {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                <CalendarDays className="h-4 w-4" /> {new Date(a.starts_at).toLocaleString()}
              </div>
              {a.location && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <MapPin className="h-4 w-4" /> {a.location}
                </div>
              )}
              <div className="mt-4 flex min-h-9 items-center justify-between gap-3 border-t border-border pt-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground" aria-live="polite">
                  <Users className="h-4 w-4 text-primary" />
                  {rsvpCounts[a.id] ?? 0} {(rsvpCounts[a.id] ?? 0) === 1 ? "person" : "people"} going
                </span>
                {onRsvp && myRsvps && (
                  <Button
                    type="button"
                    size="sm"
                    variant={myRsvps.has(a.id) ? "secondary" : "default"}
                    disabled={updatingId === a.id}
                    onClick={() => onRsvp(a.id)}
                    aria-pressed={myRsvps.has(a.id)}
                  >
                    {myRsvps.has(a.id) && <CheckCircle2 />}
                    {updatingId === a.id ? "Updating…" : myRsvps.has(a.id) ? "Going" : "RSVP"}
                  </Button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
