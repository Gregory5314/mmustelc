import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Quote, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/quote-submit")({
  head: () => ({
    meta: [
      { title: "Submit a Quote of the Week — MMUST ELP" },
      { name: "description", content: "Share an inspiring quote for the chapter's Quote of the Week." },
      { property: "og:title", content: "Submit a Quote of the Week — MMUST ELP" },
      { property: "og:description", content: "Share an inspiring quote for the chapter's Quote of the Week." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Mine = { id: string; quote_text: string; scholar_name: string; status: string; created_at: string };

function Page() {
  const [form, setForm] = useState({ scholar_name: "", quote_text: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [mine, setMine] = useState<Mine[]>([]);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase.from("quotes")
      .select("id,quote_text,scholar_name,status,created_at")
      .eq("submitted_by", u.user.id).order("created_at", { ascending: false });
    setMine((data ?? []) as Mine[]);
  };
  useEffect(() => { load(); }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = form.scholar_name.trim(), text = form.quote_text.trim();
    if (!name || !text) return toast.error("Please fill in the name and quote.");
    if (text.length > 500) return toast.error("Quote must be under 500 characters.");
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Please sign in first.");
      let photo_url: string | null = null;
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5MB");
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `quote-submissions/${u.user.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
        if (error) throw error;
        photo_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("quotes").insert({
        scholar_name: name, quote_text: text, photo_url,
        is_active: false, status: "pending", submitted_by: u.user.id,
      });
      if (error) throw error;
      setForm({ scholar_name: "", quote_text: "" });
      setFile(null);
      setDone(true);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Could not submit");
    } finally { setBusy(false); }
  };

  return (
    <>
      <Toaster />
      <section className="px-4 mt-4">
        <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="text-base font-extrabold text-[var(--brand)] flex items-center gap-2">
            <Quote className="h-5 w-5" /> Submit Quote of the Week
          </h3>
          <input required maxLength={100} placeholder="Name of the person quoted" value={form.scholar_name}
            onChange={(e) => setForm({ ...form, scholar_name: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <textarea required maxLength={500} rows={4} placeholder="The quote" value={form.quote_text}
            onChange={(e) => setForm({ ...form, quote_text: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <div>
            <label className="text-[10px] font-bold tracking-wider text-muted-foreground">Photo (optional)</label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-sm" />
          </div>
          <button type="submit" disabled={busy}
            className="w-full bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg disabled:opacity-60">
            {busy ? "Submitting…" : "Submit for review"}
          </button>
        </form>
      </section>

      {mine.length > 0 && (
        <section className="px-4 mt-4 mb-8 space-y-2">
          <h4 className="text-sm font-extrabold">My submissions</h4>
          {mine.map((q) => (
            <div key={q.id} className="bg-card border border-border rounded-xl p-3 flex gap-3 items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs italic line-clamp-3">“{q.quote_text}”</p>
                <p className="text-[11px] text-muted-foreground mt-1">— {q.scholar_name}</p>
              </div>
              {q.status === "published" ? (
                <span className="text-[10px] font-bold uppercase flex items-center gap-1 text-primary"><CheckCircle2 className="h-3.5 w-3.5" />Published</span>
              ) : q.status === "rejected" ? (
                <span className="text-[10px] font-bold uppercase flex items-center gap-1 text-muted-foreground"><XCircle className="h-3.5 w-3.5" />Not approved</span>
              ) : (
                <span className="text-[10px] font-bold uppercase flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" />In review</span>
              )}
            </div>
          ))}
        </section>
      )}

      <Dialog open={done} onOpenChange={setDone}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <Clock className="h-12 w-12 text-primary mb-2" />
            <DialogTitle>Quote submitted</DialogTitle>
            <DialogDescription>Your quote is in review. The Chapter President will publish it once approved.</DialogDescription>
          </DialogHeader>
          <DialogFooter><Button className="w-full" onClick={() => setDone(false)}>Okay</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
