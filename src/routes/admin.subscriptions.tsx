import { createFileRoute } from "@tanstack/react-router";
import { PermissionGate } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/admin/subscriptions")({
  head: () => ({ meta: [{ title: "Subscriptions — MMUST ELP" }] }),
  component: () => <PermissionGate perm="subscriptions.update" title="Subscriptions"><Page /></PermissionGate>,
});

type Row = { id: string; full_name: string; course: string | null; year: number | null; status: string };

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [confirmRow, setConfirmRow] = useState<Row | null>(null);
  const [working, setWorking] = useState(false);

  const refresh = async () => {
    const { data: profs } = await supabase.from("profiles").select("id, full_name, course, year").order("full_name");
    const { data: subs } = await supabase.from("subscriptions").select("profile_id, status");
    const statusMap = new Map((subs ?? []).map((s) => [s.profile_id, s.status]));
    setRows((profs ?? []).map((p) => ({ ...p, status: statusMap.get(p.id) ?? "inactive" })));
  };
  useEffect(() => { refresh(); }, []);

  const requestToggle = (row: Row) => {
    // Only require confirmation when activating (inactive -> active)
    if (row.status !== "active") {
      setConfirmRow(row);
    } else {
      void applyToggle(row);
    }
  };

  const applyToggle = async (row: Row) => {
    setWorking(true);
    const next = row.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("subscriptions").upsert(
      { profile_id: row.id, status: next, updated_at: new Date().toISOString() },
      { onConflict: "profile_id" },
    );
    setWorking(false);
    setConfirmRow(null);
    if (error) return toast.error(error.message);
    toast.success(`Set to ${next}`);
    refresh();
  };

  return (
    <>
      <Toaster />
      <section className="px-4 mt-4 space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{r.full_name || "—"}</p>
              <p className="text-xs text-muted-foreground">{[r.course, r.year ? `Year ${r.year}` : null].filter(Boolean).join(" • ") || "—"}</p>
            </div>
            <button
              onClick={() => requestToggle(r)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full ${r.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
            >
              {r.status}
            </button>
          </div>
        ))}
      </section>

      {confirmRow && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-extrabold text-foreground">Confirm activation</h3>
            <p className="text-sm mt-3 text-foreground">
              Has <span className="font-bold">{confirmRow.full_name}</span> paid the subscription fee?
            </p>
            <p className="text-xs mt-1 text-muted-foreground">{[confirmRow.course, confirmRow.year ? `Year ${confirmRow.year}` : null].filter(Boolean).join(" • ") || "—"}</p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setConfirmRow(null)}
                disabled={working}
                className="flex-1 bg-muted text-foreground font-bold py-2.5 rounded-lg hover:bg-accent transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => applyToggle(confirmRow)}
                disabled={working}
                className="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
              >
                {working ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
