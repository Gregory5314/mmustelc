import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { scholarCodeToEmail } from "@/lib/scholar";
import logo from "@/assets/elp-logo.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — MMUST ELP" },
      { name: "description", content: "Members sign in with their email or scholar code." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) navigate({ to: "/", replace: true });
  }, [user, isLoading, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const raw = identifier.trim();
    const email = raw.includes("@") ? raw.toLowerCase() : scholarCodeToEmail(raw);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError("Invalid credentials.");
      return;
    }
    navigate({ to: "/", replace: true });
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your MMUST ELP account">
        <form
          onSubmit={onSubmit}
          className="bg-card/95 border border-border rounded-2xl p-5 shadow-sm space-y-4"
        >

          <div>
            <label className="text-xs font-bold tracking-wider text-muted-foreground" htmlFor="identifier">
              EMAIL OR SCHOLAR CODE
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com or 2018/050/14879"
              autoComplete="username"
              required
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
            />
          </div>
          <div>
            <label
              className="text-xs font-bold tracking-wider text-muted-foreground"
              htmlFor="password"
            >
              PASSWORD
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
            {submitting ? "Signing in…" : "Sign In"}
          </button>
          <p className="text-xs text-center">
            <Link to="/forgot-password" className="text-[var(--brand)] font-semibold hover:underline">
              Forgot your password?
            </Link>
          </p>
          <p className="text-xs text-muted-foreground text-center">
            New member or alumnus?{" "}
            <Link to="/signup" className="text-[var(--brand)] font-semibold hover:underline">
              Create an account
            </Link>
          </p>

        </form>
      </div>
    </div>
  );
}
