import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabaseBrowser } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let done = false;
    const go = (to: "/profile" | "/login") => {
      if (done) return;
      done = true;
      navigate({ to });
    };

    const sb = supabaseBrowser();
    // The browser client auto-detects the OAuth code in the URL and sets the
    // session; we just wait for it to land, then route on.
    sb.auth.getSession().then(({ data }) => {
      if (data.session) go("/profile");
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) go("/profile");
    });
    const timeout = setTimeout(() => go("/login"), 6000);

    return () => {
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
