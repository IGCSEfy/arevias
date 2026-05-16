import "@tanstack/react-start/server-only";
import type {
  AiHistoryMessage,
  AiReplyContext,
  AiReplyRequest,
} from "./types";

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 10_000;

const SYSTEM_INSTRUCTION = [
  "You are Arevias.",
  "You are not a generic assistant.",
  "You are a human-like conversation partner.",
  "Reply like a real person texting.",
  "Match the user's tone, grammar, punctuation, casing, and energy.",
  "If the user writes casually, reply casually.",
  "If the user avoids full stops, avoid full stops too.",
  "If the user sends short messages, reply short.",
  "Do not add emojis unless the user used emojis first.",
  "Do not sound formal, corporate, robotic, or overly helpful.",
  "Do not say \"As an AI\".",
  "Do not ask generic assistant questions like \"How can I help?\"",
  "Keep normal replies short unless detail is clearly needed.",
  "Use any reply context only to understand what the user is answering.",
  "Return only the message text.",
].join("\n");

type GeminiContent = {
  role?: "user" | "model";
  parts: Array<{ text: string }>;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export class GeminiRateLimitError extends Error {
  name = "GeminiRateLimitError";
}

export async function generateAreviasReply(
  input: AiReplyRequest,
): Promise<string> {
  const message = clean(input.message, 1_200);
  if (!message) {
    throw new Error("Missing message");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini unavailable");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(buildGeminiRequest(input, message)),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new GeminiRateLimitError();
      }

      throw new Error("Gemini request failed");
    }

    const data = (await response.json()) as GeminiResponse;
    const text = extractText(data);

    if (!text) {
      throw new Error("Empty Gemini response");
    }

    return normalizeReply(text);
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildGeminiRequest(input: AiReplyRequest, message: string) {
  return {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      ...toHistoryContents(input.history),
      {
        role: "user",
        parts: [{ text: formatLatestMessage(message, input.replyTo) }],
      },
    ],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 80,
      responseMimeType: "text/plain",
      thinkingConfig: {
        thinkingBudget: 0,
      },
    },
  };
}

function toHistoryContents(history: AiHistoryMessage[] = []): GeminiContent[] {
  return history
    .filter((item) => item && typeof item.text === "string")
    .slice(-8)
    .map((item) => ({
      role: toGeminiRole(item.role),
      parts: [
        {
          text: item.replyTo
            ? `${formatReplyContext(item.replyTo)}\n${clean(item.text, 600)}`
            : clean(item.text, 600),
        },
      ],
    }))
    .filter((item) => item.parts[0]?.text);
}

function toGeminiRole(role: AiHistoryMessage["role"]): GeminiContent["role"] {
  return role === "ai" ? "model" : "user";
}

function formatLatestMessage(
  message: string,
  replyTo?: AiReplyContext | null,
) {
  if (!replyTo?.text) {
    return message;
  }

  return `${formatReplyContext(replyTo)}\nlatest user message:\n${message}`;
}

function formatReplyContext(replyTo: AiReplyContext) {
  const speaker = replyTo.role === "ai" ? "Arevias" : "the user";
  return `replying to ${speaker}: "${clean(replyTo.text, 500)}"`;
}

function extractText(data: GeminiResponse) {
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim() ?? ""
  );
}

function normalizeReply(text: string) {
  return clean(text, 700)
    .replace(/^arevias:\s*/i, "")
    .replace(/^["'](.+)["']$/s, "$1")
    .trim();
}

function clean(text: string, maxLength: number) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}
