import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthShell } from "@/components/AuthShell";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — MMUST ELP" },
      { name: "description", content: "Create your MMUST ELP member or alumni account." },
      { property: "og:title", content: "Sign up — MMUST ELP" },
      { property: "og:description", content: "Create your MMUST ELP member or alumni account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

const nameRule = z
  .string()
  .trim()
  .min(2, "Enter a valid name")
  .max(60)
  .regex(/^[A-Za-z'’\-\s]+$/, "Letters only");

const baseSchema = z.object({
  firstName: nameRule,
  middleName: z.union([z.literal(""), nameRule]),
  surname: nameRule,
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid mobile number")
    .max(20)
    .regex(/^[0-9 +\-()]+$/, "Digits only"),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  course: z.string().trim().min(2, "Enter your course").max(120),
  password: z.string().min(8, "At least 8 characters").max(72),
});

const thisYear = new Date().getFullYear();

export const SECURITY_QUESTIONS = [
  { key: "favorite_food", label: "What's your favorite food?" },
  { key: "childhood_nickname", label: "Childhood nickname" },
  { key: "favorite_sports_team", label: "Favorite sports team" },
  { key: "favorite_color", label: "Favorite color" },
  { key: "fathers_first_name", label: "Father's first name" },
] as const;

function SignupPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [isAlumni, setIsAlumni] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    surname: "",
    phone: "",
    email: "",
    course: "",
    year: "",
    graduationYear: "",
    password: "",
    q1: SECURITY_QUESTIONS[0].key as string,
    a1: "",
    q2: SECURITY_QUESTIONS[1].key as string,
    a2: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) navigate({ to: "/", replace: true });
  }, [user, isLoading, navigate]);

  const set = <K extends keyof typeof form>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const parsed = baseSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    const data = parsed.data;

    let year: number | null = null;
    let graduationYear: number | null = null;
    if (isAlumni) {
      graduationYear = Number(form.graduationYear);
      if (!graduationYear || graduationYear < 1980 || graduationYear > thisYear) {
        setError(`Enter a graduation year between 1980 and ${thisYear}`);
        return;
      }
    } else {
      year = Number(form.year);
      if (!year || year < 1 || year > 7) {
        setError("Select your year of study");
        return;
      }
    }

    if (form.q1 === form.q2) {
      setError("Pick two different security questions");
      return;
    }
    if (form.a1.trim().length < 2 || form.a2.trim().length < 2) {
      setError("Answer both security questions");
      return;
    }

    setSubmitting(true);

    const { data: taken, error: checkError } = await supabase.rpc("is_signup_identity_available", {
      _email: data.email,
      _phone: data.phone,
    });
    if (!checkError) {
      const row = (Array.isArray(taken) ? taken[0] : taken) as
        | { email_taken: boolean; phone_taken: boolean }
        | null;
      if (row?.email_taken) {
        setSubmitting(false);
        setError("An account with this email address already exists.");
        return;
      }
      if (row?.phone_taken) {
        setSubmitting(false);
        setError("An account with this mobile number already exists.");
        return;
      }
    }

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          first_name: data.firstName,
          middle_name: data.middleName,
          surname: data.surname,
          full_name: [data.firstName, data.middleName, data.surname]
            .filter(Boolean)
            .join(" "),
          phone: data.phone,
          contact_email: data.email,
          course: data.course,
          year: year ? String(year) : "",
          graduation_year: graduationYear ? String(graduationYear) : "",
          is_alumni: isAlumni,
          scholar_code: data.email,
        },
      },
    });

    if (error) {
      setSubmitting(false);
      const msg = error.message.toLowerCase();
      if (msg.includes("mobile number already exists")) {
        setError("An account with this mobile number already exists.");
      } else if (msg.includes("already") && msg.includes("registered")) {
        setError("An account with this email address already exists.");
      } else if (msg.includes("email address already exists")) {
        setError("An account with this email address already exists.");
      } else if (msg.includes("exact names already exists")) {
        setError("A member with these exact names already exists. Add your middle name or contact the secretary.");
      } else {
        setError(error.message);
      }
      return;
    }

    await supabase.rpc("save_security_answers", {
      _q1: form.q1,
      _a1: form.a1,
      _q2: form.q2,
      _a2: form.a2,
    });
    setSubmitting(false);

    setInfo(
      isAlumni
        ? "Alumni account created — the Alumni Manager will see you in the register."
        : "Account created — signing you in…",
    );
    navigate({ to: "/", replace: true });
  };

  return (
    <AuthShell
      title="Join MMUST ELP"
      subtitle={`Create your ${isAlumni ? "alumni" : "member"} account`}
    >
      <div className="w-full">


        <div className="grid grid-cols-2 gap-2 mb-4 bg-muted rounded-xl p-1">
          <button
            type="button"
            onClick={() => setIsAlumni(false)}
            className={`py-2 rounded-lg text-sm font-bold transition-colors ${!isAlumni ? "bg-[var(--brand)] text-brand-foreground shadow" : "text-muted-foreground"}`}
          >
            Current scholar
          </button>
          <button
            type="button"
            onClick={() => setIsAlumni(true)}
            className={`py-2 rounded-lg text-sm font-bold transition-colors ${isAlumni ? "bg-[var(--brand)] text-brand-foreground shadow" : "text-muted-foreground"}`}
          >
            Alumni
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4"
        >
          <Field
            id="firstName"
            label="FIRST NAME"
            value={form.firstName}
            onChange={(v) => set("firstName", v)}
            placeholder="e.g. Jane"
            autoComplete="given-name"
          />
          <Field
            id="middleName"
            label="MIDDLE NAME (OPTIONAL)"
            value={form.middleName}
            onChange={(v) => set("middleName", v)}
            placeholder="e.g. Achieng"
            autoComplete="additional-name"
            required={false}
          />
          <Field
            id="surname"
            label="SURNAME"
            value={form.surname}
            onChange={(v) => set("surname", v)}
            placeholder="e.g. Otieno"
            autoComplete="family-name"
          />
          <Field
            id="phone"
            label="MOBILE NUMBER"
            type="tel"
            value={form.phone}
            onChange={(v) => set("phone", v)}
            placeholder="+254 7XX XXX XXX"
            autoComplete="tel"
          />
          <Field
            id="email"
            label="EMAIL ADDRESS"
            type="email"
            value={form.email}
            onChange={(v) => set("email", v)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <Field
            id="course"
            label="COURSE OF STUDY"
            value={form.course}
            onChange={(v) => set("course", v)}
            placeholder="e.g. B.Sc. Electrical Engineering"
          />

          {isAlumni ? (
            <Field
              id="graduationYear"
              label="YEAR OF GRADUATION"
              type="number"
              value={form.graduationYear}
              onChange={(v) => set("graduationYear", v)}
              placeholder={String(thisYear)}
            />
          ) : (
            <div>
              <label
                className="text-xs font-bold tracking-wider text-muted-foreground"
                htmlFor="year"
              >
                YEAR OF STUDY
              </label>
              <select
                id="year"
                value={form.year}
                onChange={(e) => set("year", e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-input bg-background/70 backdrop-blur-sm px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              >
                <option value="">Select year</option>
                {[1, 2, 3, 4, 5, 6].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Field
            id="password"
            label="PASSWORD"
            type="password"
            value={form.password}
            onChange={(v) => set("password", v)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />

          <div className="rounded-xl border border-white/25 bg-background/20 p-3 space-y-3">
            <p className="text-xs font-bold tracking-wider text-muted-foreground">
              SECURITY QUESTIONS — PICK TWO
            </p>
            <QuestionPicker
              idx={1}
              question={form.q1}
              answer={form.a1}
              disabledKey={form.q2}
              onQuestion={(v) => set("q1", v)}
              onAnswer={(v) => set("a1", v)}
            />
            <QuestionPicker
              idx={2}
              question={form.q2}
              answer={form.a2}
              disabledKey={form.q1}
              onQuestion={(v) => set("q2", v)}
              onAnswer={(v) => set("a2", v)}
            />
            <p className="text-[11px] text-muted-foreground">
              Answers are not case sensitive. Keep them somewhere safe — they help verify it's you.
            </p>
          </div>

          {error && <p className="text-sm text-destructive font-semibold">{error}</p>}
          {info && (
            <p className="text-sm text-[var(--brand)] font-semibold bg-accent/60 rounded-md p-2">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg shadow hover:bg-[var(--brand-deep)] transition-colors disabled:opacity-60"
          >
            {submitting ? "Creating account…" : isAlumni ? "Create Alumni Account" : "Create Account"}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Already a member?{" "}
            <Link to="/login" className="text-[var(--brand)] font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </AuthShell>

  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  required = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-bold tracking-wider text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="mt-1 w-full rounded-lg border border-input bg-background/70 backdrop-blur-sm px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/60 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
      />
    </div>
  );
}

function QuestionPicker({
  idx,
  question,
  answer,
  disabledKey,
  onQuestion,
  onAnswer,
}: {
  idx: number;
  question: string;
  answer: string;
  disabledKey: string;
  onQuestion: (v: string) => void;
  onAnswer: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <select
        aria-label={`Security question ${idx}`}
        value={question}
        onChange={(e) => onQuestion(e.target.value)}
        required
        className="w-full rounded-lg border border-input bg-background/70 backdrop-blur-sm px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
      >
        {SECURITY_QUESTIONS.map((q) => (
          <option key={q.key} value={q.key} disabled={q.key === disabledKey}>
            {q.label}
          </option>
        ))}
      </select>
      <input
        aria-label={`Answer ${idx}`}
        type="text"
        value={answer}
        onChange={(e) => onAnswer(e.target.value)}
        placeholder="Your answer"
        autoComplete="off"
        required
        className="w-full rounded-lg border border-input bg-background/70 backdrop-blur-sm px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/60 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
      />
    </div>
  );
}
