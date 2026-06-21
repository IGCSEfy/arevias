import { createFileRoute } from "@tanstack/react-router";

/**
 * Instagram Messaging webhook (Phase 1).
 *
 *  GET  — Meta's subscription verification handshake. Meta calls this once with
 *         ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=... and expects
 *         the challenge echoed back verbatim when the token matches.
 *  POST — incoming events (DMs etc.). For now we verify the payload signature
 *         and acknowledge quickly; routing + the AI reply land in a later phase.
 *
 * Env:
 *  INSTAGRAM_VERIFY_TOKEN — shared secret you also paste into Meta's webhook
 *                           "Verify token" field. Required for the handshake.
 *  INSTAGRAM_APP_SECRET   — the Instagram app secret, used to verify that POST
 *                           payloads genuinely came from Meta (X-Hub-Signature-256).
 */
export const Route = createFileRoute("/api/instagram/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const mode = params.get("hub.mode");
        const token = params.get("hub.verify_token");
        const challenge = params.get("hub.challenge");

        const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN;

        if (
          mode === "subscribe" &&
          verifyToken &&
          token === verifyToken &&
          challenge
        ) {
          return new Response(challenge, {
            status: 200,
            headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
          });
        }

        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const raw = await request.text();

        // Confirm the event really came from Meta before trusting it.
        const appSecret = process.env.INSTAGRAM_APP_SECRET;
        if (appSecret) {
          const signature = request.headers.get("x-hub-signature-256") ?? "";
          const valid = await verifyMetaSignature(raw, signature, appSecret);
          if (!valid) {
            return new Response("Invalid signature", { status: 403 });
          }
        }

        // Phase 1: acknowledge fast (Meta retries if it doesn't get a prompt
        // 200). Message routing + the in-voice AI reply come in a later phase.
        try {
          const payload = JSON.parse(raw);
          console.log("[instagram webhook]", JSON.stringify(payload));
        } catch {
          /* ignore non-JSON pings */
        }

        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});

/** HMAC-SHA256 check of the raw body against Meta's X-Hub-Signature-256 header. */
async function verifyMetaSignature(
  raw: string,
  header: string,
  secret: string,
): Promise<boolean> {
  if (!header.startsWith("sha256=")) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const provided = header.slice("sha256=".length);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
