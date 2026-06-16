import type { RefObject } from "react";

import { TextRevealByWord } from "@/components/ui/text-reveal";

/**
 * What Arevias is, revealed word-by-word as you scroll past the chat. Doubles
 * as the public "purpose of the app" description for the landing page.
 */
const AREVIAS_BLURB =
  "Arevias is a conversational AI by Nanoris, built around conversation rather than prompts and tasks, adapting to how you think and growing with you over time.";

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
