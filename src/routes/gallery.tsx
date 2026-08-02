import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Upload, Download, Trash2, Image as ImageIcon, X, Loader2, Heart, MessageCircle,
  ChevronLeft, ChevronRight, Send,
} from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import useEmblaCarousel from "embla-carousel-react";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Chapter Photo Gallery — MMUST ELP" },
      { name: "description", content: "Chapter photo gallery — share, react, and relive chapter moments together." },
    ],
  }),
  component: GalleryPage,
});

type Photo = {
  id: string;
  album_id: string | null;
  uploader_id: string;
  storage_path: string;
  public_url: string;
  caption: string | null;
  title: string | null;
  file_name: string | null;
  position: number;
  taken_at: string;
};

type Album = {
  id: string;
  uploader_id: string;
  title: string;
  created_at: string;
  photos: Photo[];
  uploader_name?: string;
  reactionCount: number;
  reacted: boolean;
  commentCount: number;
};

type Comment = {
  id: string;
  album_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: string;
};

const BUCKET = "event_photos";

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  const name = new Date(y, (m ?? 1) - 1, 1).toLocaleString(undefined, { month: "long" });
  return `${name} Moments · ${y}`;
}

function GalleryPage() {
  const { user, isAdmin } = useAuth();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [orphans, setOrphans] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [zipping, setZipping] = useState<string | null>(null);

  // Upload dialog
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadTitle, setUploadTitle] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Lightbox (album viewer)
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);
  const [openIndex, setOpenIndex] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: photosRaw },
      { data: albumsRaw },
      { data: reactionsRaw },
      { data: commentsRaw },
    ] = await Promise.all([
      supabase.from("gallery_photos")
        .select("id,album_id,uploader_id,storage_path,public_url,caption,title,file_name,position,taken_at")
        .order("taken_at", { ascending: false })
        .order("position", { ascending: true }),
      (supabase as any).from("gallery_albums")
        .select("id,uploader_id,title,created_at")
        .order("created_at", { ascending: false }),
      (supabase as any).from("gallery_reactions").select("album_id,user_id"),
      (supabase as any).from("gallery_comments").select("album_id"),
    ]);

    const photos = (photosRaw ?? []) as Photo[];
    const uploaderIds = Array.from(new Set(photos.map((p) => p.uploader_id)));
    const { data: profiles } = uploaderIds.length
      ? await supabase.from("profiles").select("id,full_name").in("id", uploaderIds)
      : { data: [] as any[] };
    const nameMap = new Map<string, string>();
    for (const p of profiles ?? []) nameMap.set((p as any).id, (p as any).full_name || "Member");

    const rxCount = new Map<string, number>();
    const rxMine = new Set<string>();
    for (const r of (reactionsRaw ?? []) as any[]) {
      rxCount.set(r.album_id, (rxCount.get(r.album_id) ?? 0) + 1);
      if (user && r.user_id === user.id) rxMine.add(r.album_id);
    }
    const cmCount = new Map<string, number>();
    for (const c of (commentsRaw ?? []) as any[]) {
      cmCount.set(c.album_id, (cmCount.get(c.album_id) ?? 0) + 1);
    }

    const byAlbum = new Map<string, Photo[]>();
    const orphans: Photo[] = [];
    for (const p of photos) {
      if (p.album_id) {
        if (!byAlbum.has(p.album_id)) byAlbum.set(p.album_id, []);
        byAlbum.get(p.album_id)!.push(p);
      } else {
        orphans.push(p);
      }
    }
    for (const arr of byAlbum.values()) arr.sort((a, b) => a.position - b.position);

    const albums: Album[] = ((albumsRaw ?? []) as any[]).map((a) => ({
      id: a.id,
      uploader_id: a.uploader_id,
      title: a.title,
      created_at: a.created_at,
      photos: byAlbum.get(a.id) ?? [],
      uploader_name: nameMap.get(a.uploader_id),
      reactionCount: rxCount.get(a.id) ?? 0,
      reacted: rxMine.has(a.id),
      commentCount: cmCount.get(a.id) ?? 0,
    })).filter((a) => a.photos.length > 0);

    setAlbums(albums);
    setOrphans(orphans);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onPick = () => fileRef.current?.click();

  const onFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!files.length) return;
    setPendingFiles(files);
    setUploadTitle("");
  };

  const submitUpload = async () => {
    if (!user) return toast.error("Please sign in");
    const title = uploadTitle.trim();
    if (!title) return toast.error("Add a title for your photos");
    if (!pendingFiles.length) return;
    setUploading(true);
    try {
      const { data: album, error: aErr } = await (supabase as any)
        .from("gallery_albums")
        .insert({ uploader_id: user.id, title })
        .select("id")
        .single();
      if (aErr) throw aErr;
      const albumId = album.id as string;

      let ok = 0, fail = 0;
      for (let i = 0; i < pendingFiles.length; i++) {
        const f = pendingFiles[i];
        try {
          const ext = f.name.split(".").pop() || "jpg";
          const path = `gallery/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, f, {
            cacheControl: "31536000", upsert: false, contentType: f.type,
          });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
          const { error: insErr } = await (supabase as any).from("gallery_photos").insert({
            uploader_id: user.id,
            storage_path: path,
            public_url: pub.publicUrl,
            file_name: f.name,
            content_type: f.type,
            size_bytes: f.size,
            album_id: albumId,
            title,
            position: i,
          });
          if (insErr) throw insErr;
          ok++;
        } catch (err) { console.error(err); fail++; }
      }
      if (ok) toast.success(`Shared ${ok} photo${ok > 1 ? "s" : ""} · "${title}"`);
      if (fail) toast.error(`${fail} failed to upload`);
      setPendingFiles([]);
      setUploadTitle("");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const downloadOne = async (p: Photo) => {
    try {
      const res = await fetch(p.public_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = p.file_name || p.storage_path.split("/").pop() || "photo.jpg";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error("Download failed"); }
  };

  const downloadAlbum = async (album: Album) => {
    setZipping(album.id);
    try {
      const zip = new JSZip();
      const folder = zip.folder(album.title) ?? zip;
      await Promise.all(album.photos.map(async (p) => {
        const res = await fetch(p.public_url);
        const blob = await res.blob();
        const name = p.file_name || p.storage_path.split("/").pop() || `${p.id}.jpg`;
        folder.file(name, blob);
      }));
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${album.title}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error("Download failed"); }
    finally { setZipping(null); }
  };

  const toggleReaction = async (album: Album) => {
    if (!user) return toast.error("Sign in to react");
    // optimistic
    setAlbums((prev) => prev.map((a) => a.id === album.id
      ? { ...a, reacted: !a.reacted, reactionCount: a.reactionCount + (a.reacted ? -1 : 1) } : a));
    if (openAlbum?.id === album.id) {
      setOpenAlbum({ ...openAlbum, reacted: !openAlbum.reacted, reactionCount: openAlbum.reactionCount + (openAlbum.reacted ? -1 : 1) });
    }
    if (album.reacted) {
      await (supabase as any).from("gallery_reactions").delete()
        .eq("album_id", album.id).eq("user_id", user.id).eq("emoji", "❤️");
    } else {
      await (supabase as any).from("gallery_reactions").insert({
        album_id: album.id, user_id: user.id, emoji: "❤️",
      });
    }
  };

  const openLightbox = async (album: Album, index = 0) => {
    setOpenAlbum(album);
    setOpenIndex(index);
    setComments([]);
    const { data } = await (supabase as any).from("gallery_comments")
      .select("id,album_id,user_id,body,created_at")
      .eq("album_id", album.id)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as Comment[];
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id,full_name").in("id", ids)
      : { data: [] as any[] };
    const map = new Map<string, string>();
    for (const p of profs ?? []) map.set((p as any).id, (p as any).full_name || "Member");
    setComments(rows.map((r) => ({ ...r, author: map.get(r.user_id) ?? "Member" })));
  };

  const submitComment = async () => {
    if (!user || !openAlbum) return;
    const body = commentText.trim();
    if (!body) return;
    setCommentBusy(true);
    const { data, error } = await (supabase as any).from("gallery_comments").insert({
      album_id: openAlbum.id, user_id: user.id, body,
    }).select("id,album_id,user_id,body,created_at").single();
    setCommentBusy(false);
    if (error) return toast.error(error.message);
    setComments((c) => [...c, { ...(data as Comment), author: "You" }]);
    setCommentText("");
    setAlbums((prev) => prev.map((a) => a.id === openAlbum.id ? { ...a, commentCount: a.commentCount + 1 } : a));
  };

  const deleteComment = async (id: string) => {
    setComments((c) => c.filter((x) => x.id !== id));
    await (supabase as any).from("gallery_comments").delete().eq("id", id);
    if (openAlbum) setAlbums((prev) => prev.map((a) => a.id === openAlbum.id ? { ...a, commentCount: Math.max(0, a.commentCount - 1) } : a));
  };

  const deleteAlbum = async (album: Album) => {
    if (!confirm(`Delete album "${album.title}" and all ${album.photos.length} photos?`)) return;
    await supabase.storage.from(BUCKET).remove(album.photos.map((p) => p.storage_path));
    await (supabase as any).from("gallery_albums").delete().eq("id", album.id);
    toast.success("Album deleted");
    setOpenAlbum(null);
    load();
  };

  const deletePhoto = async (p: Photo) => {
    if (!confirm("Delete this photo?")) return;
    await supabase.storage.from(BUCKET).remove([p.storage_path]);
    await supabase.from("gallery_photos").delete().eq("id", p.id);
    toast.success("Deleted");
    load();
    if (openAlbum) {
      const remaining = openAlbum.photos.filter((x) => x.id !== p.id);
      if (remaining.length === 0) setOpenAlbum(null);
      else { setOpenAlbum({ ...openAlbum, photos: remaining }); setOpenIndex(0); }
    }
  };

  // Group albums by month for section headers
  const groups = new Map<string, Album[]>();
  for (const a of albums) {
    const k = monthKey(a.created_at);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(a);
  }
  // Legacy orphan photos as pseudo-albums grouped by month
  const orphanGroups = new Map<string, Photo[]>();
  for (const p of orphans) {
    const k = monthKey(p.taken_at);
    if (!orphanGroups.has(k)) orphanGroups.set(k, []);
    orphanGroups.get(k)!.push(p);
  }
  const allKeys = Array.from(new Set([...groups.keys(), ...orphanGroups.keys()])).sort((a, b) => (a < b ? 1 : -1));

  return (
    <AppLayout title="Photo Gallery" subtitle="Chapter moments.">
      <div className="px-4 mt-4 flex items-center gap-2">
        <Button onClick={onPick} disabled={uploading} className="bg-[var(--brand)] hover:bg-[var(--brand-deep)]">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Share photos"}
        </Button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFilesPicked} />
        <span className="text-xs text-muted-foreground">HD preserved · add a title</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
      ) : albums.length === 0 && orphans.length === 0 ? (
        <div className="mx-4 mt-6 border-2 border-dashed border-border rounded-2xl py-12 flex flex-col items-center text-muted-foreground">
          <ImageIcon className="h-10 w-10 mb-2" />
          <p className="text-sm">No photos yet. Be the first to share.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-6 pb-10">
          {allKeys.map((k) => {
            const monthAlbums = groups.get(k) ?? [];
            const monthOrphans = orphanGroups.get(k) ?? [];
            return (
              <section key={k} className="px-3">
                <h3 className="px-1 mb-3 text-lg font-extrabold text-[var(--brand)]">{monthLabel(k)}</h3>
                <div className="columns-2 sm:columns-3 md:columns-4 gap-3 [column-fill:_balance]">
                  {monthAlbums.map((album) => (
                    <AlbumPin
                      key={album.id}
                      album={album}
                      onOpen={(i) => openLightbox(album, i)}
                      onReact={() => toggleReaction(album)}
                      onDownload={() => downloadAlbum(album)}
                      zipping={zipping === album.id}
                    />
                  ))}
                  {monthOrphans.map((p) => (
                    <div key={p.id} className="mb-3 break-inside-avoid rounded-2xl overflow-hidden bg-white shadow-md ring-1 ring-black/5">
                      <button onClick={() => openSinglePhoto(p, setOpenAlbum, setOpenIndex, setComments)} className="block w-full">
                        <img src={p.public_url} loading="lazy" alt={p.caption ?? ""}
                             className="w-full h-auto object-cover" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={pendingFiles.length > 0} onOpenChange={(o) => { if (!o && !uploading) { setPendingFiles([]); setUploadTitle(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share {pendingFiles.length} photo{pendingFiles.length > 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>Add a title — it appears at the top of your pin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="e.g. Founders Day 2026"
              maxLength={80}
            />
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pendingFiles.slice(0, 8).map((f, i) => (
                <img key={i} src={URL.createObjectURL(f)} alt="" className="h-16 w-16 rounded-md object-cover ring-1 ring-black/10" />
              ))}
              {pendingFiles.length > 8 && (
                <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center text-xs font-semibold">
                  +{pendingFiles.length - 8}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPendingFiles([]); setUploadTitle(""); }} disabled={uploading}>Cancel</Button>
            <Button onClick={submitUpload} disabled={uploading || !uploadTitle.trim()} className="bg-[var(--brand)] hover:bg-[var(--brand-deep)]">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Share"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {openAlbum && (
        <Lightbox
          album={openAlbum}
          index={openIndex}
          setIndex={setOpenIndex}
          onClose={() => setOpenAlbum(null)}
          onReact={() => toggleReaction(openAlbum)}
          onDownloadOne={(p) => downloadOne(p)}
          onDownloadAll={() => downloadAlbum(openAlbum)}
          zipping={zipping === openAlbum.id}
          canDelete={isAdmin || user?.id === openAlbum.uploader_id}
          onDeletePhoto={deletePhoto}
          onDeleteAlbum={() => deleteAlbum(openAlbum)}
          comments={comments}
          commentText={commentText}
          setCommentText={setCommentText}
          submitComment={submitComment}
          commentBusy={commentBusy}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          onDeleteComment={deleteComment}
        />
      )}
    </AppLayout>
  );
}

function openSinglePhoto(
  p: Photo,
  setOpenAlbum: (a: Album | null) => void,
  setOpenIndex: (n: number) => void,
  setComments: (c: Comment[]) => void,
) {
  setOpenAlbum({
    id: `orphan-${p.id}`,
    uploader_id: p.uploader_id,
    title: p.caption ?? "Chapter moment",
    created_at: p.taken_at,
    photos: [p],
    reactionCount: 0,
    reacted: false,
    commentCount: 0,
  });
  setOpenIndex(0);
  setComments([]);
}

function AlbumPin({
  album, onOpen, onReact, onDownload, zipping,
}: {
  album: Album;
  onOpen: (index: number) => void;
  onReact: () => void;
  onDownload: () => void;
  zipping: boolean;
}) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: false, dragFree: false });
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (!embla) return;
    const onSel = () => setCurrent(embla.selectedScrollSnap());
    embla.on("select", onSel);
    onSel();
    return () => { embla.off("select", onSel); };
  }, [embla]);

  const multi = album.photos.length > 1;

  return (
    <div className="mb-3 break-inside-avoid rounded-2xl overflow-hidden bg-white shadow-md ring-1 ring-black/5 hover:ring-[var(--brand-accent)] hover:shadow-xl transition-all">
      <div className="px-3 pt-2.5 pb-1.5">
        <p className="text-sm font-bold text-[var(--brand)] leading-tight line-clamp-2">{album.title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {album.uploader_name ?? "Member"} · {album.photos.length} photo{album.photos.length > 1 ? "s" : ""}
        </p>
      </div>
      <div className="relative">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {album.photos.map((p, i) => (
              <div key={p.id} className="min-w-0 shrink-0 grow-0 basis-full">
                <button onClick={() => onOpen(i)} className="block w-full">
                  <img src={p.public_url} loading="lazy" alt={album.title}
                       className="w-full h-auto object-cover" />
                </button>
              </div>
            ))}
          </div>
        </div>
        {multi && (
          <>
            <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
              {current + 1}/{album.photos.length}
            </div>
            <button
              onClick={() => embla?.scrollPrev()}
              className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
              aria-label="Previous"
            ><ChevronLeft className="h-4 w-4" /></button>
            <button
              onClick={() => embla?.scrollNext()}
              className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
              aria-label="Next"
            ><ChevronRight className="h-4 w-4" /></button>
          </>
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center gap-3">
          <button onClick={onReact} className="flex items-center gap-1 text-xs font-semibold">
            <Heart className={`h-4 w-4 ${album.reacted ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
            <span>{album.reactionCount}</span>
          </button>
          <button onClick={() => onOpen(0)} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <MessageCircle className="h-4 w-4" /> <span>{album.commentCount}</span>
          </button>
        </div>
        <button onClick={onDownload} disabled={zipping}
          className="text-[11px] font-semibold text-[var(--brand-accent)] inline-flex items-center gap-1 disabled:opacity-50">
          {zipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {zipping ? "…" : (multi ? "All" : "Save")}
        </button>
      </div>
    </div>
  );
}

function Lightbox({
  album, index, setIndex, onClose, onReact, onDownloadOne, onDownloadAll, zipping,
  canDelete, onDeletePhoto, onDeleteAlbum,
  comments, commentText, setCommentText, submitComment, commentBusy,
  currentUserId, isAdmin, onDeleteComment,
}: {
  album: Album;
  index: number;
  setIndex: (n: number) => void;
  onClose: () => void;
  onReact: () => void;
  onDownloadOne: (p: Photo) => void;
  onDownloadAll: () => void;
  zipping: boolean;
  canDelete: boolean;
  onDeletePhoto: (p: Photo) => void;
  onDeleteAlbum: () => void;
  comments: Comment[];
  commentText: string;
  setCommentText: (s: string) => void;
  submitComment: () => void;
  commentBusy: boolean;
  currentUserId?: string;
  isAdmin: boolean;
  onDeleteComment: (id: string) => void;
}) {
  const [emblaRef, embla] = useEmblaCarousel({ startIndex: index });
  useEffect(() => {
    if (!embla) return;
    const onSel = () => setIndex(embla.selectedScrollSnap());
    embla.on("select", onSel);
    return () => { embla.off("select", onSel); };
  }, [embla, setIndex]);

  const current = album.photos[index];
  const [showComments, setShowComments] = useState(false);
  const multi = album.photos.length > 1;

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 text-white gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">{album.title}</p>
          <p className="text-[11px] opacity-70">{index + 1} / {album.photos.length}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onReact} className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-white/10">
            <Heart className={`h-4 w-4 ${album.reacted ? "fill-red-500 text-red-500" : ""}`} />
            <span className="text-xs font-semibold">{album.reactionCount}</span>
          </button>
          <button onClick={() => setShowComments((s) => !s)} className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-white/10">
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs font-semibold">{comments.length}</span>
          </button>
          <button onClick={() => current && onDownloadOne(current)} className="p-2 rounded-md hover:bg-white/10" aria-label="Save">
            <Download className="h-4 w-4" />
          </button>
          {multi && (
            <button onClick={onDownloadAll} disabled={zipping} className="text-[11px] font-semibold px-2 py-1.5 rounded-md hover:bg-white/10 disabled:opacity-50">
              {zipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save all"}
            </button>
          )}
          {canDelete && current && (
            <button onClick={() => onDeletePhoto(current)} className="p-2 rounded-md hover:bg-red-500/20 text-red-300" aria-label="Delete photo">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {canDelete && multi && (
            <button onClick={onDeleteAlbum} className="text-[11px] font-semibold px-2 py-1.5 rounded-md hover:bg-red-500/20 text-red-300">
              Delete album
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-md hover:bg-white/10" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 relative">
          <div ref={emblaRef} className="h-full overflow-hidden">
            <div className="flex h-full">
              {album.photos.map((p) => (
                <div key={p.id} className="min-w-0 shrink-0 grow-0 basis-full h-full flex items-center justify-center p-3">
                  <img src={p.public_url} alt={album.title} className="max-h-full max-w-full object-contain rounded-md shadow-2xl" />
                </div>
              ))}
            </div>
          </div>
          {multi && (
            <>
              <button onClick={() => embla?.scrollPrev()}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={() => embla?.scrollNext()}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2">
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {showComments && (
          <aside className="w-full max-w-sm bg-neutral-900 text-white border-l border-white/10 hidden sm:flex sm:flex-col">
            <CommentsPanel
              comments={comments} commentText={commentText} setCommentText={setCommentText}
              submitComment={submitComment} commentBusy={commentBusy}
              currentUserId={currentUserId} isAdmin={isAdmin} onDeleteComment={onDeleteComment}
            />
          </aside>
        )}
      </div>

      {/* Mobile comments drawer */}
      {showComments && (
        <div className="sm:hidden bg-neutral-900 text-white border-t border-white/10 max-h-[45vh] flex flex-col">
          <CommentsPanel
            comments={comments} commentText={commentText} setCommentText={setCommentText}
            submitComment={submitComment} commentBusy={commentBusy}
            currentUserId={currentUserId} isAdmin={isAdmin} onDeleteComment={onDeleteComment}
          />
        </div>
      )}
    </div>
  );
}

function CommentsPanel({
  comments, commentText, setCommentText, submitComment, commentBusy,
  currentUserId, isAdmin, onDeleteComment,
}: {
  comments: Comment[];
  commentText: string;
  setCommentText: (s: string) => void;
  submitComment: () => void;
  commentBusy: boolean;
  currentUserId?: string;
  isAdmin: boolean;
  onDeleteComment: (id: string) => void;
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {comments.length === 0 ? (
          <p className="text-xs text-white/50 text-center py-6">Be the first to comment.</p>
        ) : comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            <div className="h-7 w-7 rounded-full bg-[var(--brand)] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              {(c.author ?? "M").slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white/60">
                <span className="font-semibold text-white/90">{c.author}</span> · {new Date(c.created_at).toLocaleString()}
              </p>
              <p className="text-sm break-words">{c.body}</p>
            </div>
            {(currentUserId === c.user_id || isAdmin) && (
              <button onClick={() => onDeleteComment(c.id)} className="p-1 text-white/40 hover:text-red-400" aria-label="Delete comment">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-white/10 flex items-end gap-2">
        <Textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment…"
          rows={1}
          className="bg-white/10 border-white/10 text-white placeholder:text-white/40 resize-none min-h-[38px]"
        />
        <Button onClick={submitComment} disabled={commentBusy || !commentText.trim()} size="icon"
          className="bg-[var(--brand)] hover:bg-[var(--brand-deep)]">
          {commentBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </>
  );
}
