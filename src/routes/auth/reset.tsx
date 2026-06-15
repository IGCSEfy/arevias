import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AuthMessage } from "@/components/arevias/auth-message";
import { ButtonBusyLabel } from "@/components/arevias/button-busy-label";
import { PageTransition } from "@/components/arevias/page-transition";
import { supabaseBrowser } from "@/lib/supabase";

export const Route = createFileRoute("/auth/reset")({
  component: ResetPassword,
});

const inputCls =
  "w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm outline-none transition-all duration-300 ease-out placeholder:text-muted-foreground/50 hover:border-white/20 focus:border-white/30 focus:bg-white/[0.04] focus:shadow-[0_0_0_4px_rgba(255,255,255,0.03)]";

function ResetPassword() {
  const navigate = useNavigate();
  // The recovery link signs the user into a temporary session. We only show the
  // form once that session has landed; otherwise the link is missing/expired.
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecked(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setChecked(true);
      }
    });
    // Give the client a moment to detect the token in the URL before deciding
    // the link is invalid.
    const timeout = setTimeout(() => setChecked(true), 4000);
    return () => {
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/profile" }), 1400);
  };

  return (
    <PageTransition>
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-transparent px-4 text-foreground">
        <div aria-hidden className="pointer-events-none absolute inset-0 radial-glow" />
        <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card/40 p-8 backdrop-blur-sm">
          <h1 className="font-display text-2xl leading-tight">Set a new password</h1>

          {done ? (
            <p className="mt-3 text-sm text-emerald-400">
              Password updated. Redirecting you to your profile…
            </p>
          ) : !ready && checked ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                This reset link is invalid or has expired. Request a new one to continue.
              </p>
              <Button type="button" onClick={() => navigate({ to: "/login" })} className="mt-6 w-full rounded-2xl">
                Back to sign in
              </Button>
            </>
          ) : !ready ? (
            <p className="mt-3 text-sm text-muted-foreground">Verifying your reset link…</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">Choose a new password for your account.</p>
              <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="New password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputCls}
                />
                <div className="flex flex-col">
                  <AuthMessage error={error} />
                  <Button type="submit" disabled={busy} className="mt-1 rounded-2xl">
                    <ButtonBusyLabel busy={busy}>Update password</ButtonBusyLabel>
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
