import "@tanstack/react-start/server-only";
import type { AiHistoryMessage } from "@/lib/ai/types";

/**
 * Instagram DM auto-reply pipeline.
 *
 * This is the **same Arevias** as the website chat — not a separate system. On
 * an inbound DM we hand the thread to the exact web engine (`generateAreviasReply`)
 * so Arevias mirrors whoever it's talking to (the DM sender): their bursts,
 * punctuation, length, and vibe, on default settings — plus the same hold-and-retry
 * on model rate limits. We split the reply into separate DMs (Instagram sends
 * discrete messages) and persist the exchange so it remembers the conversation.
 *
 * A short per-sender daily cap (reusing the web chat's usage limiter) keeps it
 * feeling human: the last allowed message folds in a goodbye (and an optional,
 * subtle nudge to arevias.com); past that Arevias just goes quiet until the next
 * day, then picks the conversation back up acknowledging the gap.
 */

const IG_GRAPH = "https://graph.instagram.com/v21.0";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HISTORY_LIMIT = 16;
// Messages Arevias will reply to per sender per day (reusing the web chat's
// daily usage limiter). The last one folds in a goodbye; anything past it is met
// with silence until the next day. Short on purpose — a taste, not a 24/7 line.
const DAILY_REPLY_LIMIT = 6;
// Below this gap we treat the thread as an active conversation; above it, Arevias
// notices it had gone quiet and picks things back up ("oh shit sorry, im back").
const GAP_NUDGE_MS = 3 * 60 * 60 * 1000;

type IgMessaging = {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: { text?: string; is_echo?: boolean; mid?: string };
};
type IgWebhookBody = {
  object?: string;
  entry?: Array<{ id?: string; messaging?: IgMessaging[] }>;
};

async function admin() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function handleInstagramEvent(body: unknown): Promise<void> {
  const data = body as IgWebhookBody;
  if (data?.object !== "instagram" || !Array.isArray(data.entry)) return;

  for (const entry of data.entry) {
    for (const m of entry.messaging ?? []) {
      const text = m.message?.text?.trim();
      const senderId = m.sender?.id;
      const accountId = m.recipient?.id; // the connected (owner) account that got the DM

      // Real inbound text DMs only: skip echoes (our own sends), non-text
      // events, missing ids, and self-messages (avoids loops).
      if (!text || m.message?.is_echo || !senderId || !accountId) continue;
      if (senderId === accountId) continue;

      try {
        await handleInbound(accountId, senderId, text);
      } catch (err) {
        console.error("[instagram] reply failed", err);
      }
    }
  }
}

