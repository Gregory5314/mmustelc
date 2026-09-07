import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, MapPin } from "lucide-react";

export const Route = createFileRoute("/activities")({
  head: () => ({
    meta: [
      { title: "Chapter Activities — MMUST ELP" },
      { name: "description", content: "Upcoming and past chapter activities." },
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
  const [items, setItems] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Public read — only non-sensitive columns
    supabase
      .from("events")
      .select("id,title,description,starts_at,location,status,photo_url")
      .order("starts_at", { ascending: false })
      .then(({ data }) => {
        setItems((data ?? []) as Ev[]);
        setLoading(false);
      });
  }, []);

  const now = Date.now();
  const upcoming = items.filter((e) => new Date(e.starts_at).getTime() >= now);
  const past = items.filter((e) => new Date(e.starts_at).getTime() < now);

  return (
    <main className="min-h-screen bg-background">
      <header className="px-4 pt-6 pb-4 bg-[var(--brand)] text-brand-foreground">
        <h1 className="text-2xl font-extrabold">Chapter Activities</h1>
        <p className="text-sm opacity-90">Workshops, mentorship, and outreach.</p>
      </header>

      {loading ? (
        <p className="px-4 mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="px-4 mt-6 text-sm text-muted-foreground">No activities yet.</p>
      ) : (
        <>
          {upcoming.length > 0 && <Section title="Upcoming" items={upcoming} />}
          {past.length > 0 && <Section title="Past" items={past} />}
        </>
      )}
    </main>
  );
}

function Section({ title, items }: { title: string; items: Ev[] }) {
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
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
