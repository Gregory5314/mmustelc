import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { SECURITY_QUESTIONS } from "@/lib/security-questions";
import { ChevronLeft, Save, Camera, KeyRound, User as UserIcon, Lock, ShieldQuestion } from "lucide-react";

export const Route = createFileRoute("/profile/edit")({
  head: () => ({
    meta: [
      { title: "Edit Profile — MMUST ELP" },
      { name: "description", content: "Update your personal information." },
    ],
  }),
  component: EditProfile,
});

type Form = {
  course: string;
  phone: string;
  email: string;
  mentoring_school: string;
};

const fields: { key: keyof Form; label: string; type?: string; inputMode?: "text" | "email" | "tel" }[] = [
  { key: "course", label: "Course" },
  { key: "phone", label: "Phone Number", type: "tel", inputMode: "tel" },
  { key: "email", label: "Email Address", type: "email", inputMode: "email" },
];

function EditProfile() {
  const { user } = useAuth();
  const { roles } = usePermissions();
  const canEditMentoringSchool = roles.includes("mentorship_coordinator") || roles.includes("president");
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [scholarCode, setScholarCode] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [values, setValues] = useState<Form>({
    course: "", phone: "", email: "", mentoring_school: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);

  const [sq, setSq] = useState({ q1: "", a1: "", q2: "", a2: "" });
  const [sqSaving, setSqSaving] = useState(false);

  const [emailOptIn, setEmailOptIn] = useState(false);
  const [isAdminLike, setIsAdminLike] = useState(false);
  const [savingOptIn, setSavingOptIn] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("get_my_profile").then(({ data }) => {
      const row = (Array.isArray(data) ? data[0] : data) as null | {
        full_name?: string; scholar_code?: string; course?: string | null;
        phone?: string | null; email?: string | null; mentoring_school?: string | null;
        avatar_url?: string | null; email_opt_in?: boolean;
      };
      if (!row) return;
      setFullName(row.full_name ?? "");
      setScholarCode(row.scholar_code ?? "");
      setValues({
        course: row.course ?? "",
        phone: row.phone ?? "",
        email: row.email ?? "",
        mentoring_school: row.mentoring_school ?? "",
      });
      setAvatarUrl(row.avatar_url ?? null);
      setEmailOptIn(!!row.email_opt_in);
    });
    // Show the email toggle only if the user has at least one role other than plain "member"
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      const roles = (data ?? []).map((r) => r.role);
      setIsAdminLike(roles.some((r) => r !== "member"));
    });
    supabase.from("security_answers").select("question_key, created_at")
      .eq("user_id", user.id).order("created_at").then(({ data }) => {
        const keys = (data ?? []).map((r) => r.question_key);
        if (keys.length) setSq((s) => ({ ...s, q1: keys[0] ?? "", q2: keys[1] ?? "" }));
      });
  }, [user]);

  const onSaveSecurityQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sq.q1 || !sq.q2) return toast.error("Pick two questions");
    if (sq.q1 === sq.q2) return toast.error("Pick two different questions");
    if (!sq.a1.trim() || !sq.a2.trim()) return toast.error("Both answers are required");
    setSqSaving(true);
    const { error } = await supabase.rpc("save_security_answers", {
      _q1: sq.q1, _a1: sq.a1.trim(), _q2: sq.q2, _a2: sq.a2.trim(),
    });
    setSqSaving(false);
    if (error) return toast.error(error.message);
    setSq((s) => ({ ...s, a1: "", a2: "" }));
    toast.success("Security questions updated");
  };

  const toggleEmailOptIn = async (next: boolean) => {
    if (!user) return;
    setSavingOptIn(true);
    setEmailOptIn(next);
    const { error } = await supabase.from("profiles")
      .update({ email_opt_in: next } as never)
      .eq("id", user.id);
    setSavingOptIn(false);
    if (error) {
      setEmailOptIn(!next);
      return toast.error(error.message);
    }
    toast.success(next ? "Email notifications enabled" : "Email notifications disabled");
  };


  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const payload: Partial<Form> = {
      course: values.course,
      phone: values.phone,
      email: values.email,
    };
    if (canEditMentoringSchool) payload.mentoring_school = values.mentoring_school;
    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    navigate({ to: "/profile" });
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      cacheControl: "3600", upsert: true, contentType: file.type,
    });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error: updErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    setUploading(false);
    if (updErr) return toast.error(updErr.message);
    setAvatarUrl(url);
    toast.success("Profile picture updated");
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next.length < 6) return toast.error("Password must be at least 6 characters");
    if (pw.next !== pw.confirm) return toast.error("Passwords do not match");
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setPwSaving(false);
    if (error) return toast.error(error.message);
    setPw({ next: "", confirm: "" });
    toast.success("Password changed");
  };

  return (
    <AppLayout title="Edit Profile" subtitle="Update your personal information.">
      <Toaster position="top-center" />
      <div className="px-4 mt-3">
        <Link to="/profile" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand)]">
          <ChevronLeft className="h-4 w-4" /> Back to profile
        </Link>
      </div>

      <section className="px-4 mt-3">
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 shadow-sm">
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="h-20 w-20 rounded-xl object-cover" />
          ) : (
            <div className="h-20 w-20 rounded-xl bg-[var(--brand)] text-brand-foreground flex items-center justify-center">
              <UserIcon className="h-8 w-8" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Profile Picture</p>
            <p className="text-xs text-muted-foreground">JPG or PNG, up to 5MB</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="mt-2 inline-flex items-center gap-1.5 bg-[var(--brand)] text-brand-foreground text-xs font-bold px-3 py-1.5 rounded-lg shadow disabled:opacity-60">
              <Camera className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Change"}
            </button>
          </div>
        </div>
      </section>

      <form onSubmit={onSave} className="px-4 mt-3 space-y-3" noValidate>
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-sm">
          <ReadOnly label="FULL NAME" value={fullName || "—"} hint="Name is set by the chapter administrator." />
          <ReadOnly label="SCHOLAR CODE" value={scholarCode || "—"} hint="Issued by the chapter — cannot be changed." />
          {fields.map((f) => (
            <div key={f.key}>
              <label className="text-[10px] font-semibold tracking-wider text-muted-foreground">{f.label.toUpperCase()}</label>
              <input
                type={f.type ?? "text"}
                inputMode={f.inputMode}
                value={values[f.key]}
                maxLength={160}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              />
            </div>
          ))}
          <div>
            <label className="text-[10px] font-semibold tracking-wider text-muted-foreground flex items-center gap-1">
              MENTORING SCHOOL {!canEditMentoringSchool && <Lock className="h-3 w-3" />}
            </label>
            <input
              type="text"
              value={values.mentoring_school}
              maxLength={160}
              disabled={!canEditMentoringSchool}
              onChange={(e) => setValues({ ...values, mentoring_school: e.target.value })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand)] disabled:opacity-70 disabled:cursor-not-allowed"
            />
            {!canEditMentoringSchool && (
              <p className="mt-1 text-[11px] text-muted-foreground">Assigned by the Mentorship Coordinator.</p>
            )}
          </div>
        </div>
        <button type="submit" disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 bg-[var(--brand)] text-brand-foreground font-bold py-3 rounded-lg shadow hover:bg-[var(--brand-deep)] transition-colors disabled:opacity-60">
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <section className="px-4 mt-6 mb-4">
        <form onSubmit={onChangePassword} className="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-sm">
          <h3 className="text-base font-extrabold text-[var(--brand)] flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Change Password
          </h3>
          <div>
            <label className="text-[10px] font-semibold tracking-wider text-muted-foreground">NEW PASSWORD</label>
            <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })}
              minLength={6} required
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-semibold tracking-wider text-muted-foreground">CONFIRM PASSWORD</label>
            <input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              minLength={6} required
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={pwSaving}
            className="w-full bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg shadow disabled:opacity-60">
            {pwSaving ? "Updating…" : "Update Password"}
          </button>
        </form>
      </section>

      {isAdminLike && (
        <section className="px-4 mt-2 mb-6">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <h3 className="text-base font-extrabold text-[var(--brand)]">Notification Preferences</h3>
            <p className="text-xs text-muted-foreground mt-1">
              In-dashboard notifications are always on. Choose whether to also receive email alerts for events
              your role can act on (events, finance, complaints, etc.).
            </p>
            <label className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">Email me about dashboard alerts</span>
              <input
                type="checkbox"
                checked={emailOptIn}
                disabled={savingOptIn}
                onChange={(e) => toggleEmailOptIn(e.target.checked)}
                className="h-5 w-5 accent-[var(--brand)]"
              />
            </label>
          </div>
        </section>
      )}
    </AppLayout>
  );
}

function ReadOnly({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <label className="text-[10px] font-semibold tracking-wider text-muted-foreground flex items-center gap-1">
        {label} <Lock className="h-3 w-3" />
      </label>
      <div className="mt-1 w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm font-semibold text-foreground">
        {value}
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
