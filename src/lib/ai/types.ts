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

/**
 * The subset of a user's profile preferences that shapes how Arevias replies.
 * Carried with each request so the model can honor the user's personalization.
 */
export type AiPersonalization = {
  aboutYou?: string;
  responseGuidance?: string;
  responseStyle?: string;
  responseLength?: string;
  creativity?: string;
  personalities?: string[];
  emoji?: string;
  slang?: string;
  messageStyle?: string;
  punctuation?: string;
  occupation?: string;
  goals?: string;
  interests?: string;
  communication?: string;
  /** When false, the context fields (occupation/goals/interests/communication) are ignored. */
  contextEnabled?: boolean;
};

export type AiReplyRequest = {
  message: string;
  history?: AiHistoryMessage[];
  replyTo?: AiReplyContext | null;
  personalization?: AiPersonalization | null;
  /**
   * Human-readable time context computed on the client (which owns the correct
   * timezone): current time of day + how long the user took to reply. Lets
   * Arevias reason about time without the server guessing the user's locale.
   */
  timeContext?: string | null;
};

/** Why a reply was a limit message rather than a normal one. */
export type LimitReason = "signup" | "signoff";

export type AiReplyResponse = {
  text: string;
  /** True when this is the daily-cap message instead of a normal reply. */
  limited?: boolean;
  reason?: LimitReason;
};

/** What the client adapter hands back: the message parts plus limit signaling. */
export type AiReplyResult = {
  parts: string[];
  limited?: boolean;
  reason?: LimitReason;
};

/**
 * "Living Conversation" — the decision layer's verdict on whether Arevias would
 * naturally send one more spontaneous follow-up after its last reply.
 * `delay` is seconds to wait before sending; `message` is the follow-up text.
 */
export type AfterthoughtDecision = {
  continueConversation: boolean;
  delay: number;
  message: string;
};

/** A reply request plus the reply just sent, so the decision avoids repeating it. */
export type AfterthoughtRequest = AiReplyRequest & {
  lastReply: string;
  /** Afterthoughts already sent since the user's last message — raises the bar for another. */
  priorAfterthoughts?: number;
};

export type AiAdapter = {
  /** Returns the reply message fragments (1–3) plus any daily-limit signal. */
  generateReplyParts(input: AiReplyRequest): Promise<AiReplyResult>;
  /**
   * Decides whether to send a spontaneous follow-up. Returns null (or a decision
   * with `continueConversation: false`) when Arevias should stay quiet —
   * which is the common, intended case.
   */
  generateAfterthought(
    input: AfterthoughtRequest,
  ): Promise<AfterthoughtDecision | null>;
};
