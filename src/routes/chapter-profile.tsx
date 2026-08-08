import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { sectionStyle, type ChapterSection } from "@/components/ChapterSectionsAdmin";
import defaultLogo from "@/assets/elp-logo.png";

export const Route = createFileRoute("/chapter-profile")({
  head: () => ({
    meta: [
      { title: "Chapter Profile — MMUST ELP" },
      { name: "description", content: "Our chapter motto, mission, vision and story." },
      { property: "og:title", content: "Chapter Profile — MMUST ELP" },
      { property: "og:description", content: "Our chapter motto, mission, vision and story." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChapterProfilePage,
});

type Info = {
  name: string | null;
  motto: string | null;
  mission: string | null;
  vision: string | null;
  about: string | null;
  logo_url: string | null;
};

function ChapterProfilePage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [sections, setSections] = useState<ChapterSection[]>([]);

  useEffect(() => {
    supabase.rpc("get_chapter_public").then(({ data }) => {
      const row = (Array.isArray(data) ? data[0] : data) as Info | null | undefined;
      if (row) setInfo(row);
    });
    supabase
      .from("chapter_sections")
      .select("*")
      .eq("is_active", true)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data }) => setSections((data ?? []) as ChapterSection[]));
  }, []);

  return (
    <AppLayout title="Chapter Profile" subtitle="Who we are and what we stand for.">
      <section className="px-4 mt-4">
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <img
            src={info?.logo_url ?? defaultLogo}
            alt={`${info?.name ?? "Chapter"} crest`}
            className="h-16 w-16 rounded-full bg-white p-0.5 object-contain"
          />
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-foreground truncate">{info?.name ?? "MMUST ELP"}</h2>
            {info?.motto && <p className="text-sm italic text-[var(--brand)]">“{info.motto}”</p>}
          </div>
        </div>
      </section>

      {[
        { label: "Our Mission", value: info?.mission },
        { label: "Our Vision", value: info?.vision },
        { label: "About Us", value: info?.about },
      ]
        .filter((b) => b.value?.trim())
        .map((b) => (
          <section key={b.label} className="px-4 mt-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-bold tracking-wider text-muted-foreground">
                {b.label.toUpperCase()}
              </p>
              <p className="mt-1 text-sm text-foreground whitespace-pre-line">{b.value}</p>
            </div>
          </section>
        ))}

      {sections.map((s) => (
        <section key={s.id} className="px-4 mt-3">
          <div className="rounded-2xl p-4 shadow-sm" style={sectionStyle(s)}>
            <p className="font-extrabold">{s.title}</p>
            {s.body && <p className="mt-1 text-sm whitespace-pre-line opacity-95">{s.body}</p>}
          </div>
        </section>
      ))}

      {!info && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
      <div className="h-4" />
    </AppLayout>
  );
}
