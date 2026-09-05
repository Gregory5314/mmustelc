import { useState, type ReactNode, useEffect, useRef } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  Menu, X, Home, User, CheckSquare, BookOpen, Users, Shield,
  AlertTriangle, Link2, Bell, MoreHorizontal, UserPlus, LogOut,
  Calendar, FileText, DollarSign, GraduationCap, Heart, Settings,
  Quote, Award, Image as ImageIcon, RefreshCw,
} from "lucide-react";
import defaultLogo from "@/assets/elp-logo.png";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { IdleTimeout } from "@/components/IdleTimeout";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";


type MenuItem = { icon: any; label: string; to: string; perm?: string | string[] };

const memberMenu: MenuItem[] = [
  { icon: Home, label: "Dashboard", to: "/" },
  { icon: User, label: "My Profile", to: "/profile" },
  { icon: Shield, label: "Chapter Profile", to: "/chapter-profile" },
  { icon: CheckSquare, label: "Chapter Activities", to: "/activities" },

  { icon: BookOpen, label: "MMUST ELC Constitution", to: "/constitution" },
  { icon: Users, label: "Members List", to: "/members" },
  { icon: Shield, label: "Chapter Officials", to: "/officials" },
  { icon: ImageIcon, label: "Photo Gallery", to: "/gallery" },
  { icon: AlertTriangle, label: "Report Complaint/Problem", to: "/complaint" },
];

const adminMenu: MenuItem[] = [
  { icon: UserPlus, label: "Manage Members", to: "/admin/members", perm: ["admins.manage", "members.add.any", "members.add.y1", "members.add.y2", "members.add.y3", "members.add.y4"] },
  { icon: Calendar, label: "Manage Events", to: "/admin/events", perm: "events.update" },
  { icon: Quote, label: "Quote of the Week", to: "/admin/quotes", perm: "quotes.manage" },
  { icon: Award, label: "Scholar Recognition", to: "/admin/recognition", perm: "recognition.manage" },
  { icon: DollarSign, label: "Financial Reports", to: "/admin/finance", perm: "finance.upload" },
  { icon: FileText, label: "Meeting Reports", to: "/admin/meetings", perm: "meetings.upload" },
  { icon: CheckSquare, label: "Subscriptions", to: "/admin/subscriptions", perm: "subscriptions.update" },
  { icon: GraduationCap, label: "Alumni", to: "/admin/alumni", perm: "alumni.manage" },
  { icon: Heart, label: "Mentorship", to: "/admin/mentorship", perm: "mentorship.update" },
  { icon: AlertTriangle, label: "Complaints", to: "/admin/complaints", perm: "complaints.view" },
  { icon: Settings, label: "Chapter Profile", to: "/admin/chapter", perm: "profile.chapter.edit" },
];

const bottomNav = [
  { icon: Home, label: "Dashboard", to: "/" as const },
  { icon: Link2, label: "Links", to: "/links" as const },
  { icon: Bell, label: "Notify", to: "/notifications" as const, badge: true },
  { icon: MoreHorizontal, label: "More", to: "/more" as const },
];

