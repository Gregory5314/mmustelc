import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImagePlus, Plus, Trash2, Eye, EyeOff } from "lucide-react";

export type SectionKind = "image" | "solid" | "gradient";

export type ChapterSection = {
  id: string;
  title: string;
  body: string | null;
  bg_kind: SectionKind;
  bg_image_url: string | null;
  bg_color: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  text_color: string | null;
  position: number;
  is_active: boolean;
};

export function sectionStyle(s: ChapterSection): React.CSSProperties {
  const base: React.CSSProperties = { color: s.text_color ?? "#ffffff" };
  if (s.bg_kind === "image" && s.bg_image_url) {
    return {
      ...base,
      backgroundImage: `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)), url("${s.bg_image_url}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  if (s.bg_kind === "gradient") {
    return {
      ...base,
      backgroundImage: `linear-gradient(135deg, ${s.gradient_from ?? "#c81e3a"}, ${s.gradient_to ?? "#1e40af"})`,
    };
  }
  return { ...base, backgroundColor: s.bg_color ?? "#0f3460" };
}

const empty = {
  title: "",
  body: "",
  bg_kind: "gradient" as SectionKind,
  bg_image_url: null as string | null,
  bg_color: "#0f3460",
  gradient_from: "#c81e3a",
  gradient_to: "#1e40af",
  text_color: "#ffffff",
};

export function ChapterSectionsAdmin() {
  const [rows, setRows] = useState<ChapterSection[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    supabase
      .from("chapter_sections")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data }) => setRows((data ?? []) as ChapterSection[]));

  useEffect(() => {
    load();
  }, []);

  const uploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image");
    if (f.size > 8 * 1024 * 1024) return toast.error("Image must be under 8MB");
    setBusy(true);
    try {
      const ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `chapter/sections/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, f, { contentType: f.type, cacheControl: "31536000" });
      if (error) throw error;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      setForm((p) => ({ ...p, bg_image_url: url, bg_kind: "image" }));
      toast.success("Background image ready");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!form.title.trim()) return toast.error("Add a section title");
    if (form.bg_kind === "image" && !form.bg_image_url)
      return toast.error("Upload a background photo first");
    setBusy(true);
    const { error } = await supabase.from("chapter_sections").insert({
      ...form,
      title: form.title.trim(),
      body: form.body.trim() || null,
      position: rows.length,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setForm({ ...empty });
    toast.success("Section added");
    load();
  };

  const toggle = async (row: ChapterSection) => {
    const { error } = await supabase
      .from("chapter_sections")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (row: ChapterSection) => {
    if (!confirm(`Delete "${row.title}"?`)) return;
    const { error } = await supabase.from("chapter_sections").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Section deleted");
    load();
  };

  return (
    <section className="px-4 mt-4">
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-sm font-extrabold text-[var(--brand)]">Chapter Profile Sections</p>
        <p className="text-xs text-muted-foreground mb-3">
          Extra slots shown to members on the Chapter Profile page. Pick a background photo, solid
          colour, or gradient for each slot.
        </p>

        <div className="space-y-2">
          <input
            placeholder="Section title (e.g. Core Values)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <textarea
            rows={3}
            placeholder="Section text"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />

          <div className="flex gap-2">
            {(["image", "solid", "gradient"] as SectionKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setForm({ ...form, bg_kind: k })}
                className={`flex-1 text-xs font-bold py-2 rounded-lg border capitalize ${
                  form.bg_kind === k
                    ? "bg-[var(--brand)] text-brand-foreground border-transparent"
                    : "border-border text-muted-foreground"
                }`}
              >
                {k === "image" ? "Photo" : k}
              </button>
            ))}
          </div>

          {form.bg_kind === "image" && (
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadBg} />
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 bg-[var(--brand)] text-brand-foreground text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-60"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {form.bg_image_url ? "Change photo" : "Upload photo"}
              </button>
              {form.bg_image_url && (
                <img src={form.bg_image_url} alt="" className="h-10 w-16 rounded object-cover" />
              )}
            </div>
          )}

          {form.bg_kind === "solid" && (
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              Background colour
              <input
                type="color"
                value={form.bg_color}
                onChange={(e) => setForm({ ...form, bg_color: e.target.value })}
                className="h-8 w-12 rounded border border-border bg-transparent"
              />
            </label>
          )}

          {form.bg_kind === "gradient" && (
            <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
              <label className="flex items-center gap-2">
                From
                <input
                  type="color"
                  value={form.gradient_from}
                  onChange={(e) => setForm({ ...form, gradient_from: e.target.value })}
                  className="h-8 w-12 rounded border border-border bg-transparent"
                />
              </label>
              <label className="flex items-center gap-2">
                To
                <input
                  type="color"
                  value={form.gradient_to}
                  onChange={(e) => setForm({ ...form, gradient_to: e.target.value })}
                  className="h-8 w-12 rounded border border-border bg-transparent"
                />
              </label>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            Text colour
            <input
              type="color"
              value={form.text_color}
              onChange={(e) => setForm({ ...form, text_color: e.target.value })}
              className="h-8 w-12 rounded border border-border bg-transparent"
            />
          </label>

          <div
            className="rounded-xl p-4 min-h-20"
            style={sectionStyle({ ...(form as any), id: "preview", position: 0, is_active: true })}
          >
            <p className="font-extrabold">{form.title || "Section preview"}</p>
            <p className="text-xs opacity-90 whitespace-pre-line">{form.body || "Your text appears here."}</p>
          </div>

          <button
            type="button"
            onClick={add}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-1.5 bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> Add section
          </button>
        </div>

        {rows.length > 0 && (
          <div className="mt-4 space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-2 border border-border rounded-lg p-2">
                <div className="h-9 w-14 rounded" style={sectionStyle(r)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {r.bg_kind === "image" ? "photo" : r.bg_kind} · {r.is_active ? "visible" : "hidden"}
                  </p>
                </div>
                <button type="button" onClick={() => toggle(r)} className="p-2 text-muted-foreground" aria-label="Toggle visibility">
                  {r.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => remove(r)} className="p-2 text-destructive" aria-label="Delete section">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
