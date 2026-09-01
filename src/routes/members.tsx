import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { Search, X, FileDown } from "lucide-react";


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
  const [term, setTerm] = useState("");
  const [year, setYear] = useState<string>("all");
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Details | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("list_members_directory").then(({ data }) => {
      setMembers((data ?? []) as Member[]);
      setLoading(false);
    });
  }, []);

  // Debounce the search input so typing stays smooth on long lists
  useEffect(() => {
    const id = setTimeout(() => setTerm(q.trim()), 180);
    return () => clearTimeout(id);
  }, [q]);

  const years = useMemo(() => {
    const set = new Set<number>();
    members.forEach((m) => m.year && set.add(m.year));
    return [...set].sort((a, b) => a - b);
  }, [members]);

  const filtered = useMemo(() => {
    const t = term.toLowerCase();
    return members
      .filter((m) => {
        if (year === "all") return true;
        if (year === "none") return !m.year;
        return String(m.year) === year;
      })
      .filter((m) =>
        !t
          ? true
          : [m.full_name, m.course ?? "", m.year ? `year ${m.year}` : ""]
              .join(" ")
              .toLowerCase()
              .includes(t),
      )
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  }, [members, term, year]);

  const exportPdf = async () => {
    if (!isOfficer) return;
    setExporting(true);
    try {
      // Contacts come from the access-controlled admin view, one member at a time.
      const contacts = new Map<string, { phone: string | null; email: string | null }>();
      const batch = 8;
      for (let i = 0; i < filtered.length; i += batch) {
        const slice = filtered.slice(i, i + batch);
        const results = await Promise.all(
          slice.map((m) => supabase.rpc("get_member_admin_view", { _user_id: m.id })),
        );
        results.forEach(({ data }, idx) => {
          const row = (data as Details[] | null)?.[0];
          const member = slice[idx];
          if (member) contacts.set(member.id, { phone: row?.phone ?? null, email: row?.email ?? null });
        });
      }

      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const scope =
        year === "all" ? "All years" : year === "none" ? "Year not set" : `Year ${year}`;
      doc.setFontSize(15);
      doc.text("MMUST ELP — Members List", 40, 44);
      doc.setFontSize(10);
      doc.text(`${scope} · ${filtered.length} member(s) · ${new Date().toLocaleDateString()}`, 40, 62);
      autoTable(doc, {
        startY: 78,
        head: [["#", "Full name", "Course", "Year", "Phone", "Email"]],
        body: filtered.map((m, i) => [
          String(i + 1),
          m.full_name || "—",
          m.course || "—",
          m.year ? `Year ${m.year}` : "—",
          contacts.get(m.id)?.phone || "—",
          contacts.get(m.id)?.email || "—",
        ]),
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [185, 28, 28], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });
      doc.save(`mmust-elp-members-${year}.pdf`);
    } finally {
      setExporting(false);
    }
  };

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
      <section className="px-4 mt-4 space-y-3">
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

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { v: "all", label: "All years" },
            ...years.map((y) => ({ v: String(y), label: `Year ${y}` })),
            { v: "none", label: "Not set" },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setYear(opt.v)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                year === opt.v
                  ? "bg-[var(--brand)] text-brand-foreground border-transparent"
                  : "bg-card text-muted-foreground border-border"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={exportPdf}
          disabled={exporting || filtered.length === 0}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-bold text-foreground disabled:opacity-50"
        >
          <FileDown className="h-4 w-4" />
          {exporting ? "Preparing PDF…" : `Export ${filtered.length} member(s) as PDF`}
        </button>
      </section>

      <section className="px-4 mt-3">
        {loading && <p className="text-sm text-muted-foreground text-center py-6">Loading members…</p>}
        {!loading && members.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No members yet. Ask an admin to add members from "Manage Members".
          </p>
        )}
        {!loading && members.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No members match this filter.</p>
        )}

        {filtered.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-[2rem_1fr_4.5rem] gap-2 px-3 py-2 border-b border-border bg-muted/50 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <span>#</span>
              <span>Member</span>
              <span className="text-right">Year</span>
            </div>
            <ul className="divide-y divide-border">
              {filtered.map((m, i) => {
                const inner = (
                  <>
                    <span className="text-xs text-muted-foreground tabular-nums pt-1">{i + 1}</span>
                    <span className="flex items-center gap-3 min-w-0">
                      {m.avatar_url ? (
                        <img
                          src={m.avatar_url}
                          alt={m.full_name || "Member photo"}
                          loading="lazy"
                          className="h-9 w-9 rounded-full object-cover border border-border shrink-0"
                        />
                      ) : (
                        <span className="h-9 w-9 shrink-0 rounded-full bg-[var(--brand)] text-brand-foreground flex items-center justify-center text-xs font-extrabold">
                          {initialsOf(m.full_name)}
                        </span>
                      )}
                      <span className="min-w-0 text-left">
                        <span className="block text-sm font-bold text-foreground truncate">
                          <Highlight text={m.full_name || "—"} term={term} />
                        </span>
                        <span className="block text-xs text-muted-foreground truncate">
                          <Highlight text={m.course || "Member"} term={term} />
                        </span>
                      </span>
                    </span>
                    <span className="text-right text-xs font-semibold text-muted-foreground pt-1">
                      {m.year ? `Y${m.year}` : "—"}
                    </span>
                  </>
                );
                return (
                  <li key={m.id}>
                    {isOfficer ? (
                      <button
                        type="button"
                        onClick={() => openMember(m)}
                        className="w-full grid grid-cols-[2rem_1fr_4.5rem] gap-2 items-start px-3 py-2.5 active:scale-[0.99] transition-transform"
                      >
                        {inner}
                      </button>
                    ) : (
                      <div className="grid grid-cols-[2rem_1fr_4.5rem] gap-2 items-start px-3 py-2.5">
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
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

function Highlight({ text, term }: { text: string; term: string }) {
  const t = term.trim();
  if (!t) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(t.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[var(--brand)]/25 text-foreground rounded px-0.5">
        {text.slice(idx, idx + t.length)}
      </mark>
      {text.slice(idx + t.length)}
    </>
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