export function AppLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();
  const { has, hasAny } = usePermissions();
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [chapterLogo, setChapterLogo] = useState<string | null>(null);
  const [chapterName, setChapterName] = useState<string>("MMUST ELP");
  const [subscriptionStatus, setSubscriptionStatus] = useState<"active" | "inactive">("inactive");

  // Pull-to-refresh
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const THRESHOLD = 70;

  const onTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0 && !refreshing) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = null;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) setPullY(Math.min(dy * 0.5, 100));
  };
  const onTouchEnd = async () => {
    if (touchStartY.current == null) return;
    touchStartY.current = null;
    if (pullY >= THRESHOLD) {
      setRefreshing(true);
      setPullY(50);
      try {
        await router.invalidate();
      } finally {
        setTimeout(() => { setRefreshing(false); setPullY(0); }, 400);
      }
    } else {
      setPullY(0);
    }
  };

  const pathname = router.state.location.pathname;


  useEffect(() => {
    if (!isLoading && !user) navigate({ to: "/login", replace: true });
  }, [user, isLoading, navigate]);



  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id", { count: "exact", head: true })
      .then(({ count }) => setMemberCount(count ?? 0));

    supabase.from("chapter_profile").select("name,logo_url").limit(1).maybeSingle()
      .then(({ data }) => {
        if (data?.logo_url) setChapterLogo(data.logo_url);
        if (data?.name) setChapterName(data.name);
      });

    supabase.from("subscriptions").select("status").eq("profile_id", user.id).maybeSingle()
      .then(({ data }) => setSubscriptionStatus(data?.status === "active" ? "active" : "inactive"));


    const loadUnread = () => {
      supabase.from("notifications").select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id).is("read_at", null)
        .then(({ count }) => setUnreadCount(count ?? 0));
    };
    loadUnread();

    const topic = `notifications:${user.id}`;
    supabase.getChannels()
      .filter((c) => c.topic === `realtime:${topic}`)
      .forEach((c) => { supabase.removeChannel(c); });
    const channel = supabase.channel(topic, { config: { private: true } })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        loadUnread)
      .subscribe();
    const subTopic = `subscriptions:${user.id}`;
    supabase.getChannels()
      .filter((c) => c.topic === `realtime:${subTopic}`)
      .forEach((c) => { supabase.removeChannel(c); });
    const subChannel = supabase.channel(subTopic, { config: { private: true } })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `profile_id=eq.${user.id}` },
        (payload) => {
          const status = (payload.new as { status?: string } | null)?.status;
          setSubscriptionStatus(status === "active" ? "active" : "inactive");
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); supabase.removeChannel(subChannel); };
  }, [user]);

  const visibleAdminMenu = adminMenu.filter((m) => {
    if (!m.perm) return true;
    const perms = Array.isArray(m.perm) ? m.perm : [m.perm];
    return hasAny(perms);
  });

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background pb-24"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ transform: pullY ? `translateY(${pullY}px)` : undefined, transition: touchStartY.current ? "none" : "transform 200ms ease" }}
    >
      {(pullY > 0 || refreshing) && (
        <div
          className="fixed top-2 left-1/2 -translate-x-1/2 z-40 bg-card border border-border rounded-full shadow-md px-3 py-1.5 flex items-center gap-2 text-xs font-semibold text-[var(--brand)]"
          style={{ opacity: Math.min(pullY / THRESHOLD, 1) }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} style={{ transform: refreshing ? undefined : `rotate(${pullY * 3}deg)` }} />
          {refreshing ? "Refreshing…" : pullY >= THRESHOLD ? "Release to refresh" : "Pull to refresh"}
        </div>
      )}
      <header className="gradient-brand gradient-animate text-brand-foreground px-4 pt-3 pb-4 rounded-b-2xl shadow-md animate-page-in">
        <Link to="/" className="flex items-center gap-3 -m-1 p-1 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors" aria-label="Go to dashboard">
          <img src={chapterLogo ?? defaultLogo} alt={`${chapterName} crest`} width={48} height={48}
               className="h-12 w-12 rounded-full bg-white p-0.5 object-contain animate-pop-in" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold leading-tight tracking-tight truncate">{chapterName}</h1>
            <p className="text-xs opacity-90">Equity Leaders Program</p>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <User className="h-4 w-4" />
            <span>{memberCount ?? "—"} Members</span>
          </div>
        </Link>
      </header>


      <div className="sticky top-0 z-30 px-4 pt-4 pb-2 bg-background/85 backdrop-blur-md">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5">
          <button onClick={() => { haptic("medium"); setMenuOpen(true); }} aria-label="Open menu"
            className="justify-self-start p-1.5 -ml-1.5 rounded-md hover:bg-accent active:scale-90 shrink-0">
            <Menu className="h-6 w-6 text-foreground" />
          </button>
          <h2 className="min-w-0 text-center text-2xl font-extrabold gradient-text animate-pop-in whitespace-nowrap">{title}</h2>
          <button
            onClick={async () => {
              haptic("light");
              const { data } = await supabase.from("subscriptions").select("status").eq("profile_id", user.id).maybeSingle();
              const status = data?.status === "active" ? "active" : "inactive";
              setSubscriptionStatus(status);
              if (status === "active") {
                toast.success("Your subscription status is active");
              } else {
                toast.error("Your subscription status is inactive. Please pay to activate.");
              }
            }}
            aria-label={`Subscription status: ${subscriptionStatus}`}
            className={`justify-self-end shrink-0 px-2 py-1 rounded-lg text-[10px] leading-none font-bold transition-all active:scale-95 ${
              subscriptionStatus === "active"
                ? "bg-green-500/20 text-green-600 shadow-[0_0_10px_rgba(34,197,94,0.5)] border border-green-500/40"
                : "bg-red-900/30 text-red-400 border border-red-500/30 opacity-80"
            }`}
          >
            {subscriptionStatus === "active" ? "Active" : "Inactive"}
          </button>
        </div>
        {subtitle && <p className="text-center text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>


      <main key={pathname} className="route-transition">{children}</main>

      {menuOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 animate-in fade-in" onClick={() => setMenuOpen(false)} />
          <aside className="fixed top-0 left-0 bottom-0 w-72 gradient-brand-deep gradient-animate text-brand-foreground z-50 p-2 rounded-r-2xl shadow-2xl animate-in slide-in-from-left overflow-y-auto">
            <nav className="mt-2">
              {memberMenu.map(({ icon: Icon, label, to }) => (
                <button key={label} onClick={() => { setMenuOpen(false); navigate({ to: to as string }); }}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-white/10 text-left">
                  <Icon className="h-5 w-5" />
                  <span className="font-bold text-sm">{label}</span>
                </button>
              ))}
              {visibleAdminMenu.length > 0 && (
                <>
                  <div className="border-t border-white/15 my-2" />
                  <p className="px-4 py-1 text-[10px] font-bold tracking-wider opacity-70">ADMIN TOOLS</p>
                  {visibleAdminMenu.map(({ icon: Icon, label, to }) => (
                    <button key={label} onClick={() => { setMenuOpen(false); navigate({ to: to as string }); }}
                      className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-white/10 text-left">
                      <Icon className="h-5 w-5" />
                      <span className="font-bold text-sm">{label}</span>
                    </button>
                  ))}
                </>
              )}
              <div className="border-t border-white/15 my-2" />
              <button onClick={async () => { await signOut(); setMenuOpen(false); navigate({ to: "/login" }); }}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-white/10 text-left">
                <LogOut className="h-5 w-5" />
                <span className="font-bold text-sm">Sign Out</span>
              </button>
              <button onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-white/10">
                <X className="h-5 w-5" />
                <span className="font-bold text-sm">Close</span>
              </button>
            </nav>
          </aside>
        </>
      )}

      <nav className="fixed bottom-0 inset-x-0 bg-card border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.04)] z-30">
        <div className="grid grid-cols-4 max-w-md mx-auto">
          {bottomNav.map(({ icon: Icon, label, to, badge }) => (
            <Link key={label} to={to} activeOptions={{ exact: true }}
              className="flex flex-col items-center justify-center py-2.5 gap-1 group">
              {({ isActive }) => (
                <>
                  <div className={`relative transition-transform duration-200 ${isActive ? "scale-110" : ""}`}>
                    <Icon className={`h-6 w-6 ${isActive ? "text-[var(--brand-accent)]" : "text-[var(--brand)]"}`} />
                    {badge && unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[var(--brand-accent)] text-white text-[10px] font-bold flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-semibold ${isActive ? "text-[var(--brand-accent)]" : "text-foreground"}`}>{label}</span>
                </>
              )}
            </Link>
          ))}
        </div>
      </nav>

      <IdleTimeout />
    </div>

  );
}

// Reusable permission gate for whole pages
export function PermissionGate({
  perm, title, children,
}: { perm: string | string[]; title: string; children: ReactNode }) {
  const { hasAny, isLoading } = usePermissions();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (isLoading) {
    return <AppLayout title={title}><p className="text-sm text-muted-foreground text-center py-10">Checking permissions…</p></AppLayout>;
  }
  if (!hasAny(perms)) {
    return <AppLayout title={title}><p className="text-sm text-destructive text-center py-10 px-4 font-semibold">You don't have permission to view this page.</p></AppLayout>;
  }
  return <AppLayout title={title}>{children}</AppLayout>;
}
