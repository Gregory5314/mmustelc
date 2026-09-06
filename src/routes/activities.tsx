import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, MapPin, Check, Users } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export const Route = createFileRoute("/activities")({
  head: () => ({
    meta: [
      { title: "Chapter Activities — MMUST ELP" },
      { name: "description", content: "Upcoming and past chapter activities." },
      { property: "og:title", content: "Chapter Activities — MMUST ELP" },
      { property: "og:description", content: "Workshops, mentorship, and outreach from the MMUST ELP chapter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const loadRsvps = useCallback(async () => {
    const { data } = await supabase.from("event_rsvps").select("event_id,user_id");
    const next: Record<string, number> = {};
    const own = new Set<string>();
    (data ?? []).forEach((r) => {
      next[r.event_id] = (next[r.event_id] ?? 0) + 1;
      if (user && r.user_id === user.id) own.add(r.event_id);
    });
    setCounts(next);
    setMine(own);
  }, [user]);

  useEffect(() => {
    supabase
      .from("events")
      .select("id,title,description,starts_at,location,status,photo_url")
      .order("starts_at", { ascending: false })
      .then(({ data }) => {
        setItems((data ?? []) as Ev[]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    loadRsvps();
    const topic = "event_rsvps_feed";
    supabase.getChannels()
      .filter((c) => c.topic === `realtime:${topic}`)
      .forEach((c) => { supabase.removeChannel(c); });
    const channel = supabase.channel(topic)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_rsvps" }, loadRsvps)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadRsvps]);

  const toggleRsvp = async (eventId: string) => {
    if (!user) return;
    haptic("medium");
    setBusy(eventId);
    const going = mine.has(eventId);
    // optimistic
    setMine((prev) => {
      const n = new Set(prev);
      going ? n.delete(eventId) : n.add(eventId);
      return n;
    });
    setCounts((prev) => ({ ...prev, [eventId]: Math.max(0, (prev[eventId] ?? 0) + (going ? -1 : 1)) }));

    const { error } = going
      ? await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", user.id)
      : await supabase.from("event_rsvps").insert({ event_id: eventId, user_id: user.id });

    if (error) {
      toast.error("Could not update your RSVP. Please try again.");
      await loadRsvps();
    } else {
      toast.success(going ? "You're no longer going." : "You're going!");
    }
    setBusy(null);
  };

  const now = Date.now();
  const upcoming = items.filter((e) => new Date(e.starts_at).getTime() >= now);
  const past = items.filter((e) => new Date(e.starts_at).getTime() < now);

  const sectionProps = { counts, mine, busy, toggleRsvp };

  return (
    <AppLayout title="Chapter Activities" subtitle="Workshops, mentorship, and outreach.">
      {loading ? (
        <p className="px-4 mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="px-4 mt-6 text-sm text-muted-foreground">No activities yet.</p>
      ) : (
        <>
          {upcoming.length > 0 && <Section title="Upcoming" items={upcoming} canRsvp {...sectionProps} />}
          {past.length > 0 && <Section title="Past" items={past} canRsvp={false} {...sectionProps} />}
        </>
      )}
    </AppLayout>
  );
}

function Section({
  title, items, counts, mine, busy, toggleRsvp, canRsvp,
}: {
  title: string;
  items: Ev[];
  counts: Record<string, number>;
  mine: Set<string>;
  busy: string | null;
  toggleRsvp: (id: string) => void;
  canRsvp: boolean;
}) {
  return (
    <section className="px-4 mt-5">
      <h2 className="text-sm font-extrabold tracking-wider text-[var(--brand)] mb-2 uppercase">{title}</h2>
      <div className="space-y-3">
        {items.map((a) => {
          const going = mine.has(a.id);
          const count = counts[a.id] ?? 0;
          return (
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

                <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-border">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Users className="h-4 w-4 text-[var(--brand-accent)]" />
                    {count} Going
                  </span>
                  {canRsvp && (
                    <button
                      onClick={() => toggleRsvp(a.id)}
                      disabled={busy === a.id}
                      aria-pressed={going}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-60 ${
                        going
                          ? "bg-green-500/20 text-green-600 border border-green-500/40"
                          : "gradient-brand text-brand-foreground shadow-sm"
                      }`}
                    >
                      {going ? (
                        <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Going</span>
                      ) : (
                        "RSVP"
                      )}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
