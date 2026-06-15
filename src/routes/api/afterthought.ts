import { createFileRoute } from "@tanstack/react-router";
import type { AfterthoughtDecision, AfterthoughtRequest } from "@/lib/ai/types";

const QUIET: AfterthoughtDecision = {
  continueConversation: false,
  delay: 0,
  message: "",
};

export const Route = createFileRoute("/api/afterthought")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readBody(request);
        if (!body) return json(QUIET);

        try {
          // Bounded by the same daily cap: a user who's out of messages gets no
          // afterthoughts either, which also closes off direct abuse of this
          // endpoint. Peek (no increment) — afterthoughts don't spend the cap.
          const { identifyRequester, peekUsage, limitFor } = await import(
            "@/lib/rate-limit.server"
          );
          const who = await identifyRequester(request);
          if ((await peekUsage(who.id)) > limitFor(who.loggedIn)) return json(QUIET);

          const { decideAfterthought } = await import("@/lib/ai/gemini.server");
          const decision = await decideAfterthought(body);
          return json(decision ?? QUIET);
        } catch {
          // Best-effort feature — never surface an error to the chat.
          return json(QUIET);
        }
      },
    },
  },
});

async function readBody(request: Request): Promise<AfterthoughtRequest | null> {
  try {
    const body = (await request.json()) as Partial<AfterthoughtRequest>;
    const lastReply = typeof body.lastReply === "string" ? body.lastReply : "";
    if (!lastReply.trim()) return null;
    return {
      message: typeof body.message === "string" ? body.message : "",
      history: Array.isArray(body.history) ? body.history : [],
      replyTo: body.replyTo ?? null,
      personalization:
        body.personalization && typeof body.personalization === "object"
          ? body.personalization
          : null,
      lastReply,
      priorAfterthoughts:
        typeof body.priorAfterthoughts === "number" ? body.priorAfterthoughts : 0,
      timeContext: typeof body.timeContext === "string" ? body.timeContext : null,
    };
  } catch {
    return null;
  }
}

function json(body: AfterthoughtDecision): Response {
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
