import { createFileRoute } from "@tanstack/react-router";
import { PageTransition } from "@/components/arevias/page-transition";
import AboutSection2 from "@/components/ui/about-section-2";
import { ClipPathLinks } from "@/components/ui/clip-path-links";
import KineticTeamHybrid from "@/components/ui/kinetic-team-hybrid";
import nanorisLogo from "@/assets/nanoris-logo.png";

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
              Behind <span className="text-neutral-600">Arevias</span>
            </>
          }
          eyebrow={
            <img
              src={nanorisLogo}
              alt="Nanoris"
              className="block h-14 w-auto md:h-24"
            />
          }
          members={[
            {
              id: "01",
              name: "Ebrahim Tariq",
              role: "Founder & CEO",
              link: "https://www.linkedin.com/in/ebrahim-tariq-641128380/",
            },
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
