import { createFileRoute } from "@tanstack/react-router";
import { Changelog1, type ChangelogEntry } from "@/components/ui/changelog-1";
import { PageTransition } from "@/components/arevias/page-transition";
import changelogBeta from "@/assets/changelog-beta-1.0.png";

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
});

const entries: ChangelogEntry[] = [
  {
    version: "Version Beta 1.0",
    date: "June 2026",
    title: "Arevias enters Beta",
    description:
      "This is the first public Beta of Arevias, an AI surface built to feel less like a tool and more like someone who actually knows you. We're opening the doors early so you can shape where it goes next.",
    items: [
      "Conversational AI with a personality you can tune for tone, length, and attitude",
      "Custom instructions and long-term context so Arevias remembers who you are",
      "A personal console for your profile, personalization, security, and activity",
      "Email and OAuth sign in, avatar uploads, and account management",
      "Fast, smooth transitions across the whole app",
    ],
    image: changelogBeta,
  },
];

function ChangelogPage() {
  // Full-screen scroll container because the app shell (html/body/#root) is
  // fixed with overflow hidden.
  return (
    <PageTransition>
      <div className="fixed inset-0 overflow-y-auto bg-transparent text-foreground">
        <Changelog1
          title="Changelog"
          description="Everything new in Arevias. We're just getting started."
          entries={entries}
        />
      </div>
    </PageTransition>
  );
}
