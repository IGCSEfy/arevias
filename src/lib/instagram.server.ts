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
 */

const IG_GRAPH = "https://graph.instagram.com/v21.0";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HISTORY_LIMIT = 16;

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
    .select("role, text")
    .eq("ig_account_id", accountId)
    .eq("sender_id", senderId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const history: AiHistoryMessage[] = (
    (rows ?? []) as { role: "in" | "out"; text: string }[]
  )
    .reverse()
    .map((r) => ({ role: r.role === "out" ? "ai" : "user", text: r.text }));

  // Record the inbound message before replying.
  await sb
    .from("instagram_messages")
    .insert({ ig_account_id: accountId, sender_id: senderId, role: "in", text });

  // Generate the reply with the EXACT same engine as the website chat: Arevias
  // mirroring whoever it's talking to (here, the DM sender), default settings,
  // same burst behaviour, same hold-and-retry on model rate limits.
  const { generateAreviasReply, GeminiRateLimitError } = await import(
    "@/lib/ai/gemini.server"
  );
  let reply: string;
  try {
    reply = await generateAreviasReply({
      message: text,
      history,
      replyTo: null,
      personalization: null,
      timeContext: null,
    });
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

function splitBursts(text: string): string[] {
  const parts = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts.slice(0, 3) : [text.trim()];
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
