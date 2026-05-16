import type { AiAdapter } from "./types";
import type { AiReplyRequest } from "./types";

const aiFragments = [
  ["mm", "yeah", "okay", "right", "hm", "got it", "i hear you"],
  [
    "an idea is just a small disturbance in attention",
    "form follows fascination",
    "strip the noun. keep the verb",
    "the shape of what's missing often draws the truer line",
    "speak it like you're telling one quiet listener",
    "the object reveals itself in motion",
    "begin where the detail won't leave you alone",
    "let it be smaller than you think",
    "the architecture appears once you stop performing",
    "trust the part that feels almost embarrassing",
  ],
  [
    "try it again, slower",
    "say it once more, but quieter",
    "what would the inverse look like",
    "what if it were a single sentence",
    "what's the version with nothing removed",
    "and what if it weren't useful at all",
  ],
];

const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length];

export class MockAdapter implements AiAdapter {
  generateReplyParts(input: AiReplyRequest): string[] {
    const message = input.message;
    const hash = message.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const mode = hash % 5;
    const parts: string[] = [];

    if (mode === 0 || mode === 1) {
      parts.push(pick(aiFragments[1], hash));
    } else if (mode === 2 || mode === 3) {
      parts.push(pick(aiFragments[0], hash));
      parts.push(pick(aiFragments[1], hash + 7));
    } else {
      parts.push(pick(aiFragments[0], hash));
      parts.push(pick(aiFragments[1], hash + 11));
      parts.push(pick(aiFragments[2], hash + 19));
    }

    return parts;
  }
}
