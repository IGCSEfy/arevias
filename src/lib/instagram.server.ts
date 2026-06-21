import "@tanstack/react-start/server-only";

/**
 * Instagram DM reply pipeline (Phase 3, single-account MVP).
 *
 * Takes a parsed Instagram messaging webhook payload, and for each genuine
 * inbound text DM: generates a reply with Arevias's AI (in its conversational
 * voice, mirroring the sender) and sends it back via the Instagram Graph API.
 *
 * Single-account for now: uses INSTAGRAM_ACCESS_TOKEN from env (the connected
 * arevias.ai account). Multi-tenant token lookup per account comes in Phase 2.
 */

const IG_GRAPH = "https://graph.instagram.com/v21.0";

type IgMessaging = {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: { text?: string; is_echo?: boolean; mid?: string };
};

type IgWebhookBody = {
  object?: string;
  entry?: Array<{ id?: string; messaging?: IgMessaging[] }>;
};

export async function handleInstagramEvent(body: unknown): Promise<void> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    console.warn("[instagram] no INSTAGRAM_ACCESS_TOKEN — skipping reply");
    return;
  }

  const data = body as IgWebhookBody;
  if (data?.object !== "instagram" || !Array.isArray(data.entry)) return;

  const { generateAreviasReply } = await import("@/lib/ai/gemini.server");

  for (const entry of data.entry) {
    for (const m of entry.messaging ?? []) {
      const text = m.message?.text?.trim();
      const senderId = m.sender?.id;

      // Only real inbound text DMs: skip echoes (our own sends), empty/non-text
      // events (reactions, read receipts), and anything missing a sender or
      // from our own account (avoids replying to ourselves / loops).
      if (!text || m.message?.is_echo || !senderId) continue;
      if (senderId === m.recipient?.id) continue;

      try {
        const reply = await generateAreviasReply({ message: text });
        await sendInstagramMessage(senderId, reply, token);
      } catch (err) {
        console.error("[instagram] reply failed", err);
      }
    }
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
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[instagram] send failed", res.status, detail);
  }
}
