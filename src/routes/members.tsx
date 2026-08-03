import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { Search, X } from "lucide-react";

export const Route = createFileRoute("/members")({
  head: () => ({
    meta: [
      { title: "Members List — MMUST ELP" },
      { name: "description", content: "Searchable directory of MMUST ELP chapter members." },
      { property: "og:title", content: "Members List — MMUST ELP" },
      { property: "og:description", content: "Searchable directory of MMUST ELP chapter members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Members,
});

type Member = {
  id: string;
  full_name: string;
  course: string | null;
  year: number | null;
  avatar_url: string | null;
};

type Details = Member & {
  email: string | null;
  phone: string | null;
  mentoring_school: string | null;
  scholar_code: string | null;
  created_at: string;
};

function initialsOf(name: string) {
  return (name || "?")
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Members() {
  const { roles } = usePermissions();
  const isOfficer = roles.some((r) => r !== "member");

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Details | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("list_members_directory").then(({ data }) => {
      setMembers((data ?? []) as Member[]);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return members;
    return members.filter((m) =>
      [m.full_name, m.course ?? "", m.year ? `year ${m.year}` : ""]
        .join(" ")
        .toLowerCase()
        .includes(t),
    );
  }, [members, q]);

  const openMember = async (m: Member) => {
    if (!isOfficer) return;
    setLoadingDetails(true);
    setDetailsError(null);
    setSelected({
      ...m,
      email: null,
      phone: null,
      mentoring_school: null,
      scholar_code: null,
      created_at: "",
    });
    const { data, error } = await supabase.rpc("get_member_admin_view", { _user_id: m.id });
    setLoadingDetails(false);
    if (error) {
      setDetailsError(error.message);
      return;
    }
    const row = (data as Details[] | null)?.[0];
    if (row) setSelected(row);
  };

  return (
    <AppLayout title="Members List" subtitle={`${members.length} chapter members.`}>
      <section className="px-4 mt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, course or year"
            aria-label="Search members"
            className="w-full rounded-xl border border-border bg-card pl-9 pr-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-[var(--brand)]"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>

      <section className="px-4 mt-3 space-y-2">
        {loading && <p className="text-sm text-muted-foreground text-center py-6">Loading members…</p>}
        {!loading && members.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No members yet. Ask an admin to add members from "Manage Members".
          </p>
        )}
        {!loading && members.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No members match "{q}".</p>
        )}
        {filtered.map((m) => {
          const inner = (
            <>
              {m.avatar_url ? (
                <img
                  src={m.avatar_url}
                  alt={m.full_name || "Member photo"}
                  loading="lazy"
                  className="h-10 w-10 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-[var(--brand)] text-brand-foreground flex items-center justify-center font-extrabold">
                  {initialsOf(m.full_name)}
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold text-foreground truncate">{m.full_name || "—"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[m.course, m.year ? `Year ${m.year}` : null].filter(Boolean).join(" • ") || "Member"}
                </p>
              </div>
            </>
          );
          return isOfficer ? (
            <button
              key={m.id}
              type="button"
              onClick={() => openMember(m)}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 active:scale-[0.99] transition-transform"
            >
              {inner}
            </button>
          ) : (
            <div key={m.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
              {inner}
            </div>
          );
        })}
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
                <p className="text-xs text-muted-foreground truncate">{selected.course || "—"}</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="p-1 text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailsError && <p className="mt-4 text-sm text-destructive">{detailsError}</p>}
            {loadingDetails && <p className="mt-4 text-sm text-muted-foreground">Loading profile…</p>}

            {!loadingDetails && !detailsError && (
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Scholar code" value={selected.scholar_code ?? "Hidden"} />
                <Row label="Year of study" value={selected.year ? `Year ${selected.year}` : "—"} />
                <Row label="Email" value={selected.email || "—"} />
                <Row label="Phone" value={selected.phone || "—"} />
                <Row label="Mentoring school" value={selected.mentoring_school || "—"} />
              </dl>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground text-right break-words">{value}</dd>
    </div>
  );
}
