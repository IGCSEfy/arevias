export const AI_FALLBACK_GENERIC = "something's off, try again in a bit";
export const AI_FALLBACK_RATE_LIMIT = "too many messages rn, give me a sec";

const AI_FALLBACK_TEXTS: ReadonlySet<string> = new Set([
  AI_FALLBACK_GENERIC,
  AI_FALLBACK_RATE_LIMIT,
]);

export function isFallbackReplyText(text: string): boolean {
  return AI_FALLBACK_TEXTS.has(text);
}

export type AiRole = "user" | "ai";

export type AiReplyContext = {
  id?: string;
  role: AiRole;
  text: string;
};

export type AiHistoryMessage = {
  id?: string;
  role: AiRole;
  text: string;
  replyTo?: AiReplyContext;
};

export type AiReplyRequest = {
  message: string;
  history?: AiHistoryMessage[];
  replyTo?: AiReplyContext | null;
};

export type AiReplyResponse = {
  text: string;
};

export type AiAdapter = {
  /** Returns 1, 2, or 3 short message fragments. May be sync or async. */
  generateReplyParts(input: AiReplyRequest): string[] | Promise<string[]>;
};
