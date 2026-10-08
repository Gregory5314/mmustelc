import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ExternalLink, Loader2, Plus, Pencil, Trash2, ArrowUp, ArrowDown, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/links")({
  head: () => ({
    meta: [
      { title: "Links — MMUST ELP" },
      { name: "description", content: "Useful links and resources." },
      { property: "og:title", content: "Links — MMUST ELP" },
      { property: "og:description", content: "Useful links and resources." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Links,
});

type LinkRow = { id: string; label: string; url: string; image_url: string | null; position: number };

const BUCKET = "event_photos";
const ASPECT = 3 / 2;
const FALLBACKS = ["from-red-600 to-rose-800", "from-blue-700 to-indigo-800", "from-emerald-700 to-teal-800", "from-amber-600 to-orange-700", "from-slate-700 to-slate-900"];

async function getCroppedBlob(src: string, crop: Area, mime: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const c = document.createElement("canvas");
  c.width = Math.round(crop.width); c.height = Math.round(crop.height);
  c.getContext("2d")!.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Crop failed"))), mime, 0.92));
}

type Draft = { id?: string; label: string; url: string; image_url: string | null };

function Links() {
  const { isAdmin } = useAuth();
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropMime, setCropMime] = useState("image/jpeg");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [blob, setBlob] = useState<{ blob: Blob; preview: string } | null>(null);

  const db = supabase as any;
  const load = async () => {
    const { data } = await db.from("chapter_links").select("*").order("position").order("created_at");
    setLinks((data ?? []) as LinkRow[]);
  };
  useEffect(() => { load(); }, []);

  const onCropComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    const r = new FileReader();
    r.onload = () => { setCropSrc(r.result as string); setCropMime(f.type); setCrop({ x: 0, y: 0 }); setZoom(1); setArea(null); };
    r.readAsDataURL(f);
  };

  const confirmCrop = async () => {
    if (!cropSrc || !area) return;
    const b = await getCroppedBlob(cropSrc, area, cropMime);
    setBlob({ blob: b, preview: URL.createObjectURL(b) });
    setCropSrc(null);
  };

  const openDraft = (d: Draft) => { setDraft(d); setBlob(null); };

  const save = async () => {
    if (!draft) return;
    const label = draft.label.trim();
    let url = draft.url.trim();
    if (!label || !url) { toast.error("Enter a name and a link"); return; }
    if (!url.startsWith("/") && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    setSaving(true);
    try {
      let image_url = draft.image_url;
      if (blob) {
        const ext = (cropMime.split("/")[1] || "jpg").replace("jpeg", "jpg");
        const path = `links/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, blob.blob, { cacheControl: "31536000", contentType: cropMime });
        if (error) throw error;
        image_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
      const row = { label, url, image_url };
      const { error } = draft.id
        ? await db.from("chapter_links").update(row).eq("id", draft.id)
        : await db.from("chapter_links").insert({ ...row, position: (links.at(-1)?.position ?? -1) + 1 });
      if (error) throw error;
      toast.success(draft.id ? "Link updated" : "Link added");
      setDraft(null); setBlob(null);
      load();
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  };

  const remove = async (l: LinkRow) => {
    if (!confirm(`Delete "${l.label}"?`)) return;
    const { error } = await db.from("chapter_links").delete().eq("id", l.id);
    if (error) return toast.error(error.message);
    setLinks((x) => x.filter((y) => y.id !== l.id));
    toast.success("Link deleted");
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= links.length) return;
    const next = [...links];
    [next[i], next[j]] = [next[j], next[i]];
    setLinks(next);
    const results = await Promise.all(next.map((l, idx) => db.from("chapter_links").update({ position: idx }).eq("id", l.id)));
    if (results.some((r: any) => r.error)) { toast.error("Could not reorder"); load(); }
  };

  const renderCard = (l: LinkRow, i: number) => {
    const external = !l.url.startsWith("/");
    const inner = (
      <>
        {l.image_url ? (
          <img src={l.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${FALLBACKS[i % FALLBACKS.length]}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
        <div className="relative h-full w-full p-4 flex flex-col justify-between">
          <div className="flex justify-end">
            {external && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-white/90 bg-white/15 backdrop-blur px-2 py-0.5 rounded-full">
                External <ExternalLink className="h-3 w-3" />
              </span>
            )}
          </div>
          <h3 className="text-white font-extrabold text-lg leading-tight drop-shadow">{l.label}</h3>
        </div>
      </>
    );
    const cls = "relative block h-full w-full overflow-hidden rounded-xl";
    return (
      <div key={l.id} className="relative">
        <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-white p-1.5 shadow-md ring-1 ring-black/5 hover:ring-[var(--brand-accent)] hover:shadow-lg transition-all">
          {external ? (
            <a href={l.url} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
          ) : (
            <Link to={l.url as any} className={cls}>{inner}</Link>
          )}
        </div>
        {isAdmin && (
          <div className="absolute top-3 left-3 z-10 flex gap-1">
            {[
              { icon: ArrowUp, label: "Move up", fn: () => move(i, -1), off: i === 0 },
              { icon: ArrowDown, label: "Move down", fn: () => move(i, 1), off: i === links.length - 1 },
              { icon: Pencil, label: "Edit", fn: () => openDraft(l), off: false },
              { icon: Trash2, label: "Delete", fn: () => remove(l), off: false },
            ].map(({ icon: Icon, label, fn, off }) => (
              <button key={label} onClick={fn} disabled={off} aria-label={label}
                className="h-7 w-7 grid place-items-center rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur disabled:opacity-30">
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const previewImg = blob?.preview ?? draft?.image_url;

  return (
    <AppLayout title="Links" subtitle="Quick access to chapter resources.">
      {isAdmin && (
        <div className="px-4 mt-4">
          <Button onClick={() => openDraft({ label: "", url: "", image_url: null })} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Add link
          </Button>
        </div>
      )}
      <section className="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {links.map(renderCard)}
      </section>
      {links.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No links yet.</p>}

      <Dialog open={!!draft && !cropSrc} onOpenChange={(o) => { if (!o) { setDraft(null); setBlob(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit link" : "Add link"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <Input placeholder="Name, e.g. Equity Careers" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
              <Input placeholder="Web address, e.g. https://example.com" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
              <label className="relative block aspect-[3/2] rounded-xl overflow-hidden border border-dashed border-border cursor-pointer bg-muted">
                {previewImg ? <img src={previewImg} alt="" className="h-full w-full object-cover" /> : (
                  <span className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                    <span className="flex items-center gap-2"><ImagePlus className="h-4 w-4" /> Add background photo</span>
                  </span>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={onFile} />
              </label>
              {previewImg && (
                <button className="text-xs text-muted-foreground underline" onClick={() => { setBlob(null); setDraft({ ...draft, image_url: null }); }}>
                  Remove photo
                </button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cropSrc} onOpenChange={(o) => { if (!o) setCropSrc(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Crop background (3:2)</DialogTitle></DialogHeader>
          <div className="relative w-full h-72 bg-black rounded-md overflow-hidden">
            {cropSrc && <Cropper image={cropSrc} crop={crop} zoom={zoom} aspect={ASPECT} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} objectFit="contain" />}
          </div>
          <Slider value={[zoom]} min={1} max={4} step={0.01} onValueChange={(v) => setZoom(v[0])} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCropSrc(null)}>Cancel</Button>
            <Button onClick={confirmCrop} disabled={!area}>Use photo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
