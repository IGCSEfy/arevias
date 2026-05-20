import "@tanstack/react-start/server-only";
import type {
  AiHistoryMessage,
  AiReplyContext,
  AiReplyRequest,
} from "./types";

const PRIMARY_GEMINI_MODEL = "gemini-2.5-flash-lite";
const FALLBACK_GEMINI_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
];
const GEMINI_MODELS = [PRIMARY_GEMINI_MODEL, ...FALLBACK_GEMINI_MODELS];
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 250;
const MODEL_RATE_LIMIT_COOLDOWN_MS = 60_000;
const MODEL_RATE_LIMIT_MAX_COOLDOWN_MS = 10 * 60_000;

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

const modelRateLimitCooldowns = new Map<string, number>();

export class GeminiRateLimitError extends Error {
  name = "GeminiRateLimitError";

  constructor(readonly retryAfterMs?: number) {
    super("Gemini rate limit");
  }
}

class GeminiTransientError extends Error {
  name = "GeminiTransientError";
}

class GeminiModelUnavailableError extends Error {
  name = "GeminiModelUnavailableError";
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

  let rateLimitError: GeminiRateLimitError | null = null;
  let modelUnavailableError: GeminiModelUnavailableError | null = null;

  for (const model of GEMINI_MODELS) {
    const cooldownMs = getModelRateLimitCooldown(model);
    if (cooldownMs > 0) {
      rateLimitError ??= new GeminiRateLimitError(cooldownMs);
      continue;
    }

    try {
      return await requestGeminiWithRetry(input, message, apiKey, model);
    } catch (error) {
      if (error instanceof GeminiRateLimitError) {
        rateLimitError = error;
        setModelRateLimitCooldown(model, error.retryAfterMs);
        continue;
      }

      if (error instanceof GeminiModelUnavailableError) {
        modelUnavailableError = error;
        continue;
      }

      throw error;
    }
  }

  throw (
    rateLimitError ?? modelUnavailableError ?? new Error("Gemini request failed")
  );
}

function getModelRateLimitCooldown(model: string) {
  const retryAt = modelRateLimitCooldowns.get(model);
  if (!retryAt) return 0;

  const remainingMs = retryAt - Date.now();
  if (remainingMs <= 0) {
    modelRateLimitCooldowns.delete(model);
    return 0;
  }

  return remainingMs;
}

function setModelRateLimitCooldown(model: string, retryAfterMs?: number) {
  const cooldownMs = clampRetryDelay(
    retryAfterMs ?? MODEL_RATE_LIMIT_COOLDOWN_MS,
  );
  modelRateLimitCooldowns.set(model, Date.now() + cooldownMs);
}

async function requestGeminiWithRetry(
  input: AiReplyRequest,
  message: string,
  apiKey: string,
  model: string,
) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await requestGemini(input, message, apiKey, model);
    } catch (error) {
      if (error instanceof GeminiRateLimitError) {
        throw error;
      }

      if (attempt < MAX_ATTEMPTS - 1 && isRetriableGeminiError(error)) {
        await wait(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      throw error;
    }
  }

  throw new Error("Gemini request failed");
}

async function requestGemini(
  input: AiReplyRequest,
  message: string,
  apiKey: string,
  model: string,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(getGeminiEndpoint(model), {
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
        throw new GeminiRateLimitError(await parseRetryDelay(response));
      }

      if (isModelUnavailableStatus(response.status)) {
        throw new GeminiModelUnavailableError();
      }

      if (isTransientStatus(response.status)) {
        throw new GeminiTransientError();
      }

      throw new Error("Gemini request failed");
    }

    const data = (await response.json()) as GeminiResponse;
    const text = extractText(data);

    if (!text) {
      throw new GeminiTransientError();
    }

    return normalizeReply(text);
  } finally {
    clearTimeout(timeoutId);
  }
}

function isRetriableGeminiError(error: unknown) {
  return (
    error instanceof GeminiTransientError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError")
  );
}

async function parseRetryDelay(response: Response) {
  return parseRetryAfterHeader(response) ?? (await parseRetryAfterBody(response));
}

function getGeminiEndpoint(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function parseRetryAfterHeader(response: Response) {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return clampRetryDelay(seconds * 1_000);
  }

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return undefined;

  return clampRetryDelay(retryAt - Date.now());
}

async function parseRetryAfterBody(response: Response) {
  try {
    const data = (await response.clone().json()) as {
      error?: {
        details?: Array<{ retryDelay?: unknown }>;
      };
    };
    const retryDelay = data.error?.details?.find(
      (detail) => typeof detail.retryDelay === "string",
    )?.retryDelay;

    if (typeof retryDelay !== "string") return undefined;

    const ms = parseGoogleDuration(retryDelay);
    return ms == null ? undefined : clampRetryDelay(ms);
  } catch {
    return undefined;
  }
}

function clampRetryDelay(ms: number) {
  return Math.min(
    Math.max(ms, 1_000),
    MODEL_RATE_LIMIT_MAX_COOLDOWN_MS,
  );
}

function parseGoogleDuration(duration: string) {
  const match = duration.match(/^(\d+(?:\.\d+)?)s$/);
  if (!match) return undefined;

  return Number(match[1]) * 1_000;
}

function isTransientStatus(status: number) {
  return [408, 409, 425, 500, 502, 503, 504].includes(status);
}

function isModelUnavailableStatus(status: number) {
  return [400, 403, 404].includes(status);
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

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
