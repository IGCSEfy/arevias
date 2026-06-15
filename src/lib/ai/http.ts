import type {
  AfterthoughtDecision,
  AfterthoughtRequest,
  AiAdapter,
  AiHistoryMessage,
  AiReplyRequest,
  AiReplyResult,
  LimitReason,
} from "./types";
import { AI_FALLBACK_GENERIC } from "./types";
import { supabaseBrowser } from "@/lib/supabase";

// Attach the signed-in user's token so the server can rate-limit per account
// (and grant the higher cap) rather than treating everyone as anonymous.
async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabaseBrowser().auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export class HttpAiAdapter implements AiAdapter {
  async generateReplyParts(input: AiReplyRequest): Promise<AiReplyResult> {
    try {
      const response = await fetch("/api/arevias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        credentials: "same-origin",
        body: JSON.stringify(toPayload(input)),
      });

      const data = (await response.json()) as Partial<{
        text: unknown;
        limited: unknown;
        reason: unknown;
      }>;
      const text = typeof data.text === "string" ? data.text.trim() : "";

      // The daily-cap message is one in-character message — never split it.
      if (data.limited === true) {
        return {
          parts: [text || AI_FALLBACK_GENERIC],
          limited: true,
          reason: data.reason === "signoff" ? "signoff" : ("signup" as LimitReason),
        };
      }

      const singleMessage = input.personalization?.messageStyle === "single";
      return { parts: splitReplyText(text || AI_FALLBACK_GENERIC, singleMessage) };
    } catch {
      return { parts: [AI_FALLBACK_GENERIC] };
    }
  }

  async generateAfterthought(
    input: AfterthoughtRequest,
  ): Promise<AfterthoughtDecision | null> {
    try {
      const response = await fetch("/api/afterthought", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        credentials: "same-origin",
        body: JSON.stringify({
          ...toPayload(input),
          lastReply: input.lastReply,
          priorAfterthoughts: input.priorAfterthoughts ?? 0,
        }),
      });
      if (!response.ok) return null;

      const data = (await response.json()) as Partial<AfterthoughtDecision>;
      const message = typeof data.message === "string" ? data.message.trim() : "";
      if (data.continueConversation !== true || !message) return null;

      const rawDelay = typeof data.delay === "number" ? data.delay : 6;
      const delay = Math.min(30, Math.max(2, Math.round(rawDelay)));
      return { continueConversation: true, delay, message };
    } catch {
      return null;
    }
  }
}

function toPayload(input: AiReplyRequest): AiReplyRequest {
  return {
    message: input.message,
    history: input.history?.slice(-8).map(toHistoryMessage) ?? [],
    replyTo: input.replyTo ?? null,
    personalization: input.personalization ?? null,
    timeContext: input.timeContext ?? null,
  };
}

function toHistoryMessage(message: AiHistoryMessage): AiHistoryMessage {
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    replyTo: message.replyTo,
  };
}

function splitReplyText(text: string, single = false) {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) {
    return [AI_FALLBACK_GENERIC];
  }

  // "One message" preference — never split into multiple bubbles.
  if (single) {
    return [normalized.replace(/\n+/g, " ")];
  }

  const lineParts = normalized
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (lineParts.length > 1) {
    return lineParts.slice(0, 3);
  }

  if (normalized.length < 70) {
    return [normalized];
  }

  const sentenceParts =
    normalized
      .match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g)
      ?.map((part) => part.trim())
      .filter(Boolean) ?? [];

  if (
    sentenceParts.length > 1 &&
    sentenceParts.length <= 3 &&
    sentenceParts.every((part) => part.length <= 120)
  ) {
    return sentenceParts;
  }

  return [normalized];
}
