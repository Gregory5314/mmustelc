import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import defaultLogo from "@/assets/elp-logo.png";

export type Branding = { name: string | null; logo_url: string | null; login_bg_url: string | null; motto?: string | null };

const CACHE_KEY = "elp:branding";
let cached: Branding | null = null;

function readCache(): Branding | null {
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (raw) cached = JSON.parse(raw) as Branding;
  } catch {
    /* ignore */
  }
  return cached;
}

export function useBranding() {
  const [branding, setBranding] = useState<Branding | null>(() => readCache());

  useEffect(() => {
    let alive = true;
    supabase.rpc("get_chapter_branding").then(({ data }) => {
      const row = (Array.isArray(data) ? data[0] : data) as Branding | null | undefined;
      if (!row || !alive) return;
      cached = row;
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(row));
      } catch {
        /* ignore */
      }
      setBranding(row);
    });
    return () => {
      alive = false;
    };
  }, []);

  return branding;
}

/**
 * Shared shell for the auth screens: keeps the chapter background image fixed
 * (with a slight blur) behind whichever auth form is open, plus the chapter logo.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const branding = useBranding();
  const bg = branding?.login_bg_url ?? null;
  const logo = branding?.logo_url ?? defaultLogo;
  const name = branding?.name ?? "MMUST ELP";


  return (
    <div
      className={`relative min-h-screen flex flex-col items-center justify-center px-5 py-10 ${
        bg ? "" : "bg-background"
      }`}
    >
      {bg && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-0 bg-center bg-cover"
            style={{ backgroundImage: `url("${bg}")` }}
          />
          <div aria-hidden className="fixed inset-0 z-0 bg-background/20" />
        </>
      )}

      <div className="w-full max-w-sm relative z-10">

        <div className="flex flex-col items-center mb-6">
          <img
            src={logo}
            alt={`${name} crest`}
            width={72}
            height={72}
            className="h-18 w-18 rounded-full bg-white p-1 object-contain shadow animate-pop-in"
          />
          <h1 className="mt-3 text-2xl font-extrabold text-[var(--brand)] text-center [text-shadow:0_1px_6px_rgba(0,0,0,0.45)]">{title}</h1>
          {subtitle && <p className="text-sm text-foreground/90 text-center [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]">{subtitle}</p>}
        {branding?.motto && (
            <p className="mt-1 text-xs italic text-[var(--brand)] text-center [text-shadow:0_1px_4px_rgba(0,0,0,0.45)]">“{branding.motto}”</p>
          )}
        </div>
        <div className="bg-background/35 backdrop-blur-xl border border-border/50 rounded-2xl p-5 shadow-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
