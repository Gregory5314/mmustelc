import { createFileRoute } from "@tanstack/react-router";
import { PermissionGate } from "@/components/AppLayout";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, CheckCircle2, Trash2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/admin/events")({
  head: () => ({ meta: [{ title: "Manage Events — MMUST ELP" }] }),
  component: () => <PermissionGate perm="events.update" title="Manage Events"><Page /></PermissionGate>,
});

type Ev = {
  id: string; title: string; description: string | null;
  starts_at: string; location: string | null; status: string;
  photo_url: string | null;
};

function Page() {
  const [items, setItems] = useState<Ev[]>([]);
  const [form, setForm] = useState({ title: "", description: "", starts_at: "", location: "" });
  const [busy, setBusy] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const refresh = () =>
    supabase.from("events").select("*").order("starts_at", { ascending: false })
      .then(({ data }) => setItems((data ?? []) as Ev[]));
  useEffect(() => { refresh(); }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.from("events").insert({
      title: form.title, description: form.description || null,
      starts_at: new Date(form.starts_at).toISOString(),
      location: form.location || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Event created. Members notified.");
    setForm({ title: "", description: "", starts_at: "", location: "" });
    refresh();
  };

  const markSuccessful = async (id: string) => {
    const { error } = await supabase.from("events").update({ status: "successful" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as successful."); refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Event removed."); refresh();
  };

  const uploadPhoto = async (id: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setUploadingId(id);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${id}/cover-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("event_photos").upload(path, file, {
      cacheControl: "3600", upsert: true, contentType: file.type,
    });
    if (upErr) { setUploadingId(null); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("event_photos").getPublicUrl(path);
    const { error: updErr } = await supabase.from("events").update({ photo_url: pub.publicUrl }).eq("id", id);
    setUploadingId(null);
    if (updErr) return toast.error(updErr.message);
    toast.success("Event photo updated."); refresh();
  };

  return (
    <>
      <Toaster />
      <section className="px-4 mt-4">
        <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="text-base font-extrabold text-[var(--brand)] flex items-center gap-2">
            <Calendar className="h-5 w-5" /> New Event
          </h3>
          <Input label="Title *" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
          <Input label="Date & Time *" type="datetime-local" value={form.starts_at} onChange={(v) => setForm({ ...form, starts_at: v })} required />
          <Input label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
          <TextArea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <button type="submit" disabled={busy} className="w-full bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg disabled:opacity-60">
            {busy ? "Creating…" : "Create Event"}
          </button>
        </form>
      </section>

      <section className="px-4 mt-6 space-y-2 pb-4">
        <h3 className="text-base font-extrabold text-[var(--brand)]">All Events ({items.length})</h3>
        {items.map((ev) => (
          <EventRow
            key={ev.id}
            ev={ev}
            uploading={uploadingId === ev.id}
            onMarkSuccessful={() => markSuccessful(ev.id)}
            onRemove={() => remove(ev.id)}
            onUploadPhoto={(file) => uploadPhoto(ev.id, file)}
          />
        ))}
      </section>
    </>
  );
}

function EventRow({
  ev, uploading, onMarkSuccessful, onRemove, onUploadPhoto,
}: {
  ev: Ev; uploading: boolean;
  onMarkSuccessful: () => void; onRemove: () => void;
  onUploadPhoto: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="aspect-[16/9] bg-muted relative">
        {ev.photo_url ? (
          <img src={ev.photo_url} alt={ev.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-brand-foreground font-extrabold">
            Upcoming Event
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUploadPhoto(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-white/90 text-[var(--brand)] text-[11px] font-bold px-2 py-1 rounded shadow disabled:opacity-60"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {uploading ? "Uploading…" : ev.photo_url ? "Change photo" : "Add photo"}
        </button>
      </div>
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm font-bold">{ev.title}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(ev.starts_at).toLocaleString()}{ev.location ? ` • ${ev.location}` : ""}
          </p>
          <span className={`mt-1 inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
            ev.status === "successful" ? "bg-green-100 text-green-700" : "bg-[var(--brand)]/10 text-[var(--brand)]"
          }`}>{ev.status}</span>
        </div>
        <div className="flex flex-col gap-1">
          {ev.status !== "successful" && (
            <button onClick={onMarkSuccessful} className="p-2 text-green-600 hover:bg-green-50 rounded" title="Mark successful">
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={onRemove} className="p-2 text-destructive hover:bg-destructive/10 rounded">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, required, type = "text" }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string }) {
  return (
    <div>
      <label className="text-[10px] font-bold tracking-wider text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]" />
    </div>
  );
}
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] font-bold tracking-wider text-muted-foreground">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]" />
    </div>
  );
}
