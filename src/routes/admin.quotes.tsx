import { createFileRoute } from "@tanstack/react-router";
import { PermissionGate } from "@/components/AppLayout";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Quote, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/quotes")({
  head: () => ({ meta: [{ title: "Quote of the Week — MMUST ELP" }] }),
  component: () => (
    <PermissionGate perm="quotes.manage" title="Quote of the Week">
      <Page />
    </PermissionGate>
  ),
});

type Q = {
  id: string;
  scholar_name: string;
  quote_text: string;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
  status: string;
};

function Page() {
  const [items, setItems] = useState<Q[]>([]);
  const [form, setForm] = useState({ scholar_name: "", quote_text: "" });
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<Q | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    supabase
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems((data ?? []) as Q[]));
  useEffect(() => {
    refresh();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    let photo_url: string | null = null;
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setBusy(false);
        return toast.error("Image must be under 5MB");
      }
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `quotes/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) {
        setBusy(false);
        return toast.error(upErr.message);
      }
      photo_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }
    // deactivate previous active quotes so newest is the "of the week"
    await supabase.from("quotes").update({ is_active: false }).eq("is_active", true);
    const { error } = await supabase.from("quotes").insert({
      scholar_name: form.scholar_name,
      quote_text: form.quote_text,
      photo_url,
      is_active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Quote of the week published.");
    setForm({ scholar_name: "", quote_text: "" });
    setFile(null);
    refresh();
  };

  const setActive = async (id: string) => {
    await supabase.from("quotes").update({ is_active: false }).eq("is_active", true);
    const { error } = await supabase.from("quotes").update({ is_active: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Active quote updated.");
    refresh();
  };

  const publish = async (id: string) => {
    const { error } = await supabase.from("quotes").update({ status: "published" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Quote published.");
    refresh();
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.scholar_name.trim() || !editing.quote_text.trim()) return toast.error("Name and quote are required");
    setBusy(true);
    let photo_url = editing.photo_url;
    if (editFile) {
      if (editFile.size > 5 * 1024 * 1024) { setBusy(false); return toast.error("Image must be under 5MB"); }
      const ext = editFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `quotes/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, editFile, { contentType: editFile.type });
      if (upErr) { setBusy(false); return toast.error(upErr.message); }
      photo_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("quotes")
      .update({ scholar_name: editing.scholar_name.trim(), quote_text: editing.quote_text.trim(), photo_url })
      .eq("id", editing.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Quote updated.");
    setEditing(null); setEditFile(null);
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("quotes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed.");
    refresh();
  };

  return (
    <>
      <Toaster />
      <section className="px-4 mt-4">
        <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="text-base font-extrabold text-[var(--brand)] flex items-center gap-2">
            <Quote className="h-5 w-5" /> New Quote
          </h3>
          <input
            required
            placeholder="Scholar name"
            value={form.scholar_name}
            onChange={(e) => setForm({ ...form, scholar_name: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <textarea
            required
            placeholder="Quote text"
            rows={4}
            value={form.quote_text}
            onChange={(e) => setForm({ ...form, quote_text: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <div>
            <label className="text-[10px] font-bold tracking-wider text-muted-foreground">Scholar photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg disabled:opacity-60"
          >
            {busy ? "Publishing…" : "Publish as Quote of the Week"}
          </button>
        </form>
      </section>

      {items.some((q) => q.status === "pending") && (
        <section className="px-4 mt-6 space-y-2">
          <h3 className="text-base font-extrabold text-[var(--brand)]">Submitted for Review</h3>
          {items.filter((q) => q.status === "pending").map((q) => (
            <div key={q.id} className="bg-card border border-border rounded-xl p-3 flex items-start gap-3">
              {q.photo_url ? <img src={q.photo_url} alt={q.scholar_name} className="h-14 w-14 rounded-full object-cover" /> : <div className="h-14 w-14 rounded-full bg-muted" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{q.scholar_name}</p>
                <p className="text-xs text-muted-foreground italic mt-0.5">“{q.quote_text}”</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => publish(q.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[var(--brand)] text-brand-foreground">Publish</button>
                  <button onClick={() => setEditing(q)} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-border">Edit</button>
                  <button onClick={() => remove(q.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg text-destructive">Reject</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit quote</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <input value={editing.scholar_name} onChange={(e) => setEditing({ ...editing, scholar_name: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <textarea rows={4} value={editing.quote_text} onChange={(e) => setEditing({ ...editing, quote_text: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              {editing.photo_url && <img src={editing.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />}
              <div>
                <label className="text-[10px] font-bold tracking-wider text-muted-foreground">Replace photo</label>
                <input type="file" accept="image/*" onChange={(e) => setEditFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-sm" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={saveEdit} disabled={busy} className="w-full">{busy ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="px-4 mt-6 space-y-2 pb-4">
        <h3 className="text-base font-extrabold text-[var(--brand)]">Published Quotes ({items.filter((q) => q.status !== "pending").length})</h3>
        {items.filter((q) => q.status !== "pending").map((q) => (
          <div key={q.id} className="bg-card border border-border rounded-xl p-3 flex items-start gap-3">
            {q.photo_url ? (
              <img src={q.photo_url} alt={q.scholar_name} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-muted" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">
                {q.scholar_name}
                {q.is_active && (
                  <span className="ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-green-100 text-green-700">
                    Active
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground italic mt-0.5 line-clamp-3">“{q.quote_text}”</p>
            </div>
            <div className="flex flex-col gap-1">
              {!q.is_active && (
                <button onClick={() => setActive(q.id)} className="p-2 text-amber-500 hover:bg-amber-50 rounded" title="Set active">
                  <Star className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => remove(q.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
