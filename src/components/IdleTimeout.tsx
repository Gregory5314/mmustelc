import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const IDLE_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const COUNTDOWN_SECONDS = 10;

const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "touchstart",
  "pointerdown",
  "wheel",
  "scroll",
  "visibilitychange",
] as const;

export function IdleTimeout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [prompting, setPrompting] = useState(false);
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const endSession = useCallback(async () => {
    setPrompting(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/login", replace: true });
  }, [navigate, queryClient, signOut]);

  // Inactivity watcher
  useEffect(() => {
    if (!user || prompting) return;

    const reset = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        setSeconds(COUNTDOWN_SECONDS);
        setPrompting(true);
      }, IDLE_MS);
    };

    reset();
    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, reset, { passive: true } as AddEventListenerOptions),
    );
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user, prompting]);

  // 10-second auto sign-out countdown
  useEffect(() => {
    if (!prompting) return;
    if (seconds <= 0) {
      void endSession();
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [prompting, seconds, endSession]);

  if (!prompting || !user) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-5"
    >
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent">
          <Clock className="h-6 w-6 text-[var(--brand)]" />
        </div>
        <h2 id="idle-title" className="mt-3 text-lg font-extrabold text-foreground">
          Are you still active?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your session has been idle for 30 minutes. You'll be signed out automatically in
        </p>
        <p className="my-3 text-4xl font-extrabold tabular-nums text-[var(--brand)]">{seconds}s</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setPrompting(false);
              setSeconds(COUNTDOWN_SECONDS);
            }}
            className="w-full bg-[var(--brand)] text-brand-foreground font-bold py-2.5 rounded-lg shadow hover:bg-[var(--brand-deep)] transition-colors"
          >
            Yes, keep me signed in
          </button>
          <button
            type="button"
            onClick={() => void endSession()}
            className="w-full border border-input bg-background text-foreground font-semibold py-2.5 rounded-lg hover:bg-accent transition-colors"
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
