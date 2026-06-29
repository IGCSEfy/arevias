import { createFileRoute } from "@tanstack/react-router";
import { PageTransition } from "@/components/arevias/page-transition";
import AboutSection2 from "@/components/ui/about-section-2";
import { ClipPathLinks } from "@/components/ui/clip-path-links";
import KineticTeamHybrid from "@/components/ui/kinetic-team-hybrid";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <PageTransition dark={false}>
      <div className="fixed inset-0 overflow-y-auto bg-black text-foreground">
        <AboutSection2 />
        <KineticTeamHybrid
          fullScreen={false}
          title={
            <>
              The <span className="text-neutral-600">Team</span>
            </>
          }
          eyebrow="Arevias"
          members={[
            { id: "01", name: "Ebrahim Tariq", role: "Founder & CEO" },
          ]}
        />
        <section className="px-4 pb-32">
          <div className="mx-auto max-w-6xl">
            <ClipPathLinks />
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
