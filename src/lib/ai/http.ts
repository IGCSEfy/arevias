import type { AiAdapter, AiHistoryMessage, AiReplyRequest } from "./types";

const FALLBACK_REPLY = "something's off, try again in a bit";

export class HttpAiAdapter implements AiAdapter {
  async generateReplyParts(input: AiReplyRequest): Promise<string[]> {
    try {
      const response = await fetch("/api/arevias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(toPayload(input)),
      });

      const data = (await response.json()) as Partial<{ text: unknown }>;
      const text = typeof data.text === "string" ? data.text.trim() : "";

      return splitReplyText(text || FALLBACK_REPLY);
    } catch {
      return [FALLBACK_REPLY];
    }
  }
}

function toPayload(input: AiReplyRequest): AiReplyRequest {
  return {
    message: input.message,
    history: input.history?.slice(-8).map(toHistoryMessage) ?? [],
    replyTo: input.replyTo ?? null,
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

function splitReplyText(text: string) {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) {
    return [FALLBACK_REPLY];
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
