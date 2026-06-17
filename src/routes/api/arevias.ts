import { createFileRoute } from "@tanstack/react-router";
import type { AiReplyRequest, AiReplyResponse, LimitReason } from "@/lib/ai/types";
import { AI_FALLBACK_GENERIC, AI_FALLBACK_RATE_LIMIT } from "@/lib/ai/types";

// Plain fallbacks if the in-character message can't be generated (or on repeat
// attempts after the cap, where regenerating would just waste quota).
const STATIC_LIMIT: Record<LimitReason, string> = {
  signup: "ok i actually need you to sign in if we're gonna keep talking",
  signoff: "alright i gotta run for now, talk later",
};

export const Route = createFileRoute("/api/arevias")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readRequestBody(request);

        // App-level rate limit: count this message against the caller's daily
        // cap (per signed-in user, or per hashed IP for anonymous).
        const { identifyRequester, countUsage, limitFor } = await import(
          "@/lib/rate-limit.server"
        );
        const who = await identifyRequester(request);
        const limit = limitFor(who.loggedIn);
        const count = await countUsage(who.id);
        const reason: LimitReason = who.loggedIn ? "signoff" : "signup";

        // Past the cap — the graceful sign-off already went out on the last
        // allowed message, so just soft-close without burning more quota.
        if (count > limit) {
          return json({ text: STATIC_LIMIT[reason], limited: true, reason });
        }

        try {
          const { generateAreviasReply } = await import(
            "@/lib/ai/gemini.server"
          );
          // On the LAST allowed message, fold an in-character sign-off into the
          // real reply (it answers them AND wraps up) instead of sending a
          // separate "you've hit your limit" notice afterward.
          const signingOff = count === limit;
          const text = await generateAreviasReply(
            body,
            signingOff ? { signOff: reason } : {},
          );

          return json(signingOff ? { text, limited: true, reason } : { text });
        } catch (error) {
          return json({
            text: isRateLimit(error)
              ? AI_FALLBACK_RATE_LIMIT
              : AI_FALLBACK_GENERIC,
          });
        }
      },
    },
  },
});

async function readRequestBody(request: Request): Promise<AiReplyRequest> {
  try {
    const body = (await request.json()) as Partial<AiReplyRequest>;
    return {
      message: typeof body.message === "string" ? body.message : "",
      history: Array.isArray(body.history) ? body.history : [],
      replyTo: body.replyTo ?? null,
      personalization:
        body.personalization && typeof body.personalization === "object"
          ? body.personalization
          : null,
      timeContext: typeof body.timeContext === "string" ? body.timeContext : null,
    };
  } catch {
    return { message: "", history: [], replyTo: null, personalization: null };
  }
}

function json(body: AiReplyResponse): Response {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isRateLimit(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "GeminiRateLimitError"
  );
}
