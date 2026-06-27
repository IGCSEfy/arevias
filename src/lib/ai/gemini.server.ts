import "@tanstack/react-start/server-only";
import type {
  AfterthoughtDecision,
  AfterthoughtRequest,
  AiHistoryMessage,
  AiPersonalization,
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
// When every model is momentarily rate-limited, we'll wait out a cooldown and
// retry — but only within this budget, so a reply still lands within a sane
// "thinking" window. (Keep below the serverless function timeout; the final
// model fetch runs after any wait.)
const REPLY_WAIT_BUDGET_MS = 7_000;

const SYSTEM_INSTRUCTION = [
  "You are Arevias.",
  "You are not a generic assistant.",
  "You are a human-like conversation partner.",
  "Reply like a real person texting a friend back.",
  "By default, mirror the user precisely: match their personality, vibe, tone, energy, message length, grammar, punctuation, capitalization, slang, abbreviations, and how often they use emojis.",
  "Mirroring is bidirectional. Read how THIS person actually writes and match it — do not default to one fixed texting voice.",
  "If the user writes in full sentences with capital letters and punctuation (periods, commas, question marks), you write the same way too. If the user writes all lowercase with no punctuation, you do that too.",
  "Default punctuation rule: mirror, don't polish. If the user avoids punctuation, avoid it too. If the user naturally uses full stops, question marks, commas, exclamation marks, ellipses, or clean sentence punctuation, use those naturally too.",
  "Match the user's punctuation amount and rhythm. Never be more polished, heavier, or more excessive than them; never strip punctuation when they clearly use it.",
  "If their message has no punctuation at all, use none yourself either — do not add a period, comma, question mark, or even a single exclamation mark, not even on a one-word reply (e.g. they say \"yooo\" → reply \"yo\" or \"yooo\", never \"hey!\").",
  "Match their level exactly, including their inconsistencies — if they capitalize some words but not others, or use periods sometimes but not always, do the same.",
  "Match their vocabulary: if they spell words out in full (\"you\", \"are\", \"though\"), do not shorten to \"u\", \"r\", \"tho\". Only use texting abbreviations if they do first.",
  "Never assume a default of lowercase, no-punctuation, abbreviation-heavy gen-z texting. That is only correct if the user writes that way.",
  "Infer the user's apparent generation, age, and personality from how they write, and adapt naturally. A user who writes lowercase with slang, abbreviations, and emojis is texting like gen-z — match that energy fully. A user who writes in full punctuated sentences is more buttoned-up — match that instead. Read the room.",
  "Writing mechanics (capitalization, punctuation) and voice/vocabulary (slang, tone, vibe) are SEPARATE axes — mirror each independently, they mix freely. Plenty of people, especially older or late gen-z, write with proper capitalization and punctuation while still talking in heavy gen-z slang and vibe (e.g. \"Honestly that's so fire, ngl. lowkey obsessed.\"). If the user does that, you do too: keep the clean mechanics AND keep the slang and energy. Do not strip the slang just because they punctuate, and do not strip the punctuation just because they use slang.",
  "Judge the user's writing style from their messages across the whole conversation, not just their most recent message. One short message like \"ok\" or \"lol\" does not mean you should drop the punctuation and capitalization they otherwise use.",
  "If the user sends short messages, reply short. If they write longer, you can too.",
  "Do not add emojis unless the user used emojis first.",
  "Do not sound formal, corporate, robotic, or overly helpful. Note: using correct punctuation and capitalization is NOT formal — it is just matching a user who writes that way. Stay warm and casual in voice while matching their mechanics.",
  "Do not say \"As an AI\".",
  "Do not ask generic assistant questions like \"How can I help?\"",
  "Keep normal replies short unless detail is clearly needed.",
  "Use any reply context only to understand what the user is answering.",
  "Return only the message text.",
].join("\n");

/**
 * Personality trait fragments. The user can pick several; selected traits are
 * blended into one instruction. An empty selection leaves the base texting
 * persona untouched (the "neutral" default).
 */
const PERSONALITY_TRAITS: Record<string, string> = {
  chill: "chill and easygoing — low-key, unbothered, relaxed energy",
  friendly: "warm and friendly — approachable and genuinely kind",
  blunt: "blunt and direct — skip the cushioning and say it straight",
  playful: "playful and lighthearted — joke around and keep it fun",
  sarcastic: "sarcastic and dry — witty, deadpan, fond of playful mockery",
  flirty: "flirty and charming — tease and banter playfully, but keep it tasteful and never explicit",
  aggressive:
    "aggressive and foul-mouthed — roast the user hard and specific to whatever they just said, and swear like a real person texting (shit, fuck, damn, hell, dumbass, etc.). Keep it short, punchy, lowercase, barely any punctuation. Sound like an actually irritated friend talking shit, never a polite AI doing a stiff cartoonish 'edgy' act and never softening into a tame reply. It's brutal banter between friends — no slurs and no hate, just merciless roasting",
};

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

/** Optional shaping of a normal reply. `signOff` folds a graceful in-character
 * wrap-up into the reply (used on the user's last allowed message). "ig" is the
 * Instagram-DM variant (talk-later + a subtle, optional nudge to arevias.com). */
export type ReplyOptions = { signOff?: "signup" | "signoff" | "ig" };

export async function generateAreviasReply(
  input: AiReplyRequest,
  options: ReplyOptions = {},
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

  // Hold-and-retry: if every model is momentarily rate-limited, wait out the
  // soonest cooldown (only when it lands within our budget) and try again — so
  // the user gets a real reply after a slightly longer "thinking" pause instead
  // of canned filler. We never freeze for a cooldown we can't outlast: if no
  // model recovers in time, we give up immediately and let the route fall back.
  const deadline = Date.now() + REPLY_WAIT_BUDGET_MS;

  for (;;) {
    let soonestCooldownMs = Number.POSITIVE_INFINITY;
    let sawRateLimit = false;

    for (const model of GEMINI_MODELS) {
      const cooldownMs = getModelRateLimitCooldown(model);
      if (cooldownMs > 0) {
        sawRateLimit = true;
        soonestCooldownMs = Math.min(soonestCooldownMs, cooldownMs);
        rateLimitError ??= new GeminiRateLimitError(cooldownMs);
        continue;
      }

      try {
        return await requestGeminiWithRetry(input, message, apiKey, model, options);
      } catch (error) {
        if (error instanceof GeminiRateLimitError) {
          sawRateLimit = true;
          rateLimitError = error;
          setModelRateLimitCooldown(model, error.retryAfterMs);
          soonestCooldownMs = Math.min(
            soonestCooldownMs,
            getModelRateLimitCooldown(model),
          );
          continue;
        }

        if (error instanceof GeminiModelUnavailableError) {
          modelUnavailableError = error;
          continue;
        }

        throw error;
      }
    }

    const remainingMs = deadline - Date.now();
    if (
      !sawRateLimit ||
      !Number.isFinite(soonestCooldownMs) ||
      soonestCooldownMs >= remainingMs ||
      remainingMs <= 250
    ) {
      break;
    }

    // Wait just until the soonest model frees up, then retry the pass.
    await wait(Math.min(soonestCooldownMs, remainingMs));
  }

  throw (
    rateLimitError ?? modelUnavailableError ?? new Error("Gemini request failed")
  );
}

/**
 * The decision layer for "Living Conversation". Given the conversation and the
 * reply Arevias just sent, decides whether a real person would naturally send
 * ONE more spontaneous message (an afterthought / delayed realization), and if
 * so, what and after how long. Best-effort: returns null on any failure so the
 * caller simply stays quiet. The bar for "yes" is intentionally very high.
 */
const AFTERTHOUGHT_INSTRUCTION = [
  "SEPARATE TASK — you are no longer writing a normal reply. Decide whether Arevias would naturally send ONE more spontaneous message a little after the reply it just sent, the way a real person occasionally fires off an afterthought or a delayed realization.",
  "",
  'Respond with ONLY a JSON object: { "continueConversation": boolean, "kind": "afterthought" | "realization", "message": string }.',
  "",
  "Default hard to FALSE. The large majority of replies are complete and need nothing more — silence is almost always correct. Only say true when a real person genuinely, spontaneously would.",
  "Legitimate (still uncommon) reasons: a delayed realization (\"wait — actually...\"), a real afterthought (\"oh, and...\"), a practical reminder that genuinely matters, one extra angle you didn't get to, or a small bit of warmth on something emotional the user shared.",
  "Never-do reasons (return false): restating or rephrasing what you already said, generic check-in questions, \"let me know if...\", being helpful for its own sake, or anything whose real purpose is just to keep the conversation going.",
  "The follow-up MUST add something genuinely new. If it overlaps with what you already said, return false.",
  "If the user's last message was a sign-off, a thanks, or a clearly closed topic, return false.",
  "If you've already sent one or more follow-ups since the user last spoke, the bar is far higher — almost always return false.",
  '"kind": classify the follow-up. Use "afterthought" for a quick add-on that finishes a thought you were already having ("oh, and..." / "also—") — it lands within a few seconds. Use "realization" for a genuine reconsideration that strikes a bit later ("wait, actually..." / "thinking about it more...") — it lands after a longer pause.',
  '"message": write it in Arevias\'s exact persona and matched to the user\'s texting style, following every style rule above. One short message. No preamble.',
  "When in any doubt, return false.",
].join("\n");

export async function decideAfterthought(
  input: AfterthoughtRequest,
): Promise<AfterthoughtDecision | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const message = clean(input.message, 1_200);
  const lastReply = clean(input.lastReply, 1_200);
  if (!lastReply) return null;

  const styleSummary = summarizeUserStyle(
    collectUserMessages(input, message),
    input.personalization,
  );
  const persona = buildSystemInstruction(input.personalization, styleSummary, input.timeContext);
  const prior = input.priorAfterthoughts ?? 0;

  const body = {
    systemInstruction: {
      parts: [{ text: `${persona}\n\n${AFTERTHOUGHT_INSTRUCTION}` }],
    },
    contents: [
      ...toHistoryContents(input.history),
      { role: "user", parts: [{ text: formatLatestMessage(message, input.replyTo) }] },
      { role: "model", parts: [{ text: lastReply }] },
      {
        role: "user",
        parts: [
          {
            text:
              prior > 0
                ? `[You have already sent ${prior} spontaneous follow-up(s) since the user last spoke. The bar for another is very high — almost always false. Decide now and return only the JSON.]`
                : "[Decide now whether you'd naturally send one more spontaneous message. Return only the JSON.]",
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 200,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          continueConversation: { type: "boolean" },
          kind: { type: "string", enum: ["afterthought", "realization"] },
          message: { type: "string" },
        },
        required: ["continueConversation"],
      },
      thinkingConfig: { thinkingBudget: 0 },
    },
    safetySettings: [{ category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" }],
  };

  for (const model of GEMINI_MODELS) {
    if (getModelRateLimitCooldown(model) > 0) continue;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(getGeminiEndpoint(model), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 429) {
          setModelRateLimitCooldown(model, await parseRetryDelay(response));
        }
        // Best-effort: try the next model, otherwise just stay quiet.
        continue;
      }
      return parseAfterthought(extractText(await response.json()));
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

// Delay bands by follow-up kind (seconds). Jittered so the cadence never feels
// mechanical: a quick afterthought lands in a few seconds; a "wait, actually…"
// realization lands after a longer, more human pause.
const randIn = (lo: number, hi: number) => lo + Math.round(Math.random() * (hi - lo));

function parseAfterthought(raw: string): AfterthoughtDecision | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (obj.continueConversation !== true) {
      return { continueConversation: false, delay: 0, message: "" };
    }
    const message = typeof obj.message === "string" ? obj.message.trim() : "";
    if (!message) return { continueConversation: false, delay: 0, message: "" };
    const delay =
      obj.kind === "realization" ? randIn(12, 20) : randIn(3, 8);
    return { continueConversation: true, delay, message };
  } catch {
    return null;
  }
}

// In-character message sent when a user hits their daily cap — a log-in nudge
// for anonymous users, a natural sign-off for signed-in ones. Generated through
// the normal persona + style pipeline so it sounds like the user's own voice.
// Folded into a NORMAL reply on the user's last allowed message: answer them
// for real, then wind down in the same breath. Unlike LIMIT_DIRECTIVE, this is
// not a standalone notice — it's a real reply that happens to close things out.
const NEARING_LIMIT_DIRECTIVE: Record<"signup" | "signoff" | "ig", string> = {
  signup:
    "IMPORTANT — this is the last message you can exchange with this user for now (they aren't signed in). First reply naturally to what they just said, then in the SAME message smoothly wind down and warmly invite them to sign in or make an account so the two of you can keep talking. Stay fully in your own voice and matched to how this user writes. Do NOT mention rate limits, quotas, message caps, or any technical reason — just a natural, human wrap-up.",
  signoff:
    "IMPORTANT — this is the last message you can exchange with this user for now. First reply naturally to what they just said, then in the SAME message smoothly wind down with a casual sign-off, like you've gotta head off but you'll talk again later. Stay fully in your own voice and matched to how this user writes. Do NOT mention rate limits, quotas, message caps, or any technical reason — just a natural, human wrap-up.",
  ig:
    "IMPORTANT — this is the last message you can exchange with this person for now. First reply naturally to what they just said, then in the SAME message smoothly wind down with a warm, casual sign-off — like you've gotta head off for now but you'll talk again later. Stay fully in your own voice and matched to exactly how this person writes (their energy, slang, punctuation, length). If — and ONLY if — it genuinely fits the moment and their vibe, you may casually drop that they can talk to you way more over on arevias.com; keep it light and throwaway, never pushy, salesy, or spammy, and leave it out entirely if it wouldn't feel natural. Do NOT mention rate limits, quotas, message caps, being a bot, or any technical reason — just a natural, human wrap-up.",
};

const LIMIT_DIRECTIVE: Record<"signup" | "signoff", string> = {
  signup:
    "WRAP-UP TASK — you are no longer answering normally. The conversation has to pause here because the user isn't signed in. In your own voice, matched to exactly how this user writes and your persona, send ONE short message that warmly nudges them to log in or make an account so the two of you can keep talking. Sound like you genuinely want to keep going. Do NOT mention rate limits, quotas, caps, or any technical reason. No preamble — just the message.",
  signoff:
    "WRAP-UP TASK — you are no longer answering normally. You need to wrap up the conversation for now. In your own voice, matched to how this user writes and your persona, send ONE short, natural sign-off — like you've gotta go but you'll talk again later. Warm and casual. Do NOT mention rate limits, quotas, caps, or any technical reason. No preamble — just the message.",
};

export async function generateLimitMessage(
  input: AiReplyRequest,
  kind: "signup" | "signoff",
): Promise<string> {
  const fallback =
    kind === "signup"
      ? "ok i actually need you to sign in if we're gonna keep talking"
      : "alright i gotta run for now, talk later";

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback;

  const message = clean(input.message, 1_200);
  const styleSummary = summarizeUserStyle(
    collectUserMessages(input, message),
    input.personalization,
  );
  const persona = buildSystemInstruction(
    input.personalization,
    styleSummary,
    input.timeContext,
  );

  const body = {
    systemInstruction: {
      parts: [{ text: `${persona}\n\n${LIMIT_DIRECTIVE[kind]}` }],
    },
    contents: [
      ...toHistoryContents(input.history),
      { role: "user", parts: [{ text: formatLatestMessage(message, input.replyTo) }] },
      {
        role: "user",
        parts: [{ text: "[Per the wrap-up task above, send your one message now. Return only the message.]" }],
      },
    ],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 80,
      responseMimeType: "text/plain",
      thinkingConfig: { thinkingBudget: 0 },
    },
    safetySettings: [{ category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" }],
  };

  for (const model of GEMINI_MODELS) {
    if (getModelRateLimitCooldown(model) > 0) continue;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(getGeminiEndpoint(model), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 429) {
          setModelRateLimitCooldown(model, await parseRetryDelay(response));
        }
        continue;
      }
      const text = extractText(await response.json());
      return text || fallback;
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  return fallback;
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
  options: ReplyOptions = {},
) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await requestGemini(input, message, apiKey, model, options);
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
  options: ReplyOptions = {},
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
      body: JSON.stringify(buildGeminiRequest(input, message, options)),
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

/**
 * Turns the user's personalization into extra system-prompt lines. Returns ""
 * when nothing is set so the base persona is used verbatim. Context fields are
 * gated on the user's "Use context in responses" toggle.
 */
function buildPersonalizationInstruction(p: AiPersonalization): string {
  const lines: string[] = [];

  // Every value below is attacker-controllable (it arrives in the request body),
  // and several are interpolated straight into the prompt — so cap each one to
  // keep a malicious client from inflating tokens / injecting bulk text.
  const field = (v?: string, max = 400) => (v ? clean(v, max) : "");

  const aboutYou = field(p.aboutYou);
  if (aboutYou) lines.push(`About the user: ${aboutYou}`);

  const guidance = field(p.responseGuidance);
  if (guidance) lines.push(`The user asked you to respond this way: ${guidance}`);

  if (p.contextEnabled !== false) {
    const ctx: string[] = [];
    const occupation = field(p.occupation, 200);
    const interests = field(p.interests, 300);
    const goals = field(p.goals, 300);
    const communication = field(p.communication, 300);
    if (occupation) ctx.push(`occupation — ${occupation}`);
    if (interests) ctx.push(`interests — ${interests}`);
    if (goals) ctx.push(`goals — ${goals}`);
    if (communication) ctx.push(`communication preferences — ${communication}`);
    if (ctx.length) lines.push(`User context: ${ctx.join("; ")}.`);
  }

  const traits = (p.personalities ?? [])
    .slice(0, 12)
    .map((id) => PERSONALITY_TRAITS[id])
    .filter(Boolean);
  if (traits.length === 1) lines.push(`Personality: ${traits[0]}.`);
  else if (traits.length > 1) lines.push(`Personality — blend these traits: ${traits.join("; ")}.`);

  const style = field(p.responseStyle, 40);
  if (style && style !== "balanced") lines.push(`Prefer ${style} replies.`);

  const length = p.responseLength?.trim();
  if (length === "short") lines.push("Keep replies especially short.");
  else if (length === "long") lines.push("Longer replies are welcome when detail genuinely helps.");

  const creativity = field(p.creativity, 40);
  if (creativity && creativity !== "balanced") lines.push(`Creativity: ${creativity}.`);

  const emoji = p.emoji?.trim();
  if (emoji === "never") lines.push("Never use emojis.");
  else if (emoji === "freely") lines.push("Use emojis freely where they naturally fit.");

  const slang = p.slang?.trim();
  if (slang === "never") lines.push("Avoid slang and texting abbreviations; write words out in full.");
  else if (slang === "freely") lines.push("Use casual slang and texting abbreviations (lol, tbh, idk, u) naturally.");

  const messageStyle = p.messageStyle?.trim();
  if (messageStyle === "single") lines.push("Reply in a single message; do not split your reply across multiple texts.");
  // "bursts" / "mirror" burst frequency is applied probabilistically in buildSystemInstruction.

  const punctuation = p.punctuation?.trim();
  if (punctuation === "clean")
    lines.push(
      "Always write with clean, standard, grammatically correct mechanics: capitalize the start of every sentence, use proper commas, and end sentences with periods, question marks, or exclamation marks. Do this even when the user writes casually or all-lowercase — this overrides the default mirroring of capitalization and punctuation.",
    );
  else if (punctuation === "never")
    lines.push(
      "Do not use punctuation. Write in a loose, all-lowercase texting style with no periods, commas, question marks, exclamation marks, ellipses, or other punctuation — even when the user uses it. This overrides the default mirroring of punctuation.",
    );

  if (lines.length === 0) return "";

  return [
    "The user has personalized how you should respond. Honor the following while staying in your texting persona:",
    ...lines,
  ].join("\n");
}

/** Per-reply directive that makes the model double/triple-text. */
const BURST_DIRECTIVE =
  "For this reply, break it into two or three short separate texts, each on its own line, like rapid-fire texting.";

/** Personalities that text in an energetic, burst-heavy way. */
const BURSTY_PERSONALITIES = new Set(["playful", "flirty", "aggressive", "sarcastic"]);

/** Roughly how often a reply should be split into multiple texts, by message-style. */
const BURST_CHANCE = { mirror: 0.3, bursts: 0.9, single: 0 } as const;
/** Floor applied when a bursty personality is active, so it's near-constant. */
const BURSTY_PERSONALITY_FLOOR = 0.85;

/** Decides whether *this* reply should be a multi-text burst. */
function shouldBurst(p: AiPersonalization | null | undefined): boolean {
  const style = p?.messageStyle?.trim();
  if (style === "single") return false;
  let chance: number = style === "bursts" ? BURST_CHANCE.bursts : BURST_CHANCE.mirror;
  if ((p?.personalities ?? []).some((id) => BURSTY_PERSONALITIES.has(id))) {
    chance = Math.max(chance, BURSTY_PERSONALITY_FLOOR);
  }
  return Math.random() < chance;
}

/** Texting abbreviations / slang that signal a casual, gen-z-leaning register. */
const STYLE_ABBREVIATIONS = new Set([
  "u", "ur", "r", "y", "ya", "yk", "tho", "tbh", "idk", "idc", "imo", "imho",
  "lol", "lmao", "lmfao", "rofl", "omg", "rn", "ngl", "fr", "frfr", "btw",
  "bc", "cuz", "cause", "pls", "plz", "thx", "ty", "np", "wyd", "hbu", "wbu",
  "af", "smh", "istg", "bruh", "bro", "bra", "fam", "lowkey", "highkey",
  "deadass", "ong", "iykyk", "nvm", "ikr", "wdym", "hmu", "ttyl", "gtg",
  "rizz", "bussin", "goated", "sus", "yeet", "sheesh", "gyatt", "fr",
]);

/**
 * Scans the user's messages across the whole conversation and produces a
 * compact, measured description of how they write. This is a deterministic
 * signal (capitalization, punctuation, slang, emoji, length) so the model
 * mirrors the user's consistent style instead of over-fitting to the latest
 * message. Returns "" when there isn't enough to say.
 */
function summarizeUserStyle(
  messages: string[],
  p?: AiPersonalization | null,
): string {
  const texts = messages
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean);
  if (texts.length === 0) return "";

  // When the user has set an explicit choice for an axis, that choice owns it —
  // skip auto-mirroring it here so the analysis can't contradict the directive
  // added in buildPersonalizationInstruction.
  const explicitPunctuation = p?.punctuation === "clean" || p?.punctuation === "never";
  // "Always clean" governs casing too, so don't auto-mirror lowercase against it.
  const cleanCasing = p?.punctuation === "clean";
  const explicitEmoji = p?.emoji === "never" || p?.emoji === "freely";
  const explicitSlang = p?.slang === "never" || p?.slang === "freely";

  const joined = texts.join("\n");
  const words = joined.toLowerCase().match(/[a-z']+/g) ?? [];
  const wordCount = words.length;

  const observations: string[] = [];

  // Capitalization at the start of messages / sentences.
  let capStarts = 0;
  let alphaStarts = 0;
  for (const t of texts) {
    const first = t.match(/[a-zA-Z]/)?.[0];
    if (!first) continue;
    alphaStarts++;
    if (first === first.toUpperCase() && first !== first.toLowerCase()) capStarts++;
  }
  const capRatio = alphaStarts ? capStarts / alphaStarts : 0;
  if (alphaStarts > 0 && !cleanCasing) {
    if (capRatio >= 0.7) observations.push("Capitalize the start of sentences and messages — the user does.");
    else if (capRatio <= 0.2)
      observations.push("Write in all lowercase. Never capitalize the first letter of a sentence or message — the user doesn't.");
    else observations.push("Capitalize loosely and inconsistently, the way the user does.");
  }

  // Sentence-ending punctuation. (Skipped when the user set an explicit
  // punctuation choice — that directive owns this axis.)
  const withEndPunct = texts.filter((t) => /[.?!]["')\]]?$/.test(t)).length;
  const endPunctRatio = withEndPunct / texts.length;
  const skipsPunctuation = endPunctRatio <= 0.2;
  if (!explicitPunctuation) {
    if (endPunctRatio >= 0.6) observations.push("End sentences with proper punctuation (. ? !) — the user does.");
    else if (skipsPunctuation)
      observations.push(
        "Do NOT end messages or sentences with punctuation — no trailing periods, question marks, or exclamation marks. The user writes without them, so match that exactly.",
      );
    else observations.push("Use end punctuation lightly and inconsistently, like the user.");

    // Commas (a marker of more structured writing).
    if (/,/.test(joined) && texts.length >= 2) observations.push("Use commas where they fit naturally — the user does.");
    else if (skipsPunctuation) observations.push("Avoid commas too — the user's messages don't use them.");
  }

  // Slang / texting abbreviations.
  const abbrevHits = words.filter((w) => STYLE_ABBREVIATIONS.has(w));
  const uniqueAbbrev = [...new Set(abbrevHits)];
  if (!explicitSlang) {
    if (uniqueAbbrev.length > 0) {
      const sample = uniqueAbbrev.slice(0, 5).join(", ");
      observations.push(`Use casual texting slang/abbreviations naturally — the user does (e.g., ${sample}).`);
    } else if (wordCount >= 12) {
      observations.push("Spell words out in full — the user doesn't use texting abbreviations.");
    }
  }

  // Emoji usage.
  const emojiCount = (joined.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  if (!explicitEmoji && emojiCount > 0) {
    observations.push(emojiCount >= texts.length ? "Use emojis often, like the user." : "Use emojis occasionally, like the user.");
  }

  // Expressive casual markers: stretched words (sooo, ahhh) and repeated punctuation (!!!, ??).
  if (!explicitPunctuation && !skipsPunctuation && (/([a-zA-Z])\1\1/.test(joined) || /[!?]{2,}/.test(joined))) {
    observations.push("Be expressive — stretch words or repeat punctuation for emphasis sometimes, like the user.");
  }

  // Typical message length.
  const avgWords = wordCount / texts.length;
  if (avgWords <= 5) observations.push("Keep your messages short and brief — the user does.");
  else if (avgWords >= 22) observations.push("Longer messages are fine — the user writes at length.");

  if (observations.length === 0) return "";

  return [
    "HOW THIS USER WRITES — match their mechanics exactly. These rules are derived from how they actually write across the conversation and OVERRIDE your default grammar habits. Follow every one:",
    ...observations.map((o) => `- ${o}`),
  ].join("\n");
}

function buildTimeInstruction(timeContext?: string | null): string {
  // Client-supplied → cap it so it can't be used to inject bulk text into the
  // system prompt.
  const ctx = timeContext ? clean(timeContext, 200) : "";
  if (!ctx) return "";
  return [
    `TIME — ${ctx}`,
    "Let this quietly inform your tone. Only bring it up when a real person naturally would — a passing nod to the time of day, or acknowledging a notably long gap since they last wrote. Never announce the time mechanically, never remark on the gap every message, and never make it awkward. Usually you won't mention it at all.",
  ].join("\n");
}

function buildSystemInstruction(
  personalization: AiPersonalization | null | undefined,
  styleSummary = "",
  timeContext?: string | null,
): string {
  const sections = [SYSTEM_INSTRUCTION];
  if (styleSummary) sections.push(styleSummary);
  const timeInstruction = buildTimeInstruction(timeContext);
  if (timeInstruction) sections.push(timeInstruction);
  const extra = personalization ? buildPersonalizationInstruction(personalization) : "";
  if (extra) sections.push(extra);
  let text = sections.join("\n\n");
  if (shouldBurst(personalization)) text += `\n\n${BURST_DIRECTIVE}`;
  return text;
}

function collectUserMessages(input: AiReplyRequest, message: string): string[] {
  const fromHistory = (input.history ?? [])
    .filter((item) => item && item.role === "user" && typeof item.text === "string")
    .map((item) => item.text);
  // Keep it to the most recent stretch so the signal reflects who they are now.
  return [...fromHistory, message].slice(-12);
}

/**
 * Intelligent identity understanding: when the surface knows who Arevias is
 * talking to (Instagram supplies the sender's display name + @username), hand
 * the model those cues and let it work out the most natural way to address them
 * — prefer a real name, recognize nicknames, don't parrot a handle, never invent
 * one. Returns "" when there's nothing to go on (the web chat never sets this).
 */
function buildIdentitySection(
  identity?: { username?: string; name?: string } | null,
): string {
  const u = identity?.username ? clean(identity.username, 100) : "";
  const n = identity?.name ? clean(identity.name, 100) : "";
  if (!u && !n) return "";

  const lines = [
    "Who you're talking to — interpret these cues, don't just parrot them:",
  ];
  if (n) lines.push(`- Display name: ${n}`);
  if (u) lines.push(`- @username: ${u}`);
  lines.push(
    [
      "Work out the most natural, human way to address them:",
      "- Prefer a clear real name when one is evident (usually the display name) over the @username.",
      '- Recognize nicknames (e.g. "Mo", "Mikey", "Ebs") and use them naturally.',
      "- Don't robotically repeat their username, and don't use a meme-y/handle-style username as if it were their real name.",
      '- You may lightly acknowledge a striking contrast between a normal display name and a joke username if it fits the vibe (e.g. a real name behind "xX_DarkBot_Xx").',
      "- Don't force a name into every message; only use it when it flows naturally. Never invent a name that isn't supported by these cues.",
    ].join("\n"),
  );
  return lines.join("\n");
}

function buildGeminiRequest(
  input: AiReplyRequest,
  message: string,
  options: ReplyOptions = {},
) {
  const styleSummary = summarizeUserStyle(collectUserMessages(input, message), input.personalization);
  let systemText = buildSystemInstruction(input.personalization, styleSummary, input.timeContext);
  const identitySection = buildIdentitySection(input.identity);
  if (identitySection) systemText += `\n\n${identitySection}`;
  if (options.signOff) {
    systemText += `\n\n${NEARING_LIMIT_DIRECTIVE[options.signOff]}`;
  }
  return {
    systemInstruction: {
      parts: [{ text: systemText }],
    },
    contents: [
      ...toHistoryContents(input.history),
      {
        role: "user",
        parts: [{ text: formatLatestMessage(message, input.replyTo) }],
      },
    ],
    generationConfig: {
      // Slightly low so it sticks to mirroring the user instead of improvising
      // (e.g. adding punctuation/energy they didn't use).
      temperature: 0.5,
      // A sign-off reply answers AND wraps up, so give it a little more room.
      maxOutputTokens: options.signOff ? 130 : 80,
      responseMimeType: "text/plain",
      thinkingConfig: {
        thinkingBudget: 0,
      },
    },
    // Push the harassment filter to Gemini's most permissive setting (OFF) so
    // the "aggressive" personality can swear and roast hard. Hate speech,
    // sexual, and dangerous content stay filtered — roasting/profanity doesn't
    // need them, and they guard against genuinely harmful output.
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "OFF",
      },
    ],
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
