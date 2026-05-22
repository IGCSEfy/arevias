import { createFileRoute } from "@tanstack/react-router";
import type { AiReplyRequest, AiReplyResponse } from "@/lib/ai/types";
import { AI_FALLBACK_GENERIC, AI_FALLBACK_RATE_LIMIT } from "@/lib/ai/types";

export const Route = createFileRoute("/api/arevias")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readRequestBody(request);

        try {
          const { generateAreviasReply } = await import(
            "@/lib/ai/gemini.server"
          );
          const text = await generateAreviasReply(body);

          return json({ text });
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
    };
  } catch {
    return { message: "", history: [], replyTo: null };
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
