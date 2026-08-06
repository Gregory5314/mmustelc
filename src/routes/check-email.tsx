import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MailCheck, RefreshCw, Inbox, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/elp-logo.png";

type Kind = "verify" | "reset";

export const Route = createFileRoute("/check-email")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: (search.type === "reset" ? "reset" : "verify") as Kind,
    email: typeof search.email === "string" ? search.email : "",
  }),
  head: () => ({
    meta: [
      { title: "Check your email — MMUST ELP" },
      {
        name: "description",
        content: "Confirm that your MMUST ELP verification or password reset email was delivered.",
      },
      { property: "og:title", content: "Check your email — MMUST ELP" },
      {
        property: "og:description",
        content: "Confirm that your MMUST ELP verification or password reset email was delivered.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckEmailPage,
});

function CheckEmailPage() {
  const { type, email } = Route.useSearch();
  const navigate = useNavigate();
  const isReset = type === "reset";

  const [cooldown, setCooldown] = useState(30);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!email) navigate({ to: isReset ? "/forgot-password" : "/signup", replace: true });
  }, [email, isReset, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async () => {
    setStatus("sending");
    setMessage(null);
    const { error } = isReset
      ? await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
      : await supabase.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
    if (error) {
      setStatus("error");
      setMessage(
        error.message.toLowerCase().includes("rate")
          ? "Too many attempts. Wait a minute before requesting another email."
          : error.message,
      );
      return;
    }
    setStatus("sent");
    setMessage("We sent it again just now.");
    setCooldown(30);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img
            src={logo}
            alt="MMUST ELP"
            width={72}
            height={72}
            className="h-18 w-18 rounded-full bg-white p-1 object-contain shadow"
          />
          <h1 className="mt-3 text-2xl font-extrabold text-[var(--brand)] text-center">
            {isReset ? "Reset link sent" : "Verify your email"}
          </h1>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-accent/60 p-3">
            <MailCheck className="h-5 w-5 shrink-0 text-[var(--brand)]" />
            <div>
              <p className="text-sm font-bold text-foreground">
                Email delivered to your provider
              </p>
              <p className="text-sm text-muted-foreground break-all">{email}</p>
            </div>
          </div>

          <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
            <li>Open your inbox on this device.</li>
            <li>
              {isReset
                ? "Tap the reset link — it opens the “New password” screen."
                : "Tap the confirmation link — you'll be able to sign in right after."}
            </li>
            <li>Links expire after a short while, so use the newest email.</li>
          </ol>

          <div className="flex items-start gap-2 rounded-lg border border-border p-3">
            <Inbox className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Nothing after a minute? Check Spam, Promotions and Updates folders, and confirm the
              address above is spelled correctly.
            </p>
          </div>

          {message && (
            <p
              className={`flex items-center gap-2 text-sm font-semibold ${
                status === "error" ? "text-destructive" : "text-[var(--brand)]"
              }`}
            >
              {status === "error" && <AlertCircle className="h-4 w-4" />}
              {message}
            </p>
          )}

          <button
            type="button"
            onClick={resend}
            disabled={status === "sending" || cooldown > 0}
            className="w-full inline-flex items-center justify-center gap-2 bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg shadow hover:bg-[var(--brand-deep)] transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${status === "sending" ? "animate-spin" : ""}`} />
            {status === "sending"
              ? "Sending…"
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : isReset
                  ? "Resend reset link"
                  : "Resend verification email"}
          </button>

          <div className="flex flex-col gap-1 text-center text-xs">
            <Link to="/login" className="text-[var(--brand)] font-semibold hover:underline">
              Go to sign in
            </Link>
            <Link
              to={isReset ? "/forgot-password" : "/signup"}
              className="text-muted-foreground hover:underline"
            >
              Use a different email address
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
