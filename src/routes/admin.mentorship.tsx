import { createFileRoute } from "@tanstack/react-router";
import { PermissionGate } from "@/components/AppLayout";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Heart, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/mentorship")({
  head: () => ({ meta: [{ title: "Mentorship — MMUST ELP" }] }),
  component: () => <PermissionGate perm={["mentorship.update", "mentorship.assign"]} title="Mentorship"><Page /></PermissionGate>,
});

type Act = { id: string; title: string; description: string | null; activity_date: string };
type Assign = { id: string; profile_id: string; school: string; assigned_until: string | null };
type Prof = { id: string; full_name: string; course: string | null; year: number | null };

function Page() {
  const [acts, setActs] = useState<Act[]>([]);
  const [assigns, setAssigns] = useState<Assign[]>([]);
  const [profs, setProfs] = useState<Prof[]>([]);
  const [actForm, setActForm] = useState({ title: "", description: "", activity_date: "" });
  const [asForm, setAsForm] = useState({ profile_id: "", school: "", assigned_until: "" });

  const refresh = async () => {
    const [{ data: a }, { data: as }, { data: p }] = await Promise.all([
      supabase.from("mentorship_activities").select("*").order("activity_date", { ascending: false }),
      supabase.from("mentor_assignments").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, course, year").order("full_name"),
    ]);
    setActs((a ?? []) as Act[]); setAssigns((as ?? []) as Assign[]); setProfs((p ?? []) as Prof[]);
  };
  useEffect(() => { refresh(); }, []);

  const addAct = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("mentorship_activities").insert({
      title: actForm.title, description: actForm.description || null, activity_date: actForm.activity_date,
    });
    if (error) return toast.error(error.message);
    toast.success("Activity posted.");
    setActForm({ title: "", description: "", activity_date: "" }); refresh();
  };

  const addAssign = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("mentor_assignments").insert({
      profile_id: asForm.profile_id, school: asForm.school,
      assigned_until: asForm.assigned_until || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Assignment created.");
    setAsForm({ profile_id: "", school: "", assigned_until: "" }); refresh();
  };

  const profName = (id: string) => profs.find((p) => p.id === id)?.full_name ?? id;

  return (
    <>
      <Toaster />
      <section className="px-4 mt-4">
        <form onSubmit={addAct} className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h3 className="text-base font-extrabold text-[var(--brand)] flex items-center gap-2"><Heart className="h-5 w-5" /> New Activity</h3>
          <input required placeholder="Title *" value={actForm.title} onChange={(e) => setActForm({ ...actForm, title: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <input required type="date" value={actForm.activity_date} onChange={(e) => setActForm({ ...actForm, activity_date: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <textarea placeholder="Description" rows={2} value={actForm.description} onChange={(e) => setActForm({ ...actForm, description: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <button className="w-full bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg">Post</button>
        </form>
      </section>

      <section className="px-4 mt-6 space-y-2">
        <h3 className="text-base font-extrabold text-[var(--brand)]">Recent Activities</h3>
        {acts.map((a) => (
          <div key={a.id} className="bg-card border border-border rounded-xl p-3">
            <p className="text-sm font-bold">{a.title}</p>
            <p className="text-xs text-muted-foreground">{new Date(a.activity_date).toLocaleDateString()}</p>
            {a.description && <p className="text-xs mt-1">{a.description}</p>}
          </div>
        ))}
      </section>

      <section className="px-4 mt-6">
        <form onSubmit={addAssign} className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h3 className="text-base font-extrabold text-[var(--brand)]">Assign Member to School</h3>
          <select required value={asForm.profile_id} onChange={(e) => setAsForm({ ...asForm, profile_id: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Select member…</option>
            {profs.map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.course ? ` — ${p.course}` : ""}{p.year ? ` (Y${p.year})` : ""}</option>)}
          </select>
          <input required placeholder="School *" value={asForm.school} onChange={(e) => setAsForm({ ...asForm, school: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <input type="date" placeholder="Assigned until" value={asForm.assigned_until} onChange={(e) => setAsForm({ ...asForm, assigned_until: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <button className="w-full bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg">Assign</button>
        </form>
      </section>

      <section className="px-4 mt-6 space-y-2">
        <h3 className="text-base font-extrabold text-[var(--brand)]">Current Assignments</h3>
        {assigns.map((a) => (
          <div key={a.id} className="bg-card border border-border rounded-xl p-3 flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-bold">{profName(a.profile_id)}</p>
              <p className="text-xs text-muted-foreground">{a.school}{a.assigned_until ? ` • until ${new Date(a.assigned_until).toLocaleDateString()}` : ""}</p>
            </div>
            <button onClick={async () => { await supabase.from("mentor_assignments").delete().eq("id", a.id); refresh(); }} className="p-2 text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </section>
    </>
  );
}
