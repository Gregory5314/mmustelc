import { createFileRoute } from "@tanstack/react-router";
import { PermissionGate } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/admin/complaints")({
  head: () => ({ meta: [{ title: "Complaints — MMUST ELP" }] }),
  component: () => <PermissionGate perm="complaints.view" title="Complaints"><Page /></PermissionGate>,
});

type C = { id: string; subject: string; category: string; details: string; status: string; created_at: string; submitter_id: string };
type Prof = { id: string; full_name: string; course: string | null };

function Page() {
  const [items, setItems] = useState<C[]>([]);
  const [profs, setProfs] = useState<Record<string, Prof>>({});
  const refresh = async () => {
    const { data } = await supabase.from("complaints").select("*").order("created_at", { ascending: false });
    const rows = (data ?? []) as C[]; setItems(rows);
    const ids = Array.from(new Set(rows.map((r) => r.submitter_id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id, full_name, course").in("id", ids);
      const map: Record<string, Prof> = {};
      (ps ?? []).forEach((p) => { map[p.id] = p as Prof; });
      setProfs(map);
    }
  };
  useEffect(() => { refresh(); }, []);
  const resolve = async (id: string) => {
    const { error } = await supabase.from("complaints").update({ status: "resolved", read_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked resolved."); refresh();
  };
  return (
    <>
      <Toaster />
      <section className="px-4 mt-4 space-y-2">
        {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No complaints.</p>}
        {items.map((c) => {
          const who = profs[c.submitter_id];
          const resolved = c.status === "resolved";
          return (
            <div key={c.id} className={`rounded-xl border p-3 ${resolved ? "bg-card border-border" : "bg-destructive/5 border-destructive/30"}`}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={`h-5 w-5 mt-0.5 ${resolved ? "text-muted-foreground" : "text-destructive"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{c.subject}</p>
                  <p className="text-xs text-muted-foreground">{who ? `${who.full_name}${who.course ? ` • ${who.course}` : ""}` : "Member"} · {c.category}</p>
                  <p className="text-sm mt-2 whitespace-pre-wrap">{c.details}</p>
                  {!resolved && (
                    <button onClick={() => resolve(c.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--brand)]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark resolved
                    </button>
                  )}
                  {resolved && <span className="mt-2 inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-green-100 text-green-700">Resolved</span>}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
