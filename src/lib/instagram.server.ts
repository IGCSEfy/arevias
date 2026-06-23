import "@tanstack/react-start/server-only";
import type { AiPersonalization } from "@/lib/ai/types";

/**
 * Instagram DM auto-reply pipeline.
 *
 * On an inbound DM: find the Arevias account that owns the receiving IG account,
 * load that owner's personalization + the thread history with this sender, have
 * Arevias generate a reply **in the owner's own voice**, send it back (splitting
 * into bursts / double-texts per the owner's style), and persist the exchange so
 * it remembers the conversation next time.
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
    .select("user_id, access_token, enabled, custom_instructions, use_personalization")
    .eq("ig_account_id", accountId)
    .maybeSingle();

  if (!conn || conn.enabled === false) return; // not connected / auto-reply off

  const token = conn.access_token || process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    console.warn("[instagram] no access token for", accountId);
    return;
  }

  // Apply the owner's Arevias personalization only when the connection opts in
  // (set when they properly connect their account). Until then, neutral
  // defaults — reply naturally and mirror, without their personal-chat
  // personality/style bleeding into DM replies.
  let preferences: AiPersonalization | null = null;
  if (conn.use_personalization) {
    const { data: profile } = await sb
      .from("profiles")
      .select("preferences")
      .eq("id", conn.user_id)
      .maybeSingle();
    preferences = (profile?.preferences ?? null) as AiPersonalization | null;
  }

  // Recent thread history with this sender (oldest → newest).
  const { data: rows } = await sb
    .from("instagram_messages")
    .select("role, text")
    .eq("ig_account_id", accountId)
    .eq("sender_id", senderId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const history = ((rows ?? []) as { role: "in" | "out"; text: string }[])
    .reverse()
    .map((r) => ({ role: r.role, text: r.text }));

  // Record the inbound message before replying.
  await sb
    .from("instagram_messages")
    .insert({ ig_account_id: accountId, sender_id: senderId, role: "in", text });

  // Who is this? Pull their username + display name so the reply addresses them
  // naturally (real name over handle, recognize nicknames, etc.).
  const identity = await fetchSenderIdentity(senderId, token);

  // Generate the reply in the owner's voice.
  const { generateAsUserReply } = await import("@/lib/ai/gemini.server");
  const reply = await generateAsUserReply({
    message: text,
    history,
    preferences,
    customInstructions: conn.custom_instructions || undefined,
    senderUsername: identity.username,
    senderName: identity.name,
  });

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
