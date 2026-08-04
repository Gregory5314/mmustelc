import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { CalendarDays, MapPin, Quote, Award, CheckSquare, Trophy, Heart, Pin } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — MMUST ELP" },
      { name: "description", content: "MMUST ELP chapter dashboard." },
    ],
  }),
  component: Dashboard,
});

type Ev = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  description: string | null;
  status: string;
  photo_url: string | null;
};

type AttendedRow = {
  profile_id: string;
  profiles: { id: string; full_name: string | null; avatar_url: string | null } | null;
};

type AttendanceItem = {
  profile_id: string;
  full_name: string;
  avatar_url: string | null;
  count: number;
};

type Q = { scholar_name: string; quote_text: string; photo_url: string | null };
type R = {
  scholar_name: string;
  recognition_type: string;
  description: string | null;
  photo_url: string | null;
};
type Ment = { id: string; title: string; description: string | null; activity_date: string };

function Dashboard() {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState<string>("");
  const [upcoming, setUpcoming] = useState<Ev[]>([]);
  const [mentorship, setMentorship] = useState<Ment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [totalAttended, setTotalAttended] = useState(0);
  const [quote, setQuote] = useState<Q | null>(null);
  const [recognition, setRecognition] = useState<R | null>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          const name = data?.full_name ?? user.user_metadata?.full_name ?? "Scholar";
          setFirstName(name.trim().split(/\s+/)[0]);
        });
    }
  }, [user]);

  useEffect(() => {
    const load = () => {
      const nowIso = new Date().toISOString();
      const todayIso = new Date().toISOString().slice(0, 10);

      // Pinned upcoming events: not yet started and not completed/cancelled
      supabase
        .from("events")
        .select("id,title,starts_at,location,description,status,photo_url")
        .gte("starts_at", nowIso)
        .not("status", "in", "(completed,cancelled)")
        .order("starts_at", { ascending: true })
        .limit(5)
        .then(({ data }) => setUpcoming((data ?? []) as Ev[]));

      // Pinned mentorship updates: until their date passes
      supabase
        .from("mentorship_activities")
        .select("id,title,description,activity_date")
        .gte("activity_date", todayIso)
        .order("activity_date", { ascending: true })
        .then(({ data }) => setMentorship((data ?? []) as Ment[]));

      supabase
        .from("events_attended")
        .select("profile_id, profiles(id, full_name, avatar_url)")
        .then(({ data }) => {
          const rows = (data ?? []) as unknown as AttendedRow[];
          setTotalAttended(rows.length);
          const map = new Map<string, AttendanceItem>();
          rows.forEach((r) => {
            const key = r.profile_id;
            const existing = map.get(key);
            if (existing) existing.count += 1;
            else
              map.set(key, {
                profile_id: key,
                full_name: r.profiles?.full_name ?? "Unknown member",
                avatar_url: r.profiles?.avatar_url ?? null,
                count: 1,
              });
          });
          setAttendance(
            Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5),
          );
        });

      supabase
        .from("quotes")
        .select("scholar_name,quote_text,photo_url")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setQuote((data as Q | null) ?? null));

      supabase
        .from("scholar_recognition")
        .select("scholar_name,recognition_type,description,photo_url")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setRecognition((data as R | null) ?? null));
    };

    load();

    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "mentorship_activities" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "scholar_recognition" }, load)
      .subscribe();

    // Re-evaluate expiry (unpin past items) periodically
    const timer = window.setInterval(load, 60_000);

    return () => {
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);


  return (
    <AppLayout title="Dashboard" subtitle={firstName ? `Hello, ${firstName}!` : "Welcome back to your chapter."}>
      {/* 2x2 grid summary cards */}
      <section className="px-4 mt-4 grid grid-cols-2 gap-3">
        <SummaryCard
          to="/activities"
          icon={CheckSquare}
          label="Events Attended"
          value={String(totalAttended)}
          sub={`${attendance.length} active members`}
        />
        <SummaryCard
          to="/more"
          icon={Quote}
          label="Quote of the Week"
          value={quote ? quote.scholar_name : "—"}
          sub={quote ? "Tap to read" : "Not set"}
        />
        <SummaryCard
          to="/activities"
          icon={CalendarDays}
          label="Upcoming Events"
          value={String(upcoming.length)}
          sub="Next 5 scheduled"
        />
        <SummaryCard
          to="/more"
          icon={Trophy}
          label="Scholar of the Month"
          value={recognition ? recognition.scholar_name : "—"}
          sub={recognition?.recognition_type ?? "Not set"}
        />
      </section>


      {/* Events Attended */}
      <Section icon={CheckSquare} title="Events Attended">
        {attendance.length === 0 ? (
          <Empty>No attendance records yet.</Empty>
        ) : (
          <div className="space-y-2">
            {attendance.map((m) => (
              <Link
                to="/members"
                hash={m.profile_id}
                key={m.profile_id}
                className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 hover:bg-accent/40 active:scale-[0.99] transition"
              >
                {m.avatar_url ? (
                  <img
                    src={m.avatar_url}
                    alt={m.full_name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-[var(--brand)]/10 text-[var(--brand)] font-bold flex items-center justify-center text-sm">
                    {m.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{m.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {m.count} {m.count === 1 ? "event" : "events"} attended
                  </p>
                </div>
                <span className="text-xl font-extrabold text-[var(--brand-accent)]">{m.count}</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* Quote of the Week */}
      <Section icon={Quote} title="Quote of the Week">
        {!quote ? (
          <Empty>No quote published yet.</Empty>
        ) : (
          <article className="relative bg-card border border-border rounded-2xl shadow-sm overflow-hidden aspect-[4/3]">
            {quote.photo_url ? (
              <img
                src={quote.photo_url}
                alt={quote.scholar_name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] flex items-center justify-center">
                <Quote className="h-16 w-16 text-brand-foreground/40" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
            <div className="absolute inset-0 p-4 flex flex-col justify-end text-white">
              <Quote className="h-5 w-5 mb-1 opacity-80" />
              <p className="text-sm italic leading-snug line-clamp-5 drop-shadow">
                “{quote.quote_text}”
              </p>
              <p className="mt-2 text-xs font-extrabold uppercase tracking-wider drop-shadow">
                — {quote.scholar_name}
              </p>
            </div>
          </article>
        )}
      </Section>

      {/* Upcoming Events */}
      <Section
        icon={CalendarDays}
        title="Upcoming Events"
        action={<Link to="/activities" className="text-xs font-bold text-[var(--brand-accent)]">See all</Link>}
      >
        {upcoming.length === 0 ? (
          <Empty>No upcoming events scheduled.</Empty>
        ) : (
          <div className="space-y-3">
            {upcoming.map((ev) => (
              <Link
                to="/activities"
                hash={ev.id}
                key={ev.id}
                className="block bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md active:scale-[0.995] transition"
              >
                <div className="aspect-[16/9] bg-muted relative">
                  {ev.photo_url ? (
                    <img src={ev.photo_url} alt={ev.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-brand-foreground font-extrabold">
                      Upcoming Event
                    </div>
                  )}
                  <span className="absolute top-2 right-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/90 text-[var(--brand)]">
                    {ev.status}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-sm font-extrabold text-[var(--brand)]">{ev.title}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <CalendarDays className="h-3.5 w-3.5" /> {new Date(ev.starts_at).toLocaleString()}
                  </div>
                  {ev.location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="h-3.5 w-3.5" /> {ev.location}
                    </div>
                  )}
                  {ev.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ev.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* Mentorship Updates (pinned until their date passes) */}
      <Section
        icon={Heart}
        title="Mentorship Updates"
        action={<Link to="/activities" className="text-xs font-bold text-[var(--brand-accent)]">See all</Link>}
      >
        {mentorship.length === 0 ? (
          <Empty>No active mentorship updates.</Empty>
        ) : (
          <div className="space-y-2">
            {mentorship.map((m) => (
              <Link
                to="/activities"
                hash={m.id}
                key={m.id}
                className="block bg-card border border-border rounded-xl p-3 hover:bg-accent/40 active:scale-[0.99] transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[var(--brand)] truncate">{m.title}</p>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-[var(--brand-accent)]">
                    <Pin className="h-3 w-3" /> Pinned
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(m.activity_date).toLocaleDateString()}
                </p>
                {m.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </Section>



      {/* Scholar of the Month */}
      <Section icon={Award} title="Scholar of the Month">
        {!recognition ? (
          <Empty>No scholar recognized yet.</Empty>
        ) : (
          <article className="relative bg-card border border-border rounded-2xl shadow-sm overflow-hidden aspect-[4/3]">
            {recognition.photo_url ? (
              <img
                src={recognition.photo_url}
                alt={recognition.scholar_name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] flex items-center justify-center">
                <Trophy className="h-16 w-16 text-white/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
            <div className="absolute inset-0 p-4 flex flex-col justify-end text-white">
              <p className="text-[10px] uppercase tracking-wider font-bold opacity-90 drop-shadow">
                {recognition.recognition_type}
              </p>
              <p className="text-xl font-extrabold leading-tight drop-shadow line-clamp-2">
                {recognition.scholar_name}
              </p>
              {recognition.description && (
                <p className="text-xs mt-1 opacity-95 drop-shadow line-clamp-3">
                  {recognition.description}
                </p>
              )}
            </div>
          </article>
        )}
      </Section>

      <section className="px-4 mt-6 mb-6">
        <h4 className="text-base font-extrabold text-[var(--brand)] mb-2">Quick Actions</h4>
        <div className="space-y-2">
          <Link to="/profile" className="block bg-card border border-border rounded-xl px-4 py-3 font-semibold text-foreground hover:bg-accent transition-colors">
            View My Profile
          </Link>
          <Link to="/activities" className="block bg-card border border-border rounded-xl px-4 py-3 font-semibold text-foreground hover:bg-accent transition-colors">
            Chapter Activities
          </Link>
          <Link to="/officials" className="block bg-card border border-border rounded-xl px-4 py-3 font-semibold text-foreground hover:bg-accent transition-colors">
            Chapter Officials
          </Link>
        </div>
      </section>
    </AppLayout>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  to,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  to?: string;
}) {
  const body = (
    <>
      <Icon className="h-6 w-6 text-[var(--brand-accent)]" />
      <p className="text-[10px] font-bold tracking-wider text-muted-foreground mt-3 uppercase">{label}</p>
      <p className="text-lg font-extrabold text-[var(--brand)] leading-tight truncate">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </>
  );
  const cls = "bg-card border border-border rounded-2xl p-4 shadow-sm block hover:bg-accent/40 active:scale-[0.98] transition";
  return to ? <Link to={to as any} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}


function Section({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: any;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 mt-6">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-base font-extrabold text-[var(--brand)] flex items-center gap-1.5">
          <Icon className="h-4 w-4" /> {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
