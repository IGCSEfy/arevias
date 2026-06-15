import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";

import { MotionButton } from "@/components/ui/motion-button";
import { AuthMessage } from "@/components/arevias/auth-message";
import { ButtonBusyLabel } from "@/components/arevias/button-busy-label";
import { PageTransition } from "@/components/arevias/page-transition";
import { supabaseBrowser, useSession } from "@/lib/supabase";

// Official multicolor Google "G" mark.
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Mode = "signin" | "signup" | "forgot";

const inputCls =
  "w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm outline-none transition-all duration-300 ease-out placeholder:text-muted-foreground/50 hover:border-white/20 focus:border-white/30 focus:bg-white/[0.04] focus:shadow-[0_0_0_4px_rgba(255,255,255,0.03)]";

const HEADING: Record<Mode, string> = {
  signin: "Welcome back",
  signup: "Create your account",
  forgot: "Reset your password",
};

const SUBTEXT: Record<Mode, string> = {
  signin: "Sign in to Arevias.",
  signup: "Join Arevias.",
  forgot: "Enter your email and we'll send you a reset link.",
};

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already authenticated → skip the login screen.
  useEffect(() => {
    if (!loading && session) navigate({ to: "/profile" });
  }, [loading, session, navigate]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const sb = supabaseBrowser();

    if (mode === "forgot") {
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      setBusy(false);
      if (error) setError(error.message);
      else setNotice("Check your email for a link to reset your password.");
      return;
    }

    const { error } =
      mode === "signin"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else navigate({ to: "/profile" });
  };

  const oauth = async (provider: "google") => {
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  };

  return (
    <PageTransition>
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-transparent px-4 text-foreground">
        <div aria-hidden className="pointer-events-none absolute inset-0 radial-glow" />
        <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card/40 p-8 backdrop-blur-sm">
        <h1 className="font-display text-2xl leading-tight">{HEADING[mode]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{SUBTEXT[mode]}</p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
          {mode !== "forgot" && (
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="Password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
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
          )}
          {mode === "signin" && (
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="mt-0.5 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Forgot password?
            </button>
          )}
          <div className="flex flex-col">
            <AuthMessage error={error} notice={notice} />
            <MotionButton type="submit" disabled={busy} className="mt-1">
              <ButtonBusyLabel busy={busy}>
                {mode === "signin" ? "Sign in" : mode === "signup" ? "Sign up" : "Send reset link"}
              </ButtonBusyLabel>
            </MotionButton>
          </div>
        </form>

        {mode !== "forgot" && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or{" "}
              <span className="h-px flex-1 bg-border" />
            </div>

            <MotionButton
              type="button"
              onClick={() => oauth("google")}
              icon={<GoogleIcon className="size-5" />}
            >
              Continue with Google
            </MotionButton>
          </>
        )}

        <button
          type="button"
          onClick={() =>
            switchMode(mode === "forgot" ? "signin" : mode === "signin" ? "signup" : "signin")
          }
          className="mt-6 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "forgot"
            ? "Back to sign in"
            : mode === "signin"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
        </button>

        {mode !== "forgot" && (
          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground/70">
            By continuing you agree to our{" "}
            <Link to="/terms" className="text-foreground/70 transition-colors hover:text-foreground">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-foreground/70 transition-colors hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        )}
        </div>
      </div>
    </PageTransition>
  );
}
