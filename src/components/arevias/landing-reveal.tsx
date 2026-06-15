import type { RefObject } from "react";

import { TextRevealByWord } from "@/components/ui/text-reveal";

/**
 * What Arevias is, revealed word-by-word as you scroll past the chat. Doubles
 * as the public "purpose of the app" description for the landing page.
 */
const AREVIAS_BLURB =
  "Arevias is a conversational AI companion you can talk to naturally — it remembers what matters to you, adapts to how you think, and follows up on its own. Less a tool you operate, more someone who actually gets you.";

export function LandingReveal({
  containerRef,
}: {
  containerRef: RefObject<HTMLElement | null>;
}) {
  return (
    <section aria-label="About Arevias" className="relative z-10">
      <TextRevealByWord text={AREVIAS_BLURB} containerRef={containerRef} />
    </section>
  );
}
