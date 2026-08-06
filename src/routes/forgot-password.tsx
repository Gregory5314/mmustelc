import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/elp-logo.png";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — MMUST ELP" },
      { name: "description", content: "Get a password reset link sent to your MMUST ELP email address." },
      { property: "og:title", content: "Reset password — MMUST ELP" },
      { property: "og:description", content: "Get a password reset link sent to your MMUST ELP email address." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

const schema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email").max(160) });

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
    navigate({
      to: "/check-email",
      search: { type: "reset", email: parsed.data.email },
      replace: true,
    });
  };


  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="MMUST ELP" width={72} height={72} className="h-18 w-18 rounded-full bg-white p-1 object-contain shadow" />
          <h1 className="mt-3 text-2xl font-extrabold text-[var(--brand)]">Forgot password</h1>
          <p className="text-sm text-muted-foreground text-center">
            We'll email you a secure link to set a new password.
          </p>
        </div>

        <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          {sent ? (
            <p className="text-sm text-[var(--brand)] font-semibold bg-accent/60 rounded-md p-3">
              If that email is registered, a reset link is on its way. Check your inbox (and spam folder).
            </p>
          ) : (
            <>
              <div>
                <label className="text-xs font-bold tracking-wider text-muted-foreground" htmlFor="email">
                  EMAIL ADDRESS
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
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
                {submitting ? "Sending…" : "Send reset link"}
              </button>
            </>
          )}
          <p className="text-xs text-muted-foreground text-center">
            <Link to="/login" className="text-[var(--brand)] font-semibold hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
