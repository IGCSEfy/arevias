import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/delete-account")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = import.meta.env.VITE_SUPABASE_URL;
        // Server-only secret — read at runtime, never inlined into the client bundle.
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          return Response.json(
            {
              error:
                "Account deletion isn't configured yet (missing SUPABASE_SERVICE_ROLE_KEY).",
            },
            { status: 501 },
          );
        }

        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7)
          : "";
        if (!token) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { createClient } = await import("@supabase/supabase-js");
        const admin = createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // Verify the caller's token, then delete that user (cascades to profiles).
        const { data, error } = await admin.auth.getUser(token);
        if (error || !data.user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
        if (deleteError) {
          return Response.json({ error: deleteError.message }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
