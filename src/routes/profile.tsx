import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ChevronRight, CalendarDays, Pencil, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — MMUST ELP" },
      { name: "description", content: "Member profile and personal information." },
    ],
  }),
  component: ProfilePage,
});

type Profile = {
  id: string;
  scholar_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  course: string | null;
  mentoring_school: string | null;
  avatar_url: string | null;
};

type EventRow = { id: string; title: string; event_date: string };

function ProfilePage() {
  const location = useLocation();
  const { user } = useAuth();
  const [p, setP] = useState<Profile | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("get_my_profile").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      setP((row ?? null) as Profile | null);
    });
    supabase
      .from("events_attended")
      .select("id, title, event_date")
      .eq("profile_id", user.id)
      .order("event_date", { ascending: false })
      .then(({ data }) => setEvents((data ?? []) as EventRow[]));
  }, [user?.id]);

  if (location.pathname !== "/profile") return <Outlet />;

  if (!p) {
    return (
      <AppLayout title="Member Profile">
        <p className="text-sm text-muted-foreground text-center py-10 px-4">Loading profile…</p>
      </AppLayout>
    );
  }

  const personal = [
    { label: "SCHOLAR CODE", value: p.scholar_code },
    { label: "COURSE", value: p.course || "—" },
    { label: "PHONE NUMBER", value: p.phone || "—" },
    { label: "EMAIL ADDRESS", value: p.email || "—" },
    { label: "MENTORING SCHOOL", value: p.mentoring_school || "—" },
  ];

  return (
    <AppLayout title="Member Profile" subtitle="Your chapter details.">
      <section className="px-4 mt-4">
        <div className="bg-card rounded-2xl shadow-sm border border-border p-4 flex gap-4 items-center">
          {p.avatar_url ? (
            <img src={p.avatar_url} alt={p.full_name} width={96} height={96}
                 className="h-24 w-24 rounded-xl object-cover" />
          ) : (
            <div className="h-24 w-24 rounded-xl bg-[var(--brand)] text-brand-foreground flex items-center justify-center">
              <UserIcon className="h-10 w-10" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-extrabold text-[var(--brand)] leading-tight truncate">{p.full_name || "Unnamed Member"}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{p.scholar_code}</p>
            <Link to="/profile/edit" className="mt-3 inline-flex items-center gap-1.5 bg-[var(--brand)] text-brand-foreground text-sm font-semibold px-4 py-2 rounded-lg shadow hover:bg-[var(--brand-deep)] transition-colors">
              <Pencil className="h-4 w-4" /> Edit Profile <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-base font-extrabold text-[var(--brand)]">Personal Information</h4>
          <Link to="/profile/edit" className="text-xs font-bold text-[var(--brand-accent)]">Edit</Link>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {personal.map((f) => (
            <div key={f.label} className="bg-card border border-border rounded-lg px-3 py-2.5">
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground">{f.label}</p>
              <p className="text-sm font-bold text-foreground leading-snug mt-0.5 break-words">{f.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 mt-6">
        <h4 className="text-base font-extrabold text-[var(--brand)] mb-2">Chapter Events Attended</h4>
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground px-3 py-4">No events recorded yet.</p>
          )}
          {events.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-3 py-3">
              <CalendarDays className="h-5 w-5 text-[var(--brand-accent)] shrink-0" />
              <p className="flex-1 text-sm font-semibold text-foreground truncate">{e.title}</p>
              <p className="text-xs text-muted-foreground whitespace-nowrap">{new Date(e.event_date).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
