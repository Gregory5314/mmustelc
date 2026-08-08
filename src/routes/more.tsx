import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { User, CheckSquare, BookOpen, Users, Shield, AlertTriangle, ChevronRight, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/more")({
  head: () => ({ meta: [{ title: "More — MMUST ELP" }, { name: "description", content: "More options and chapter tools." }] }),
  component: More,
});

const items = [
  { icon: User, label: "My Profile", to: "/profile" as const },
  { icon: Shield, label: "Chapter Profile", to: "/chapter-profile" as const },
  { icon: CheckSquare, label: "Chapter Activities", to: "/activities" as const },

  { icon: BookOpen, label: "MMUST ELC Constitution", to: "/constitution" as const },
  { icon: Users, label: "Members List", to: "/members" as const },
  { icon: Shield, label: "Chapter Officials", to: "/officials" as const },
  { icon: ImageIcon, label: "Photo Gallery", to: "/gallery" as const },
  { icon: AlertTriangle, label: "Report Complaint", to: "/complaint" as const },
];

function More() {
  return (
    <AppLayout title="More" subtitle="All chapter tools in one place.">
      <section className="px-4 mt-4 bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
        {items.map(({ icon: Icon, label, to }) => (
          <Link key={label} to={to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent transition-colors">
            <Icon className="h-5 w-5 text-[var(--brand-accent)]" />
            <span className="flex-1 font-semibold text-foreground">{label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </section>
    </AppLayout>
  );
}
