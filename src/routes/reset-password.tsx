import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/elp-logo.png";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — MMUST ELP" },
      { name: "description", content: "Choose a new password for your MMUST ELP account." },
      { property: "og:title", content: "Set a new password — MMUST ELP" },
      { property: "og:description", content: "Choose a new password for your MMUST ELP account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) return setError(error.message);
    setDone(true);
    await supabase.auth.signOut();
    setTimeout(() => navigate({ to: "/login", replace: true }), 1600);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="MMUST ELP" width={72} height={72} className="h-18 w-18 rounded-full bg-white p-1 object-contain shadow" />
          <h1 className="mt-3 text-2xl font-extrabold text-[var(--brand)]">New password</h1>
          <p className="text-sm text-muted-foreground">Choose a strong password you'll remember.</p>
        </div>

        <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          {done ? (
            <p className="text-sm text-[var(--brand)] font-semibold bg-accent/60 rounded-md p-3">
              Password updated. Redirecting you to sign in…
            </p>
          ) : !ready ? (
            <p className="text-sm text-muted-foreground">
              Open this page from the reset link in your email. If the link expired,{" "}
              <Link to="/forgot-password" className="text-[var(--brand)] font-semibold hover:underline">
                request a new one
              </Link>
              .
            </p>
          ) : (
            <>
              <div>
                <label className="text-xs font-bold tracking-wider text-muted-foreground" htmlFor="password">
                  NEW PASSWORD
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                />
              </div>
              <div>
                <label className="text-xs font-bold tracking-wider text-muted-foreground" htmlFor="confirm">
                  CONFIRM PASSWORD
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                />
              </div>
              {error && <p className="text-sm text-destructive font-semibold">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg shadow hover:bg-[var(--brand-deep)] transition-colors disabled:opacity-60"
              >
                {submitting ? "Updating…" : "Update password"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
