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
        // INSTAGRAM_APP_SECRET may list MULTIPLE comma-separated candidate
        // secrets (each trimmed) — apps using "Instagram API with Instagram
        // Login" sign webhooks with the *Instagram* app secret, which differs
        // from the Meta App Secret (App Settings > Basic). Listing both lets
        // whichever Meta actually used match, so we don't have to guess.
        const secrets = (process.env.INSTAGRAM_APP_SECRET ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (secrets.length) {
          const signature = request.headers.get("x-hub-signature-256") ?? "";
          const check = await verifyMetaSignature(raw, signature, secrets);
          if (!check.valid) {
            // Diagnostic for the Vercel logs — only hash prefixes + lengths, never
            // the secret itself. If `received` matches one of `computed`, the body
            // is fine and it's a secret problem; if none ever match across known
            // secrets, suspect a body/proxy issue instead.
            console.warn("[instagram webhook] signature mismatch", {
              hasHeader: signature.startsWith("sha256="),
              bodyLength: raw.length,
              received: signature.slice("sha256=".length, "sha256=".length + 10),
              computed: check.computedPrefixes,
              secretLengths: secrets.map((s) => s.length),
            });
            return new Response("Invalid signature", { status: 403 });
          }
        }

        // Parse, then generate + send the reply before acking. Gemini (~2-5s)
        // + send (~1s) stays well under Meta's webhook timeout, and on
        // serverless we can't reliably do work after responding. Always 200 so
        // Meta doesn't retry (errors are logged inside the handler).
        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        try {
          const { handleInstagramEvent } = await import("@/lib/instagram.server");
          await handleInstagramEvent(payload);
        } catch (err) {
          console.error("[instagram webhook] handler error", err);
        }

        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});

/**
 * HMAC-SHA256 check of the raw body against Meta's X-Hub-Signature-256 header,
 * accepting a match against ANY of the candidate secrets (so the Instagram app
 * secret and the Meta app secret can both be listed and we needn't know which
 * one Meta used). Also returns each computed hash's prefix for diagnostics —
 * those are hashes, not the secrets, so they're safe to log.
 */
async function verifyMetaSignature(
  raw: string,
  header: string,
  secrets: string[],
): Promise<{ valid: boolean; computedPrefixes: string[] }> {
  const computedPrefixes: string[] = [];
  if (!header.startsWith("sha256=")) return { valid: false, computedPrefixes };

  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const provided = Buffer.from(header.slice("sha256=".length), "hex");

  let valid = false;
  for (const secret of secrets) {
    const expectedHex = createHmac("sha256", secret).update(raw).digest("hex");
    computedPrefixes.push(expectedHex.slice(0, 10));
    const expected = Buffer.from(expectedHex, "hex");
    if (expected.length === provided.length && timingSafeEqual(expected, provided)) {
      valid = true;
    }
  }
  return { valid, computedPrefixes };
}
