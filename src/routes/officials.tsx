import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Shield, X, Mail, Phone, GraduationCap } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel } from "@/lib/roles";

export const Route = createFileRoute("/officials")({
  head: () => ({
    meta: [
      { title: "Chapter Officials — MMUST ELP" },
      { name: "description", content: "Elected leadership for the MMUST ELP chapter." },
      { property: "og:title", content: "Chapter Officials — MMUST ELP" },
      { property: "og:description", content: "Elected leadership for the MMUST ELP chapter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Officials,
});

type Official = {
  id: string;
  role: string;
  full_name: string;
  course: string | null;
  year: number | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
};

function initialsOf(name: string) {
  return (name || "?").split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function Officials() {
  const [officials, setOfficials] = useState<Official[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Official | null>(null);

  useEffect(() => {
    supabase.rpc("list_chapter_officials").then(({ data }) => {
      setOfficials((data ?? []) as Official[]);
      setLoading(false);
    });
  }, []);

  return (
    <AppLayout title="Chapter Officials" subtitle="Your elected leadership team.">
      <section className="px-4 mt-4 space-y-2">
        {loading && <p className="text-sm text-muted-foreground text-center py-6">Loading officials…</p>}
        {!loading && officials.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No officials assigned yet. The Chapter President can assign roles from "Manage Members".
          </p>
        )}
        {officials.map((o) => (
          <button
            key={`${o.id}-${o.role}`}
            type="button"
            onClick={() => setSelected(o)}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
          >
            {o.avatar_url ? (
              <img
                src={o.avatar_url}
                alt={o.full_name || "Official photo"}
                loading="lazy"
                className="h-10 w-10 rounded-full object-cover border border-border shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-[var(--brand)] text-brand-foreground flex items-center justify-center font-extrabold shrink-0">
                {initialsOf(o.full_name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground truncate">
                {roleLabel(o.role).toUpperCase()}
              </p>
              <p className="text-sm font-bold text-foreground truncate">{o.full_name || "—"}</p>
            </div>
            <Shield className="h-5 w-5 text-[var(--brand-accent)] shrink-0" />
          </button>
        ))}
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              {selected.avatar_url ? (
                <img
                  src={selected.avatar_url}
                  alt={selected.full_name}
                  className="h-14 w-14 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-[var(--brand)] text-brand-foreground flex items-center justify-center text-lg font-extrabold">
                  {initialsOf(selected.full_name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-foreground truncate">{selected.full_name}</p>
                <p className="text-xs font-semibold text-[var(--brand-accent)] truncate">
                  {roleLabel(selected.role)}
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="p-1 text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <Row icon={<GraduationCap className="h-4 w-4" />} label="Course" value={selected.course || "—"} />
              <Row icon={<GraduationCap className="h-4 w-4" />} label="Year of study" value={selected.year ? `Year ${selected.year}` : "—"} />
              <Row icon={<Mail className="h-4 w-4" />} label="Email" value={selected.email || "—"} href={selected.email ? `mailto:${selected.email}` : undefined} />
              <Row icon={<Phone className="h-4 w-4" />} label="Phone" value={selected.phone || "—"} href={selected.phone ? `tel:${selected.phone}` : undefined} />
            </dl>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Row({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </dt>
      <dd className="font-semibold text-foreground text-right break-words">
        {href ? (
          <a href={href} className="text-[var(--brand-accent)] underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
