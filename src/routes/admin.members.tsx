import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createMember, deleteMember, assignRole, removeRole, getMemberProfile, updateMemberProfile } from "@/lib/admin.functions";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Trash2, BarChart3, ArrowUpDown, Shield, X, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/roles";

export const Route = createFileRoute("/admin/members")({
  head: () => ({ meta: [{ title: "Manage Members — MMUST ELP" }] }),
  component: AdminMembers,
});

type Row = { id: string; full_name: string; scholar_code: string; course: string | null };

function AdminMembers() {
  const { isAdmin, isLoading } = useAuth();
  const { roles } = usePermissions();
  const isPresident = roles.includes("president");
  const navigate = useNavigate();
  const create = useServerFn(createMember);
  const remove = useServerFn(deleteMember);
  const assign = useServerFn(assignRole);
  const unassign = useServerFn(removeRole);
  const loadProfile = useServerFn(getMemberProfile);
  const saveProfile = useServerFn(updateMemberProfile);
  const [editOpen, setEditOpen] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<null | {
    scholarCode: string; fullName: string; email: string; phone: string;
    course: string; mentoringSchool: string; year: string;
  }>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const [rows, setRows] = useState<Row[]>([]);
  const [rolesMap, setRolesMap] = useState<Record<string, string[]>>({});
  const [roleBusy, setRoleBusy] = useState<string | null>(null);
  const [activity, setActivity] = useState<{ id: string; name: string; count: number }[]>([]);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [form, setForm] = useState({
    scholarCode: "", password: "", fullName: "",
    email: "", phone: "", course: "", mentoringSchool: "",
    role: "member" as (typeof ASSIGNABLE_ROLES)[number],
    year: "" as string,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAdmin && !isPresident) navigate({ to: "/", replace: true });
  }, [isAdmin, isPresident, isLoading, navigate]);

  const refresh = () => {
    supabase
      .rpc("list_members_manage")
      .then(({ data }) => {

        const list = (data ?? []) as Row[];
        setRows(list);
        supabase.from("user_roles").select("user_id, role").then(({ data: rs }) => {
          const map: Record<string, string[]> = {};
          (rs ?? []).forEach((r: { user_id: string; role: string }) => {
            (map[r.user_id] ||= []).push(r.role);
          });
          setRolesMap(map);
        });
        supabase
          .from("subscriptions")
          .select("profile_id, status")
          .eq("status", "active")
          .then(({ data: subs }) => {
            const activeIds = new Set((subs ?? []).map((s: { profile_id: string }) => s.profile_id));
            supabase
              .from("events_attended")
              .select("profile_id")
              .then(({ data: att }) => {
                const counts = new Map<string, number>();
                (att ?? []).forEach((r: { profile_id: string }) => {
                  counts.set(r.profile_id, (counts.get(r.profile_id) ?? 0) + 1);
                });
                setActivity(
                  list
                    .filter((m) => activeIds.has(m.id))
                    .map((m) => ({
                      id: m.id,
                      name: m.full_name || m.scholar_code,
                      count: counts.get(m.id) ?? 0,
                    })),
                );
              });
          });
      });
  };
  useEffect(() => { if (isAdmin || isPresident) refresh(); }, [isAdmin, isPresident]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null); setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        scholarCode: form.scholarCode, password: form.password, fullName: form.fullName,
        email: form.email, phone: form.phone, course: form.course,
        mentoringSchool: form.mentoringSchool, role: form.role,
      };
      if (form.year) payload.year = Number(form.year);
      await create({ data: payload });
      setSuccess(`Member ${form.fullName} created as ${roleLabel(form.role)}. Share their scholar code & password to sign in.`);
      setForm({ scholarCode: "", password: "", fullName: "", email: "", phone: "", course: "", mentoringSchool: "", role: "member", year: "" });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create member");
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await remove({ data: { userId: confirmDel.id } });
      toast.success(`${confirmDel.full_name || "Member"} deleted.`);
      setConfirmDel(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading || (!isAdmin && !isPresident)) {
    return (
      <AppLayout title="Manage Members">
        <p className="text-sm text-muted-foreground text-center py-10 px-4">Checking permissions…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Manage Members" subtitle="Admin tools — add and manage members.">
      <Toaster position="top-center" />
      <section className="px-4 mt-4">
        <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="text-base font-extrabold text-[var(--brand)] flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Add New Member
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Scholar Code *" value={form.scholarCode} onChange={(v) => setForm({ ...form, scholarCode: v })} placeholder="2024/050/00001" required />
            <Field label="Temp Password *" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="min 6 chars" required type="text" />
            <Field label="Full Name *" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required className="col-span-2" />
            <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field label="Course" value={form.course} onChange={(v) => setForm({ ...form, course: v })} className="col-span-2" />
            <Field label="Mentoring School" value={form.mentoringSchool} onChange={(v) => setForm({ ...form, mentoringSchool: v })} className="col-span-2" />
          </div>
          {isPresident && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] font-bold tracking-wider text-muted-foreground">Assign Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{roleLabel(r)}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">The new admin's dashboard will be filtered to their role's modules.</p>
              </div>
              <Field label="Year (for Year-scoped officers)" value={form.year} onChange={(v) => setForm({ ...form, year: v })} placeholder="1-4" type="number" className="col-span-2" />
            </div>
          )}
          {error && <p className="text-sm text-destructive font-semibold">{error}</p>}
          {success && <p className="text-sm text-[var(--brand)] font-semibold">{success}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg shadow hover:bg-[var(--brand-deep)] transition-colors disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create Member"}
          </button>
        </form>
      </section>


      <section className="px-4 mt-6">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-extrabold text-[var(--brand)] flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Active Members (approved subscriptions)
            </h3>
            <button
              onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
              className="text-[11px] font-bold text-[var(--brand-accent)] flex items-center gap-1 px-2 py-1 rounded hover:bg-accent"
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortDir === "desc" ? "Most active" : "Least active"}
            </button>
          </div>
          {activity.length === 0 ? (
            <p className="text-xs text-muted-foreground">No members with active subscriptions yet. Treasurer or president must approve in Subscriptions.</p>
          ) : (
            (() => {
              const sorted = [...activity].sort((a, b) =>
                sortDir === "desc" ? b.count - a.count : a.count - b.count,
              );
              const max = Math.max(1, ...sorted.map((s) => s.count));
              const top = sorted.slice(0, 15);
              return (
                <div className="space-y-2">
                  {top.map((m) => (
                    <div key={m.id}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="font-semibold text-foreground truncate pr-2">{m.name}</span>
                        <span className="font-extrabold text-[var(--brand-accent)] tabular-nums">{m.count}</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] rounded-full transition-all"
                          style={{ width: `${(m.count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {sorted.length > 15 && (
                    <p className="text-[11px] text-muted-foreground pt-1">Showing top 15 of {sorted.length}</p>
                  )}
                </div>
              );
            })()
          )}
        </div>
      </section>

      <section className="px-4 mt-6 pb-6">
        <h3 className="text-base font-extrabold text-[var(--brand)] mb-2">All Members ({rows.length})</h3>
        <div className="space-y-2">
          {rows.map((r) => {
            const memberRoles = rolesMap[r.id] ?? [];
            const available = ASSIGNABLE_ROLES.filter((x) => !memberRoles.includes(x));
            const doAssign = async (role: string) => {
              setRoleBusy(r.id);
              try {
                await assign({ data: { userId: r.id, role } });
                setRolesMap((m) => ({ ...m, [r.id]: [...(m[r.id] ?? []), role] }));
                toast.success(`Assigned ${roleLabel(role)} to ${r.full_name}`);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to assign role");
              } finally {
                setRoleBusy(null);
              }
            };
            const doRemoveRole = async (role: string) => {
              setRoleBusy(r.id);
              try {
                await unassign({ data: { userId: r.id, role } });
                setRolesMap((m) => ({ ...m, [r.id]: (m[r.id] ?? []).filter((x) => x !== role) }));
                toast.success(`Removed ${roleLabel(role)} from ${r.full_name}`);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to remove role");
              } finally {
                setRoleBusy(null);
              }
            };
            return (
              <div key={r.id} className="bg-card border border-border rounded-xl px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{r.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.scholar_code}{r.course ? ` • ${r.course}` : ""}
                    </p>
                  </div>
                  {isPresident && (
                    <>
                      <button
                        onClick={async () => {
                          setEditOpen(r);
                          setEditForm(null);
                          setEditLoading(true);
                          try {
                            const p = await loadProfile({ data: { userId: r.id } });
                            setEditForm({
                              scholarCode: p.scholar_code ?? "",
                              fullName: p.full_name ?? "",
                              email: p.email ?? "",
                              phone: p.phone ?? "",
                              course: p.course ?? "",
                              mentoringSchool: p.mentoring_school ?? "",
                              year: p.year != null ? String(p.year) : "",
                            });
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to load profile");
                            setEditOpen(null);
                          } finally { setEditLoading(false); }
                        }}
                        className="p-2 text-[var(--brand)] hover:bg-accent rounded shrink-0"
                        title="Edit profile"
                        aria-label={`Edit ${r.full_name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDel(r)}
                        className="p-2 text-destructive hover:bg-destructive/10 rounded shrink-0"
                        title="Delete member"
                        aria-label={`Delete ${r.full_name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
                {isPresident && (
                  <div className="pt-2 border-t border-border/60 space-y-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Shield className="h-3 w-3 text-[var(--brand-accent)]" />
                      {memberRoles.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground">No roles</span>
                      ) : (
                        memberRoles.map((role) => (
                          <span key={role} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[10px] font-bold text-foreground">
                            {roleLabel(role)}
                            <button
                              onClick={() => doRemoveRole(role)}
                              disabled={roleBusy === r.id}
                              className="hover:text-destructive disabled:opacity-40"
                              aria-label={`Remove ${roleLabel(role)}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                    {available.length > 0 && (
                      <select
                        value=""
                        disabled={roleBusy === r.id}
                        onChange={(e) => { if (e.target.value) doAssign(e.target.value); }}
                        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand)] disabled:opacity-60"
                      >
                        <option value="">+ Assign a role…</option>
                        {available.map((role) => (
                          <option key={role} value={role}>{roleLabel(role)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>


      {confirmDel && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-extrabold text-destructive">Delete member?</h3>
            <p className="text-sm mt-2 text-foreground">
              <span className="font-bold">{confirmDel.full_name}</span>
              <span className="block text-xs text-muted-foreground">{confirmDel.scholar_code}</span>
            </p>
            <p className="text-sm mt-3 text-muted-foreground">
              Are you sure you want to delete this member? This action cannot be undone.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setConfirmDel(null)}
                disabled={deleting}
                className="flex-1 bg-muted text-foreground font-bold py-2.5 rounded-lg hover:bg-accent transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={doDelete}
                disabled={deleting}
                className="flex-1 bg-destructive text-destructive-foreground font-bold py-2.5 rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center px-3 py-4 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="bg-card border border-border rounded-2xl p-4 max-w-md w-full shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-extrabold text-[var(--brand)] flex items-center gap-2">
                <Pencil className="h-4 w-4" /> Edit Member Profile
              </h3>
              <button
                onClick={() => { setEditOpen(null); setEditForm(null); }}
                className="p-1 hover:bg-accent rounded" aria-label="Close"
              ><X className="h-4 w-4" /></button>
            </div>
            {editLoading || !editForm ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading profile…</p>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editForm || !editOpen) return;
                  setEditBusy(true);
                  try {
                    await saveProfile({ data: {
                      userId: editOpen.id,
                      scholarCode: editForm.scholarCode,
                      fullName: editForm.fullName,
                      email: editForm.email,
                      phone: editForm.phone,
                      course: editForm.course,
                      mentoringSchool: editForm.mentoringSchool,
                      year: editForm.year ? Number(editForm.year) : null,
                    } });
                    toast.success("Profile updated");
                    setEditOpen(null); setEditForm(null);
                    refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Update failed");
                  } finally { setEditBusy(false); }
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Scholar Code *" value={editForm.scholarCode}
                    onChange={(v) => setEditForm({ ...editForm, scholarCode: v })} required className="col-span-2" />
                  <Field label="Full Name *" value={editForm.fullName}
                    onChange={(v) => setEditForm({ ...editForm, fullName: v })} required className="col-span-2" />
                  <Field label="Email" value={editForm.email}
                    onChange={(v) => setEditForm({ ...editForm, email: v })} type="email" />
                  <Field label="Phone" value={editForm.phone}
                    onChange={(v) => setEditForm({ ...editForm, phone: v })} />
                  <Field label="Course" value={editForm.course}
                    onChange={(v) => setEditForm({ ...editForm, course: v })} className="col-span-2" />
                  <Field label="Mentoring School" value={editForm.mentoringSchool}
                    onChange={(v) => setEditForm({ ...editForm, mentoringSchool: v })} className="col-span-2" />
                  <Field label="Year (1-8)" value={editForm.year}
                    onChange={(v) => setEditForm({ ...editForm, year: v })} type="number" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Changing the scholar code also updates the member's sign-in credential.
                </p>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => { setEditOpen(null); setEditForm(null); }}
                    disabled={editBusy}
                    className="flex-1 bg-muted text-foreground font-bold py-2.5 rounded-lg hover:bg-accent disabled:opacity-60">
                    Cancel
                  </button>
                  <button type="submit" disabled={editBusy}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg shadow hover:bg-[var(--brand-deep)] disabled:opacity-60">
                    <Save className="h-4 w-4" /> {editBusy ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Field({
  label, value, onChange, placeholder, required, type = "text", className = "",
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; type?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-[10px] font-bold tracking-wider text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
      />
    </div>
  );
}
