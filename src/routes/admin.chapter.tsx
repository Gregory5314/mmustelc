import { createFileRoute } from "@tanstack/react-router";
import { PermissionGate } from "@/components/AppLayout";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ImagePlus, Crop as CropIcon } from "lucide-react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ChapterSectionsAdmin } from "@/components/ChapterSectionsAdmin";

export const Route = createFileRoute("/admin/chapter")({
  head: () => ({ meta: [{ title: "Chapter Profile — MMUST ELP" }] }),
  component: () => (
    <PermissionGate perm="profile.chapter.edit" title="Chapter Profile">
      <Page />
    </PermissionGate>
  ),
});

async function getCroppedBlob(imageSrc: string, crop: Area, mime: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.width);
  canvas.height = Math.round(crop.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), mime, 0.95),
  );
}

function Page() {
  const [id, setId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    motto: "",
    mission: "",
    vision: "",
    about: "",
    contact_email: "",
    contact_phone: "",
  });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<"logo" | "bg">("logo");

  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropMime, setCropMime] = useState("image/png");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const onCropComplete = useCallback((_: Area, px: Area) => setCroppedArea(px), []);


  const load = () =>
    supabase.rpc("get_chapter_admin").then(({ data }) => {
      const row = (Array.isArray(data) ? data[0] : data) as null | {
        id: string; logo_url?: string | null; name?: string | null;
        motto?: string | null; mission?: string | null; vision?: string | null; about?: string | null;
        contact_email?: string | null; contact_phone?: string | null;
        login_bg_url?: string | null;
      };
      if (row) {
        setId(row.id);
        setLogoUrl(row.logo_url ?? null);
        setBgUrl(row.login_bg_url ?? null);
        setForm({
          name: row.name ?? "",
          motto: row.motto ?? "",
          mission: row.mission ?? "",
          vision: row.vision ?? "",
          about: row.about ?? "",
          contact_email: row.contact_email ?? "",
          contact_phone: row.contact_phone ?? "",
        });
      }
    });
  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const { error } = await supabase
      .from("chapter_profile")
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Chapter profile updated.");
  };

  const pickFile = (which: "logo" | "bg") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image");
    if (f.size > 8 * 1024 * 1024) return toast.error("Image must be under 8MB");
    const reader = new FileReader();
    reader.onload = () => {
      setTarget(which);
      setCropSrc(reader.result as string);
      setCropMime(f.type);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedArea(null);
      setCropOpen(true);
    };
    reader.readAsDataURL(f);
  };

  const onFile = pickFile("logo");

  const confirmCrop = async () => {
    if (!id || !cropSrc || !croppedArea) return;
    setUploading(true);
    setCropOpen(false);
    try {
      const blob = await getCroppedBlob(cropSrc, croppedArea, cropMime);
      const ext = (cropMime.split("/")[1] || "png").replace("jpeg", "jpg");
      const path = `chapter/${target === "bg" ? "login-bg" : "logo"}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: cropMime, cacheControl: "31536000" });
      if (upErr) throw upErr;
      const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const patch = target === "bg" ? { login_bg_url: publicUrl } : { logo_url: publicUrl };
      const { error } = await supabase
        .from("chapter_profile")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      if (target === "bg") setBgUrl(publicUrl);
      else setLogoUrl(publicUrl);
      toast.success(target === "bg" ? "Login background updated." : "Chapter logo updated.");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      setCropSrc(null);
    }
  };

  const removeBg = async () => {
    if (!id) return;
    const { error } = await supabase
      .from("chapter_profile")
      .update({ login_bg_url: null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setBgUrl(null);
    toast.success("Login background removed.");
  };


  return (
    <>
      <Toaster />
      <section className="px-4 mt-4">
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-muted overflow-hidden flex items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt="Chapter logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-[10px] text-muted-foreground">No logo</span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-[var(--brand)]">Chapter Logo</p>
            <p className="text-xs text-muted-foreground mb-2">Upload & crop a logo (PNG/JPG, max 5MB)</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFile}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 bg-[var(--brand)] text-brand-foreground text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-60"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {uploading ? "Uploading…" : logoUrl ? "Change logo" : "Upload logo"}
            </button>
          </div>
        </div>
      </section>

      <section className="px-4 mt-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-sm font-extrabold text-[var(--brand)]">Login Background</p>
          <p className="text-xs text-muted-foreground mb-3">
            Shown behind the sign-in and sign-up screens (crop 9:16, max 8MB)
          </p>
          <div className="aspect-[9/16] max-h-56 w-full rounded-xl bg-muted overflow-hidden flex items-center justify-center mb-3">
            {bgUrl ? (
              <img src={bgUrl} alt="Login background" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[11px] text-muted-foreground">No background set</span>
            )}
          </div>
          <input
            ref={bgFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={pickFile("bg")}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => bgFileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 bg-[var(--brand)] text-brand-foreground text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-60"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {uploading ? "Uploading…" : bgUrl ? "Change background" : "Upload background"}
            </button>
            {bgUrl && (
              <button
                type="button"
                onClick={removeBg}
                className="text-xs font-bold px-3 py-2 rounded-lg border border-border text-muted-foreground"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </section>



      <section className="px-4 mt-4 pb-4">
        <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <input
            required
            placeholder="Chapter name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="Motto"
            value={form.motto}
            onChange={(e) => setForm({ ...form, motto: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Mission"
            rows={3}
            value={form.mission}
            onChange={(e) => setForm({ ...form, mission: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Vision"
            rows={3}
            value={form.vision}
            onChange={(e) => setForm({ ...form, vision: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <textarea
            placeholder="About"
            rows={4}
            value={form.about}
            onChange={(e) => setForm({ ...form, about: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="email"
            placeholder="Contact email"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="Contact phone"
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <button className="w-full bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg">
            Save
          </button>
        </form>
      </section>

      <ChapterSectionsAdmin />

      <Dialog open={cropOpen} onOpenChange={(o) => { if (!o) { setCropOpen(false); setCropSrc(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CropIcon className="h-4 w-4" /> {target === "bg" ? "Crop background (9:16)" : "Crop logo (1:1)"}</DialogTitle>
          </DialogHeader>
          <div className="relative w-full h-72 bg-black rounded-md overflow-hidden">
            {cropSrc && (
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={target === "bg" ? 9 / 16 : 1}
                cropShape={target === "bg" ? "rect" : "round"}
                showGrid={false}

                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                objectFit="contain"
              />
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Zoom</label>
            <Slider value={[zoom]} min={1} max={4} step={0.01} onValueChange={(v) => setZoom(v[0])} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCropOpen(false)}>Cancel</Button>
            <Button onClick={confirmCrop} disabled={!croppedArea}>{target === "bg" ? "Save background" : "Save logo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
