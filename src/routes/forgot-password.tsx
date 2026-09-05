import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { resetPasswordWithSecurityAnswers } from "@/lib/recovery.functions";
import { SECURITY_QUESTIONS } from "@/lib/security-questions";
import logo from "@/assets/elp-logo.png";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — MMUST ELP" },
      { name: "description", content: "Recover your MMUST ELP account with your security questions or a reset link." },
      { property: "og:title", content: "Reset password — MMUST ELP" },
      { property: "og:description", content: "Recover your MMUST ELP account with your security questions or a reset link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(160);

const inputClass =
  "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand)]";
const labelClass = "text-xs font-bold tracking-wider text-muted-foreground";

function questionLabel(key: string) {
  return SECURITY_QUESTIONS.find((q) => q.key === key)?.label ?? key;
}

function ForgotPasswordPage() {
  const [mode, setMode] = useState<"questions" | "link">("questions");

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="MMUST ELP" width={72} height={72} className="h-18 w-18 rounded-full bg-white p-1 object-contain shadow" />
          <h1 className="mt-3 text-2xl font-extrabold text-[var(--brand)]">Forgot password</h1>
          <p className="text-sm text-muted-foreground text-center">
            Recover your account with your security questions, or get a reset link by email.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4 bg-muted rounded-xl p-1">
          <button
            type="button"
            onClick={() => setMode("questions")}
            className={`py-2 rounded-lg text-sm font-bold transition-colors ${mode === "questions" ? "bg-[var(--brand)] text-brand-foreground shadow" : "text-muted-foreground"}`}
          >
            Security questions
          </button>
          <button
            type="button"
            onClick={() => setMode("link")}
            className={`py-2 rounded-lg text-sm font-bold transition-colors ${mode === "link" ? "bg-[var(--brand)] text-brand-foreground shadow" : "text-muted-foreground"}`}
          >
            Email reset link
          </button>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          {mode === "questions" ? <QuestionsFlow /> : <LinkFlow />}
          <p className="text-xs text-muted-foreground text-center mt-4">
            <Link to="/login" className="text-[var(--brand)] font-semibold hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function QuestionsFlow() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const lookup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email");
      return;
    }
    setBusy(true);
    const { data, error: rpcErr } = await (supabase.rpc as any)("get_security_questions_for_email", {
      _email: parsed.data,
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    const keys = ((data as { question_key: string }[] | null) ?? []).map((r) => r.question_key);
    if (keys.length === 0) {
      setError("No security questions are set up for that email. Use the email reset link instead.");
      return;
    }
    setQuestions(keys);
    setAnswers(Object.fromEntries(keys.map((k) => [k, ""])));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (Object.values(answers).some((a) => !a.trim())) {
      setError("Answer both questions");
      return;
    }
    setBusy(true);
    try {
      const res = await resetPasswordWithSecurityAnswers({
        data: { email: email.trim().toLowerCase(), answers, password },
      });
      setBusy(false);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDone(true);
      setTimeout(() => navigate({ to: "/login", replace: true }), 1800);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  if (done) {
    return (
      <p className="text-sm text-[var(--brand)] font-semibold bg-accent/60 rounded-md p-3">
        Password updated. Taking you to sign in…
      </p>
    );
  }

  if (!questions) {
    return (
      <form onSubmit={lookup} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="sq-email">EMAIL ADDRESS</label>
          <input
            id="sq-email"
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className={inputClass}
          />
        </div>
        {error && <p className="text-sm text-destructive font-semibold">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg shadow hover:bg-[var(--brand-deep)] transition-colors disabled:opacity-60"
        >
          {busy ? "Checking…" : "Continue"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Answers ignore capitalisation and punctuation, and small spelling slips are accepted.
      </p>
      {questions.map((key) => (
        <div key={key}>
          <label className={labelClass} htmlFor={`ans-${key}`}>{questionLabel(key).toUpperCase()}</label>
          <input
            id={`ans-${key}`}
            type="text"
            value={answers[key] ?? ""}
            onChange={(ev) => setAnswers((prev) => ({ ...prev, [key]: ev.target.value }))}
            required
            className={inputClass}
          />
        </div>
      ))}
      <div>
        <label className={labelClass} htmlFor="sq-pass">NEW PASSWORD</label>
        <input id="sq-pass" type="password" value={password} onChange={(ev) => setPassword(ev.target.value)} required minLength={8} autoComplete="new-password" className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="sq-confirm">CONFIRM PASSWORD</label>
        <input id="sq-confirm" type="password" value={confirm} onChange={(ev) => setConfirm(ev.target.value)} required minLength={8} autoComplete="new-password" className={inputClass} />
      </div>
      {error && <p className="text-sm text-destructive font-semibold">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg shadow hover:bg-[var(--brand-deep)] transition-colors disabled:opacity-60"
      >
        {busy ? "Verifying…" : "Reset password"}
      </button>
    </form>
  );
}

function LinkFlow() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email");
      return;
    }
    setSubmitting(true);
    const { error: sendErr } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (sendErr) {
      setError(sendErr.message);
      return;
    }
    navigate({ to: "/check-email", search: { type: "reset", email: parsed.data }, replace: true });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="link-email">EMAIL ADDRESS</label>
        <input
          id="link-email"
          type="email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          className={inputClass}
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
    </form>
  );
}
