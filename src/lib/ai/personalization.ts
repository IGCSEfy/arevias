import type { AiPersonalization } from "./types";

/**
 * Maps a raw `profiles.preferences` JSONB blob into the lean personalization
 * object sent with chat requests. Returns null when there's nothing worth
 * sending, so the system prompt stays untouched for users who haven't
 * customized anything.
 */
export function toPersonalization(
  prefs: Record<string, unknown> | null | undefined,
): AiPersonalization | null {
  if (!prefs || typeof prefs !== "object") return null;

  const str = (key: string) =>
    typeof prefs[key] === "string" ? (prefs[key] as string).trim() : "";

  const p: AiPersonalization = {
    aboutYou: str("aboutYou"),
    responseGuidance: str("responseGuidance"),
    responseStyle: str("responseStyle"),
    responseLength: str("responseLength"),
    creativity: str("creativity"),
    personalities: Array.isArray(prefs["personalities"])
      ? (prefs["personalities"] as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    emoji: str("emoji"),
    slang: str("slang"),
    messageStyle: str("messageStyle"),
    punctuation: str("punctuation"),
    occupation: str("occupation"),
    goals: str("goals"),
    interests: str("interests"),
    communication: str("communication"),
    // Defaults to enabled — only an explicit `false` turns context off.
    contextEnabled: prefs["contextEnabled"] !== false,
  };

  const hasFreeText = Boolean(
    p.aboutYou || p.responseGuidance || p.occupation || p.goals || p.interests || p.communication,
  );
  const hasShaping = Boolean(
    (p.personalities && p.personalities.length > 0) ||
      (p.responseStyle && p.responseStyle !== "balanced") ||
      (p.responseLength && p.responseLength !== "balanced") ||
      (p.creativity && p.creativity !== "balanced") ||
      p.emoji === "never" ||
      p.emoji === "freely" ||
      p.slang === "never" ||
      p.slang === "freely" ||
      p.messageStyle === "single" ||
      p.messageStyle === "bursts" ||
      p.punctuation === "clean" ||
      p.punctuation === "never",
  );

  return hasFreeText || hasShaping ? p : null;
}
