import { createFileRoute } from "@tanstack/react-router";
import { PermissionGate } from "@/components/AppLayout";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Trash2, FileText, FileDown } from "lucide-react";

export const Route = createFileRoute("/admin/meetings")({
  head: () => ({
    meta: [
      { title: "Meeting Minutes — MMUST ELP" },
      { name: "description", content: "Write, store and export MMUST ELP chapter meeting minutes." },
      { property: "og:title", content: "Meeting Minutes — MMUST ELP" },
      { property: "og:description", content: "Write, store and export MMUST ELP chapter meeting minutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PermissionGate perm="meetings.upload" title="Meeting Minutes">
      <Page />
    </PermissionGate>
  ),
});

type Row = {
  id: string;
  title: string;
  meeting_date: string;
  attendees: string | null;
  agenda: string | null;
  deliberations: string | null;
  aob: string | null;
  notes: string | null;
};

const EMPTY = { title: "", meeting_date: "", attendees: "", agenda: "", deliberations: "", aob: "" };

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const refresh = () =>
    supabase
      .from("meeting_reports")
      .select("*")
      .order("meeting_date", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Row[]));
  useEffect(() => {
    refresh();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("meeting_reports").insert({
      title: form.title,
      meeting_date: form.meeting_date,
      attendees: form.attendees || null,
      agenda: form.agenda || null,
      deliberations: form.deliberations || null,
      aob: form.aob || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Minutes saved.");
    setForm({ ...EMPTY });
    refresh();
  };

  const exportPdf = async (r: Row) => {
    setExportingId(r.id);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const margin = 48;
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();
      let y = margin;

      const ensureRoom = (needed: number) => {
        if (y + needed > height - margin) {
          doc.addPage();
          y = margin;
        }
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("MMUST ELP — Meeting Minutes", margin, y);
      y += 22;

      doc.setFontSize(12);
      doc.text(r.title || "Untitled meeting", margin, y);
      y += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        `Date: ${r.meeting_date ? new Date(r.meeting_date).toLocaleDateString() : "—"}`,
        margin,
        y,
      );
      y += 18;
      doc.setDrawColor(185, 28, 28);
      doc.line(margin, y, width - margin, y);
      y += 20;

      const block = (heading: string, body: string | null) => {
        const text = (body ?? "").trim() || "—";
        const lines = doc.splitTextToSize(text, width - margin * 2) as string[];
        ensureRoom(26 + lines.length * 13);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(heading, margin, y);
        y += 15;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        lines.forEach((line) => {
          ensureRoom(13);
          doc.text(line, margin, y);
          y += 13;
        });
        y += 12;
      };

      block("Members Present", r.attendees);
      block("Agenda", r.agenda);
      block("Deliberations", r.deliberations ?? r.notes);
      block("Any Other Business (AOB)", r.aob);

      ensureRoom(40);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Generated ${new Date().toLocaleString()}`, margin, height - margin + 10);

      const slug = (r.title || "minutes").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      doc.save(`mmust-elp-minutes-${slug}-${r.meeting_date || ""}.pdf`);
    } finally {
      setExportingId(null);
    }
  };

  const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

  return (
    <>
      <Toaster />
      <section className="px-4 mt-4">
        <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h3 className="text-base font-extrabold text-[var(--brand)] flex items-center gap-2">
            <FileText className="h-5 w-5" /> Write Minutes
          </h3>

          <label className="block">
            <span className="text-xs font-bold text-muted-foreground">Meeting title *</span>
            <input
              required
              placeholder="e.g. Third Ordinary Chapter Meeting"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={field}
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-muted-foreground">Meeting date *</span>
            <input
              required
              type="date"
              value={form.meeting_date}
              onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
              className={field}
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-muted-foreground">Members present</span>
            <textarea
              rows={4}
              placeholder="One name per line"
              value={form.attendees}
              onChange={(e) => setForm({ ...form, attendees: e.target.value })}
              className={field}
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-muted-foreground">Agenda</span>
            <textarea
              rows={4}
              placeholder="1. Call to order&#10;2. Confirmation of previous minutes"
              value={form.agenda}
              onChange={(e) => setForm({ ...form, agenda: e.target.value })}
              className={field}
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-muted-foreground">Deliberations & resolutions</span>
            <textarea
              rows={5}
              placeholder="What was discussed and agreed on"
              value={form.deliberations}
              onChange={(e) => setForm({ ...form, deliberations: e.target.value })}
              className={field}
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-muted-foreground">Any Other Business (AOB)</span>
            <textarea
              rows={3}
              placeholder="Other matters raised"
              value={form.aob}
              onChange={(e) => setForm({ ...form, aob: e.target.value })}
              className={field}
            />
          </label>

          <button
            disabled={saving}
            className="w-full bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Minutes"}
          </button>
        </form>
      </section>

      <section className="px-4 mt-6 space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No minutes recorded yet.</p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.meeting_date).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={async () => {
                  await supabase.from("meeting_reports").delete().eq("id", r.id);
                  refresh();
                }}
                aria-label="Delete minutes"
                className="p-2 text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <dl className="mt-2 space-y-1.5 text-xs">
              <Part label="Members present" value={r.attendees} />
              <Part label="Agenda" value={r.agenda} />
              <Part label="Deliberations" value={r.deliberations ?? r.notes} />
              <Part label="AOB" value={r.aob} />
            </dl>

            <button
              type="button"
              onClick={() => exportPdf(r)}
              disabled={exportingId === r.id}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-background py-2 text-xs font-bold text-foreground disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              {exportingId === r.id ? "Preparing PDF…" : "Export minutes as PDF"}
            </button>
          </div>
        ))}
      </section>
    </>
  );
}

function Part({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <dt className="font-bold text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap text-foreground">{value}</dd>
    </div>
  );
}