async function handleInbound(accountId: string, senderId: string, text: string) {
  const sb = await admin();
  if (!sb) {
    console.warn("[instagram] supabase admin unavailable");
    return;
  }

  // Which Arevias account owns this IG account?
  const { data: conn } = await sb
    .from("instagram_connections")
    .select("access_token, enabled")
    .eq("ig_account_id", accountId)
    .maybeSingle();

  if (!conn || conn.enabled === false) return; // not connected / auto-reply off

  const token = conn.access_token || process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    console.warn("[instagram] no access token for", accountId);
    return;
  }

  // Recent thread history with this sender (oldest → newest), in the web chat's
  // shape: the sender is "user", our past replies are "ai".
  const { data: rows } = await sb
    .from("instagram_messages")
    .select("role, text, created_at")
    .eq("ig_account_id", accountId)
    .eq("sender_id", senderId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const prior = (rows ?? []) as {
    role: "in" | "out";
    text: string;
    created_at: string;
  }[];

  // When did we last reply? Used to notice a long silence so Arevias can pick the
  // conversation back up naturally after being "away" (rows are newest-first).
  const lastOut = prior.find((r) => r.role === "out");
  const lastOutAt = lastOut ? Date.parse(lastOut.created_at) : null;

  const history: AiHistoryMessage[] = prior
    .reverse()
    .map((r) => ({ role: r.role === "out" ? "ai" : "user", text: r.text }));

  // Record the inbound message before deciding what to do with it — so even
  // messages we don't reply to are remembered as part of the thread.
  await sb
    .from("instagram_messages")
    .insert({ ig_account_id: accountId, sender_id: senderId, role: "in", text });

  // Daily per-sender cap, reusing the web chat's usage limiter (one connected
  // system). This increments and returns the sender's running total for today.
  const { countUsage } = await import("@/lib/rate-limit.server");
  const count = await countUsage(`ig:${accountId}:${senderId}`);

  // Over the cap → Arevias already said its goodbye, so it just goes quiet. The
  // message is still recorded above, so it has full context when it's "back".
  if (count > DAILY_REPLY_LIMIT) return;

  // Hand any long silence to the same timeContext mechanism the web chat uses
  // (only surfaced when a real person naturally would acknowledge the gap).
  const timeContext = buildGapContext(lastOutAt);

  // On the LAST allowed message, fold an in-character goodbye into the real reply
  // (and, when it fits the vibe, a light nudge toward arevias.com).
  const signingOff = count === DAILY_REPLY_LIMIT;

  // Who is this? Pull their display name + @username so Arevias can address them
  // naturally. Additive context only — the web chat can't have it, and the reply
  // engine is the same; the web simply never passes `identity`.
  const identity = await fetchSenderIdentity(senderId, token);

  // Generate the reply with the EXACT same engine as the website chat: Arevias
  // mirroring whoever it's talking to (here, the DM sender), default settings,
  // same burst behaviour, same hold-and-retry on model rate limits.
  const { generateAreviasReply, GeminiRateLimitError } = await import(
    "@/lib/ai/gemini.server"
  );
  let reply: string;
  try {
    reply = await generateAreviasReply(
      {
        message: text,
        history,
        replyTo: null,
        personalization: null,
        timeContext,
        identity,
      },
      signingOff ? { signOff: "ig" } : {},
    );
  } catch (err) {
    // Adaptive continuity: generateAreviasReply already waits out brief model
    // rate limits; if it still fails, send a natural fallback rather than going
    // silent — and don't store it as part of the remembered thread.
    const { AI_FALLBACK_RATE_LIMIT, AI_FALLBACK_GENERIC } = await import(
      "@/lib/ai/types"
    );
    const fallback =
      err instanceof GeminiRateLimitError
        ? AI_FALLBACK_RATE_LIMIT
        : AI_FALLBACK_GENERIC;
    await sendInstagramMessage(senderId, fallback, token);
    return;
  }

  // Split into bursts (double-texting) on line breaks; send each as its own DM
  // with a short, human delay, and persist each as part of the thread.
  const parts = splitBursts(reply);
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) await wait(800 + Math.random() * 700);
    await sendInstagramMessage(senderId, parts[i], token);
    await sb.from("instagram_messages").insert({
      ig_account_id: accountId,
      sender_id: senderId,
      role: "out",
      text: parts[i],
    });
  }
}

/**
 * If we last replied a long time ago, describe the gap so the reply engine can
 * have Arevias naturally acknowledge it was away ("oh shit sorry i vanished, im
 * back"). Returns null for an active conversation. The web's buildTimeInstruction
 * only surfaces this when a real person genuinely would, so it never feels forced.
 */
function buildGapContext(lastOutAt: number | null): string | null {
  if (!lastOutAt || !Number.isFinite(lastOutAt)) return null;
  const gapMs = Date.now() - lastOutAt;
  if (gapMs < GAP_NUDGE_MS) return null;
  return `You last replied to this person about ${humanizeDuration(gapMs)} ago and had gone quiet since — you'd stepped away and are only now getting back to them. Pick the conversation back up naturally.`;
}

function humanizeDuration(ms: number): string {
  const hours = Math.round(ms / 3_600_000);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function splitBursts(text: string): string[] {
  const parts = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts.slice(0, 3) : [text.trim()];
}

/** Look up a sender's display name + @username from their Instagram-scoped ID. */
async function fetchSenderIdentity(
  igsid: string,
  token: string,
): Promise<{ username?: string; name?: string }> {
  try {
    const res = await fetch(`${IG_GRAPH}/${igsid}?fields=name,username`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn("[instagram] identity lookup failed", res.status, detail);
      return {};
    }
    const data = (await res.json()) as { name?: string; username?: string };
    return { username: data.username, name: data.name };
  } catch (err) {
    console.warn("[instagram] identity lookup error", err);
    return {};
  }
}

async function sendInstagramMessage(
  recipientId: string,
  text: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${IG_GRAPH}/me/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[instagram] send failed", res.status, detail);
  }
}
