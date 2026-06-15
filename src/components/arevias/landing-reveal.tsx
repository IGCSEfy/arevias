import type { RefObject } from "react";

import { TextRevealByWord } from "@/components/ui/text-reveal";

/**
 * What Arevias is, revealed word-by-word as you scroll past the chat. Doubles
 * as the public "purpose of the app" description for the landing page.
 */
const AREVIAS_BLURB =
  "Arevias is a conversational AI created by Nanoris. Built around conversation rather than prompts and tasks, it adapts to how you think, remembers what matters, and develops a deeper understanding of you over time. At Nanoris, we’re redefining what AI can be for people by building technology that feels more human, more personal, and more naturally integrated into everyday life.";

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
