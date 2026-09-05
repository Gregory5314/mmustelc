import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/complaint")({
  head: () => ({
    meta: [
      { title: "Report Complaint/Problem — MMUST ELP" },
      { name: "description", content: "Submit a complaint or concern to chapter officials." },
    ],
  }),
  component: Complaint,
});

function Complaint() {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ subject: "", category: "Financial", details: "" });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true); setError(null);
    const { error } = await supabase.from("complaints").insert({
      submitter_id: user.id,
      subject: form.subject.trim(),
      category: form.category,
      details: form.details.trim(),
    });
    setSubmitting(false);
    if (error) { setError(error.message); return; }
    setSubmitted(true);
  };

  return (
    <AppLayout title="Report Complaint/Problem" subtitle="Your voice matters.">
      <section className="px-4 mt-4">
        {submitted ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-base font-extrabold text-[var(--brand)]">Thank you.</p>
            <p className="text-sm text-muted-foreground mt-1">Your complaint has been received. Admins have been notified.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-sm">
            <div>
              <label className="text-xs font-semibold tracking-wider text-muted-foreground">SUBJECT</label>
              <input required maxLength={140} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Brief subject" />
            </div>
            <div>
              <label className="text-xs font-semibold tracking-wider text-muted-foreground">CATEGORY</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <option>Financial</option>
                <option>Leadership</option>
                <option>Events</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold tracking-wider text-muted-foreground">DETAILS</label>
              <textarea required rows={5} maxLength={2000} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Describe your complaint..." />
            </div>
            {error && <p className="text-sm text-destructive font-semibold">{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full bg-[var(--brand)] text-brand-foreground font-bold py-3 rounded-lg shadow hover:bg-[var(--brand-deep)] transition-colors disabled:opacity-60">
              {submitting ? "Submitting…" : "Submit Complaint"}
            </button>
          </form>
        )}
      </section>
    </AppLayout>
  );
}
