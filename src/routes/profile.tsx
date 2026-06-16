import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type ComponentType,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import {
  Accessibility,
  Activity,
  Blocks,
  Brain,
  Briefcase,
  Calendar,
  ChevronRight,
  Code2,
  Download,
  Eye,
  Globe,
  GraduationCap,
  History,
  LayoutDashboard,
  Link2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MailCheck,
  MessageSquare,
  Monitor,
  NotebookPen,
  Pencil,
  PenLine,
  Settings2,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Wand2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SaveButton } from "@/components/arevias/save-button";
import { PageTransition } from "@/components/arevias/page-transition";
import { broadcastAvatarChange } from "@/components/arevias/TopNav";
import nanorisLogo from "@/assets/nanoris-logo.png";
import {
  Button,
  Card,
  Chip,
  ComingSoon,
  CopyField,
  Detail,
  Field,
  Hairline,
  PageHeader,
  PreviewTile,
  Segmented,
  StatusDot,
  Tabs,
  Textarea,
  TextInput,
  useEdgeFade,
} from "@/components/arevias/ui-kit";
import { PremiumToggle } from "@/components/ui/bouncy-toggle";
import { supabaseBrowser, useSession, type Profile } from "@/lib/supabase";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

type SaveStatus = "idle" | "saving";
type Prefs = {
  aboutYou: string;
  responseGuidance: string;
  responseStyle: string;
  responseLength: string;
  creativity: string;
  personalities: string[];
  emoji: string;
  slang: string;
  messageStyle: string;
  punctuation: string;
  occupation: string;
  goals: string;
  interests: string;
  communication: string;
  contextEnabled: boolean;
  reduceMotion: boolean;
  notifySecurity: boolean;
  notifyTips: boolean;
  isPublic: boolean;
};

const DEFAULT_PREFS: Prefs = {
  aboutYou: "",
  responseGuidance: "",
  responseStyle: "balanced",
  responseLength: "balanced",
  creativity: "balanced",
  personalities: [],
  emoji: "mirror",
  slang: "mirror",
  messageStyle: "mirror",
  punctuation: "mirror",
  occupation: "",
  goals: "",
  interests: "",
  communication: "",
  contextEnabled: true,
  reduceMotion: false,
  notifySecurity: true,
  notifyTips: false,
  isPublic: false,
};

const SECTIONS: {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  desc: string;
  tabs: { id: string; label: string }[];
}[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    desc: "Your account, your workspace, and everything connected to it.",
    tabs: [
      { id: "dashboard", label: "Dashboard" },
      { id: "profile", label: "Profile" },
      { id: "workspace", label: "Workspace" },
      { id: "connectors", label: "Integrations" },
    ],
  },
  {
    id: "personalization",
    label: "Personalization",
    icon: Sparkles,
    desc: "Teach Arevias how to think, write, and remember you.",
    tabs: [
      { id: "ai", label: "AI Preferences" },
      { id: "instructions", label: "Custom Instructions" },
      { id: "context", label: "Context" },
      { id: "memory", label: "Memory" },
      { id: "personas", label: "Personas" },
    ],
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    desc: "Sign-in methods, sessions, and what you keep private.",
    tabs: [
      { id: "account", label: "Account" },
      { id: "providers", label: "Providers" },
      { id: "sessions", label: "Sessions" },
      { id: "privacy", label: "Privacy" },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    icon: Activity,
    desc: "A clean log of everything that happened on your account.",
    tabs: [
      { id: "timeline", label: "Timeline" },
      { id: "changes", label: "Changes" },
      { id: "logins", label: "Logins" },
      { id: "events", label: "Events" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings2,
    desc: "The knobs that don't fit anywhere else.",
    tabs: [
      { id: "general", label: "General" },
      { id: "appearance", label: "Appearance" },
      { id: "notifications", label: "Notifications" },
      { id: "accessibility", label: "Accessibility" },
    ],
  },
];

const PROVIDERS = [
  { id: "email", label: "Email", Icon: Mail },
  { id: "google", label: "Google", Icon: Globe },
];

const PERSONALITY_OPTIONS = [
  { value: "chill", label: "Chill" },
  { value: "friendly", label: "Friendly" },
  { value: "blunt", label: "Blunt" },
  { value: "playful", label: "Playful" },
  { value: "sarcastic", label: "Sarcastic" },
  { value: "flirty", label: "Flirty" },
  { value: "aggressive", label: "Aggressive" },
];
const PERSONALITY_CONFLICTS: Record<string, string[]> = {
  aggressive: ["chill", "friendly"],
  chill: ["aggressive"],
  friendly: ["aggressive"],
};

function applyReduceMotion(v: boolean) {
  document.documentElement.dataset.reduceMotion = String(v);
  try {
    localStorage.setItem("arevias:reduce-motion", String(v));
  } catch {
    /* ignore */
  }
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const fmtDateTime = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function ProfilePage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [section, setSection] = useState("overview");
  const [tab, setTab] = useState("dashboard");
  const navFade = useEdgeFade<HTMLDivElement>();

  // Profile columns
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  // Preferences (JSONB)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  // UI
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [accountMsg, setAccountMsg] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!session) return;
    void supabaseBrowser()
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        const p = data as Profile | null;
        if (p) {
          setDisplayName(p.display_name ?? "");
          setHandle(p.handle ?? "");
          setBio(p.bio ?? "");
          setAvatarUrl(p.avatar_url);
          setUpdatedAt(p.updated_at ?? null);
          const next = { ...DEFAULT_PREFS, ...((p.preferences ?? {}) as Partial<Prefs>) };
          setPrefs(next);
          applyReduceMotion(next.reduceMotion);
        }
        setProfileLoading(false);
      });
  }, [session]);

  if (loading || !session || profileLoading) {
    // Render a full-viewport surface (not null) while auth/profile data loads.
    // An empty page made iOS Safari briefly paint at the wrong scale, which
    // visually ballooned the fixed top-nav dock to mid-screen for a frame
    // (the DOM was always correct — it was a paint-scale artifact). Filling
    // the viewport gives iOS stable content to scale against, no flash.
    return <div className="fixed inset-0 bg-background" aria-hidden />;
  }

  const user = session.user;
  const saving = status === "saving";
  const setPref = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v }) as Prefs);

  const persist = async (patch: Record<string, unknown>) => {
    setStatus("saving");
    setError(null);
    const { error: e } = await supabaseBrowser().from("profiles").update(patch).eq("id", user.id);
    setStatus("idle");
    if (e) {
      setError((e as { code?: string }).code === "23505" ? "That handle is already taken." : e.message);
    } else {
      setUpdatedAt(new Date().toISOString());
    }
  };

  const savePrefs = async (partial: Partial<Prefs>) => {
    const next = { ...prefs, ...partial };
    setPrefs(next);
    await persist({ preferences: next });
  };

  const onAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    const sb = supabaseBrowser();
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploadError(upErr.message);
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = sb.storage.from("avatars").getPublicUrl(path);
    const { error: dbErr } = await sb
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);
    if (dbErr) {
      setUploadError(dbErr.message);
    } else {
      // Preload the new image before swapping so the initials fallback never
      // flashes in the gap while it downloads. Resolve either way so a failed
      // load doesn't leave the spinner stuck.
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = publicUrl;
      });
      setAvatarUrl(publicUrl);
      broadcastAvatarChange(publicUrl);
    }
    setUploading(false);
  };

  const changeEmail = async () => {
    setAccountMsg(null);
    setError(null);
    if (!newEmail) return;
    const { error: e } = await supabaseBrowser().auth.updateUser({ email: newEmail });
    if (e) setError(e.message);
    else {
      setAccountMsg("Check your new email to confirm the change.");
      setNewEmail("");
    }
  };

  const changePassword = async () => {
    setAccountMsg(null);
    setError(null);
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    const { error: e } = await supabaseBrowser().auth.updateUser({ password: newPassword });
    if (e) setError(e.message);
    else {
      setAccountMsg("Password updated.");
      setNewPassword("");
    }
  };

  const oauth = async (provider: "google") => {
    setError(null);
    const { error: e } = await supabaseBrowser().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (e) setError(e.message);
  };

  const exportData = () => {
    const payload = { id: user.id, email: user.email, created_at: user.created_at, profile: { displayName, handle, bio, avatarUrl }, preferences: prefs };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "arevias-profile.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const deleteAccount = async () => {
    setError(null);
    setDeleting(true);
    const sb = supabaseBrowser();
    const {
      data: { session: current },
    } = await sb.auth.getSession();
    const res = await fetch("/api/delete-account", { method: "POST", headers: { Authorization: `Bearer ${current?.access_token ?? ""}` } });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error || "Couldn't delete account.");
      setDeleting(false);
      return;
    }
    await sb.auth.signOut();
    navigate({ to: "/login" });
  };

  const signOut = async (scope?: "global") => {
    await supabaseBrowser().auth.signOut(scope ? { scope } : undefined);
    navigate({ to: "/login" });
  };

  const go = (s: string, t: string) => {
    setSection(s);
    setTab(t);
    setError(null);
    setAccountMsg(null);
  };

  // ── Derived (all real) ──
  const initial = (displayName || user.email || "?").charAt(0).toUpperCase();
  const provider = user.app_metadata?.provider ?? "email";
  const providers = (user.identities ?? []).map((i) => i.provider);
  const isLinked = (id: string) => id === "email" || providers.includes(id);
  const linkedCount = PROVIDERS.filter((p) => isLinked(p.id)).length;
  const emailVerified = Boolean(user.email_confirmed_at);

  const filled = (s: string | undefined) => Boolean(s && s.trim());
  const instructionsSet = [prefs.aboutYou, prefs.responseGuidance].filter(filled).length;
  const contextSet = [prefs.occupation, prefs.goals, prefs.interests, prefs.communication].filter(filled).length;

  const personalityLabel = prefs.personalities.length ? prefs.personalities.map(cap).join(" + ") : "Adaptive";

  const togglePersonality = (v: string) => {
    if (prefs.personalities.includes(v)) {
      setPref("personalities", prefs.personalities.filter((x) => x !== v));
      return;
    }
    const banned = PERSONALITY_CONFLICTS[v] ?? [];
    setPref("personalities", [...prefs.personalities.filter((x) => !banned.includes(x)), v]);
  };

  // ── Activity events (real) ──
  type Evt = { cat: string; icon: ComponentType<{ className?: string }>; label: string; ts?: string | null };
  const events: Evt[] = [
    { cat: "system", icon: UserPlus, label: "Account created", ts: user.created_at },
    ...(user.email_confirmed_at ? [{ cat: "system", icon: MailCheck, label: "Email verified", ts: user.email_confirmed_at }] : []),
    ...((user.identities ?? []).flatMap((idn) => {
      const out: Evt[] = [];
      if (idn.created_at) out.push({ cat: "system", icon: Link2, label: `${cap(idn.provider)} connected`, ts: idn.created_at });
      if (idn.last_sign_in_at) out.push({ cat: "login", icon: LogIn, label: `Signed in with ${cap(idn.provider)}`, ts: idn.last_sign_in_at });
      return out;
    })),
    ...(user.last_sign_in_at ? [{ cat: "login", icon: LogIn, label: "Most recent sign-in", ts: user.last_sign_in_at }] : []),
    ...(updatedAt ? [{ cat: "change", icon: Pencil, label: "Profile updated", ts: updatedAt }] : []),
  ];
  const sortedEvents = events.filter((e) => e.ts).sort((a, b) => new Date(b.ts!).getTime() - new Date(a.ts!).getTime());

  // Flat list feed (changes / logins / events)
  const feed = (cats: string[]) => {
    const items = sortedEvents.filter((e) => cats.includes(e.cat));
    if (!items.length) return <p className="py-10 text-center text-sm text-muted-foreground">No events recorded yet.</p>;
    return (
      <ul className="divide-y divide-border">
        {items.map((e, i) => {
          const Icon = e.icon;
          return (
            <li key={i} className="flex items-center gap-3 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-soft">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{e.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(e.ts)}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  // Vertical timeline (timeline / events)
  const timeline = (cats: string[]) => {
    const items = sortedEvents.filter((e) => cats.includes(e.cat));
    if (!items.length) return <p className="py-10 text-center text-sm text-muted-foreground">No events recorded yet.</p>;
    return (
      <ol className="relative">
        <div className="absolute bottom-1 left-[11px] top-1 w-px bg-border" />
        {items.map((e, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="relative pb-5 pl-8 last:pb-0"
          >
            <span className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full bg-ink ring-4 ring-surface" />
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">{e.label}</div>
              <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(e.ts)}</span>
            </div>
          </motion.li>
        ))}
      </ol>
    );
  };

  const current = SECTIONS.find((s) => s.id === section)!;
  const saveBar = (onSave: () => void): ReactNode => (
    <div className="flex items-center justify-end gap-3 pt-1">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <SaveButton saving={saving} onClick={onSave}>
        Save changes
      </SaveButton>
    </div>
  );

  const aiSnapshot = {
    personalities: prefs.personalities,
    responseStyle: prefs.responseStyle,
    responseLength: prefs.responseLength,
    creativity: prefs.creativity,
    emoji: prefs.emoji,
    slang: prefs.slang,
    messageStyle: prefs.messageStyle,
    punctuation: prefs.punctuation,
  };

  return (
    <PageTransition dark={false} fast>
    <div className="arevias-profile fixed inset-0 z-40 w-full overflow-hidden bg-background text-foreground antialiased">
      {/* Floating dark sidebar (desktop) */}
      <aside className="z-30 hidden flex-col rounded-3xl bg-sidebar p-4 text-sidebar-foreground shadow-ink lg:fixed lg:inset-y-3 lg:left-3 lg:flex lg:w-60">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="h-9 w-9 overflow-hidden rounded-xl bg-black">
            <img src={nanorisLogo} alt="Nanoris" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-sidebar-accent-foreground">Nanoris</span>
            <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">Console</span>
          </div>
        </div>

        <nav className="mt-6 flex flex-col gap-1">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => go(s.id, s.tabs[0].id)}
                className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
              >
                {active && (
                  <motion.div
                    layoutId="profile-side-pill"
                    className="absolute inset-0 rounded-xl bg-sidebar-accent"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <Icon
                  className={cn(
                    "relative h-4 w-4",
                    active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/70",
                  )}
                />
                <span
                  className={cn(
                    "relative",
                    active ? "font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground/80",
                  )}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="my-3 h-px bg-sidebar-border" />
          <div className="flex items-center gap-3 px-1">
            <Avatar className="h-8 w-8">
              {avatarUrl && <AvatarImage src={avatarUrl} />}
              <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-accent-foreground">{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-sidebar-accent-foreground">{displayName || "Your name"}</p>
              <p className="truncate text-[11px] text-sidebar-foreground/60">Free plan</p>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              title="Sign out"
              className="rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Scroll area */}
      <main className="h-full overflow-y-scroll overflow-x-hidden [scrollbar-gutter:stable] lg:pl-[16.5rem]">
        {/* Mobile section nav — scrolls with the page, inset rounded bar.
            mt clears the fixed top dock (~80px) with breathing room below it. */}
        <nav className="mt-28 px-3 sm:px-4 lg:hidden">
          <div
            ref={navFade.ref}
            onScroll={navFade.onScroll}
            style={navFade.style}
            className="flex items-center gap-1 overflow-x-auto rounded-full border border-border bg-soft p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {SECTIONS.map((s) => {
              const active = section === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => go(s.id, s.tabs[0].id)}
                  className={cn(
                    "whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                    active ? "bg-ink text-ink-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="mx-auto max-w-[1100px] px-3 pb-16 pt-10 sm:px-4 sm:pt-12 lg:px-10 lg:pb-20 lg:pt-28">
          <PageHeader title={current.label} subtitle={current.desc} />
          <Tabs tabs={current.tabs} value={tab} onChange={setTab} />

            {/* Keyed on section/tab: switching unmounts the old content
                instantly (no lingering ghost of the previous cards) and the
                new content animates in. No AnimatePresence/exit — the
                wait-for-exit caused the old cards to hang visible mid-switch. */}
            <motion.div
              key={`${section}/${tab}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* ─────────────── OVERVIEW ─────────────── */}
              {section === "overview" && tab === "dashboard" && (
                <div className="grid grid-cols-1 gap-5">
                  {/* Hero ink card */}
                  <Card ink className="!p-5 sm:!p-7">
                    <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                        <label className="group relative block shrink-0 cursor-pointer" title="Change avatar">
                          <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} disabled={uploading} />
                          <Avatar className="h-16 w-16 rounded-2xl sm:h-20 sm:w-20">
                            {avatarUrl && <AvatarImage src={avatarUrl} className="rounded-2xl" />}
                            <AvatarFallback className="rounded-2xl bg-ink-foreground/10 font-display text-2xl text-ink-foreground sm:text-3xl">
                              {initial}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={cn(
                              "absolute inset-0 grid place-items-center rounded-2xl bg-black/60 text-[10px] font-medium text-white transition-opacity",
                              uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                            )}
                          >
                            {uploading ? "Uploading…" : "Change"}
                          </div>
                        </label>
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <h2 className="min-w-0 truncate font-display text-2xl text-ink-foreground sm:text-3xl">{displayName || "Your profile"}</h2>
                            {handle && <span className="max-w-full truncate text-sm text-ink-foreground/60">@{handle}</span>}
                          </div>
                          <p className="mt-0.5 truncate text-sm text-ink-foreground/70">{user.email}</p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <span className="rounded-full border border-ink-foreground/10 bg-ink-foreground/10 px-2.5 py-1 text-[11px] text-ink-foreground/90">Free</span>
                            <span className="rounded-full border border-ink-foreground/10 bg-ink-foreground/10 px-2.5 py-1 text-[11px] capitalize text-ink-foreground/90">{provider}</span>
                            <span className="rounded-full border border-ink-foreground/10 bg-ink-foreground/10 px-2.5 py-1 text-[11px] text-ink-foreground/90">Joined {fmtDate(user.created_at)}</span>
                          </div>
                          {uploadError && <p className="mt-2 text-[11px] text-red-300">{uploadError}</p>}
                        </div>
                      </div>
                      <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">
                        <button
                          onClick={() => go("overview", "profile")}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink-foreground/15 px-3.5 py-2 text-sm text-ink-foreground transition-colors hover:bg-ink-foreground/10 sm:flex-none"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit profile
                        </button>
                        <button
                          onClick={() => go("personalization", "ai")}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink-foreground px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink-foreground/90 sm:flex-none"
                        >
                          <Wand2 className="h-3.5 w-3.5" /> Customize AI
                        </button>
                      </div>
                    </div>
                  </Card>

                  {/* Stat row */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
                    <Card ink className="col-span-2 min-w-0 !p-5 sm:col-span-1">
                      <div className="flex items-start justify-between">
                        <span className="text-xs uppercase tracking-wider text-ink-foreground/60">AI personality</span>
                        <Sparkles className="h-4 w-4 text-ink-foreground/70" />
                      </div>
                      <div className="mt-4 break-words font-display text-2xl leading-tight text-ink-foreground sm:text-3xl">{personalityLabel}</div>
                      <div className="mt-1 text-xs text-ink-foreground/60">
                        {cap(prefs.responseStyle)} · {cap(prefs.responseLength)}
                      </div>
                    </Card>

                    <Card className="min-w-0 !p-5">
                      <div className="flex items-start justify-between">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Security</span>
                        <Shield className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="mt-4 font-display text-3xl text-foreground">{emailVerified ? "Strong" : "Review"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {emailVerified ? "Email verified" : "Verify email"} · {linkedCount} method{linkedCount === 1 ? "" : "s"}
                      </div>
                    </Card>

                    <Card className="min-w-0 !p-5">
                      <div className="flex items-start justify-between">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Providers</span>
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="mt-4 font-display text-3xl text-foreground">{linkedCount} / {PROVIDERS.length}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {PROVIDERS.filter((p) => isLinked(p.id)).map((p) => p.label).join(", ") || "None"} linked
                      </div>
                    </Card>

                    <Card className="col-span-2 min-w-0 !p-5 sm:col-span-1">
                      <div className="flex items-start justify-between">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">User ID</span>
                      </div>
                      <div className="mt-4">
                        <CopyField value={user.id} className="max-w-full" />
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">Plan: Free</div>
                    </Card>
                  </div>

                  {/* Detail cards */}
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    <Card className="min-w-0">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-medium">Connected providers</h3>
                        <button onClick={() => go("security", "providers")} className="text-xs text-muted-foreground hover:text-foreground">
                          Manage
                        </button>
                      </div>
                      <div className="space-y-3">
                        {PROVIDERS.map(({ id, label, Icon }) => (
                          <div key={id} className="flex min-w-0 items-center justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-2.5 text-sm">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              {label}
                            </span>
                            <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                              <StatusDot on={isLinked(id)} />
                              {isLinked(id) ? "Connected" : "Not linked"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card className="min-w-0">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-medium">Personalization</h3>
                        <button onClick={() => go("personalization", "ai")} className="text-xs text-muted-foreground hover:text-foreground">
                          Tune
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2"><StatusDot on={instructionsSet > 0} /> Custom instructions</span>
                          <span className="text-xs text-muted-foreground">{instructionsSet}/2 set</span>
                        </div>
                        <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2"><StatusDot on={contextSet > 0} /> Context</span>
                          <span className="text-xs text-muted-foreground">{contextSet}/4 set</span>
                        </div>
                      </div>
                    </Card>

                    <Card className="min-w-0">
                      <h3 className="mb-4 font-medium">Account details</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3 text-sm"><span className="shrink-0 text-muted-foreground">Email</span><span className="min-w-0 truncate pl-3">{user.email}</span></div>
                        <div className="flex items-center justify-between gap-3 text-sm"><span className="shrink-0 text-muted-foreground">Provider</span><span className="min-w-0 truncate capitalize">{provider}</span></div>
                        <div className="flex items-center justify-between gap-3 text-sm"><span className="shrink-0 text-muted-foreground">Joined</span><span className="min-w-0 truncate">{fmtDate(user.created_at)}</span></div>
                        <div className="flex items-center justify-between gap-3 text-sm"><span className="shrink-0 text-muted-foreground">Last active</span><span className="min-w-0 truncate">{fmtDate(user.last_sign_in_at)}</span></div>
                      </div>
                    </Card>
                  </div>

                  {/* Recent activity + Pro upsell */}
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
                    <Card className="min-w-0">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-medium">Recent activity</h3>
                        <button onClick={() => go("activity", "timeline")} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          View all <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                      <ul className="divide-y divide-border">
                        {sortedEvents.slice(0, 5).map((e, i) => (
                          <li key={i} className="flex items-center gap-3 py-3">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-ink" />
                            <span className="min-w-0 flex-1 truncate text-sm">{e.label}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(e.ts)}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                    <Card ink className="flex h-full min-w-0 flex-col">
                      <h3 className="font-medium text-ink-foreground">Free plan</h3>
                      <p className="mt-2 text-sm text-ink-foreground/70">You're on the Free plan. Paid plans with unlimited personas, long-term memory, and priority models are coming soon.</p>
                      <div className="mb-6 mt-5 flex items-end gap-1">
                        <span className="font-display text-4xl text-ink-foreground">$0</span>
                        <span className="mb-1 text-sm text-ink-foreground/60">/ mo</span>
                      </div>
                      <button className="mt-auto w-full rounded-xl bg-ink-foreground px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-ink-foreground/90">
                        Upgrade plan
                      </button>
                    </Card>
                  </div>
                </div>
              )}

              {section === "overview" && tab === "profile" && (
                <Card className="max-w-2xl">
                  <h3 className="mb-1 font-medium">Profile</h3>
                  <p className="mb-6 text-sm text-muted-foreground">How you appear inside Arevias. Email is managed under Security.</p>
                  <div className="grid grid-cols-1 gap-5">
                    <Field label="Display name">
                      <TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
                    </Field>
                    <Field label="Handle" hint="Used for your public profile URL.">
                      <TextInput value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="username" />
                    </Field>
                    <Field label="Email">
                      <TextInput value={user.email ?? ""} readOnly className="cursor-not-allowed opacity-70" />
                    </Field>
                    <Field label="Bio" hint={`${bio.length} / 240`}>
                      <Textarea rows={4} maxLength={240} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short bio…" />
                    </Field>
                    {saveBar(() => persist({ display_name: displayName, handle: handle || null, bio }))}
                  </div>
                </Card>
              )}

              {section === "overview" && tab === "workspace" && (
                <div className="grid grid-cols-1 gap-5">
                  <Card className="max-w-2xl">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl bg-ink font-display text-lg text-ink-foreground">{initial}</div>
                      <div className="min-w-0">
                        <div className="font-medium">Personal</div>
                        <div className="text-xs text-muted-foreground">Your private space</div>
                      </div>
                      <Chip className="ml-auto">Current</Chip>
                    </div>
                    <Hairline className="my-5" />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <Detail label="Role" value="Owner" />
                      <Detail label="Members" value="Just you" />
                      <Detail label="Plan" value="Free" />
                    </div>
                  </Card>
                  <ComingSoon
                    title="Team workspaces"
                    description="Invite collaborators, share personas, and split usage across projects. Rolling out to Pro accounts next."
                  >
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <PreviewTile icon={Brain} title="Team memory" description="Arevias learns your projects and who does what." />
                      <PreviewTile icon={MessageSquare} title="Arevias in Slack" description="@mention it in a channel like a teammate." />
                      <PreviewTile icon={Shield} title="Brand voice guardrails" description="Lock tone on-brand per workspace." />
                      <PreviewTile icon={Activity} title="Usage insights" description="See how your team uses Arevias." />
                      <PreviewTile icon={UserPlus} title="Guest access" description="Scoped, temporary access for clients." />
                      <PreviewTile icon={Lock} title="SSO & provisioning" description="SAML sign-on and seat provisioning." />
                    </div>
                  </ComingSoon>
                </div>
              )}

              {section === "overview" && tab === "connectors" && (
                <ComingSoon
                  title="Integrations"
                  description="Connect Arevias to the tools you already use — pull in context and let it work where you are."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <PreviewTile icon={NotebookPen} title="Notion" description="Bring your notes and docs in as context." />
                    <PreviewTile icon={MessageSquare} title="Slack" description="Talk to Arevias right inside your workspace." />
                    <PreviewTile icon={Calendar} title="Google Calendar" description="Schedule-aware replies and reminders." />
                    <PreviewTile icon={Mail} title="Gmail" description="Draft and triage email in your voice." />
                  </div>
                </ComingSoon>
              )}

              {/* ─────────────── PERSONALIZATION ─────────────── */}
              {section === "personalization" && tab === "ai" && (
                <div className="grid grid-cols-1 gap-5">
                  <Card>
                    <h3 className="font-medium">Personality</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pick any traits to blend in. Leave all off and Arevias just adapts to your vibe.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {PERSONALITY_OPTIONS.map((o) => {
                        const active = prefs.personalities.includes(o.value);
                        return (
                          <button
                            key={o.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => togglePersonality(o.value)}
                            className={cn(
                              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                              active
                                ? "border-ink bg-ink text-ink-foreground"
                                : "border-border bg-surface text-foreground hover:border-foreground/30",
                            )}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </Card>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Card className="!p-5">
                      <Field label="Response style">
                        <Segmented
                          value={prefs.responseStyle}
                          onChange={(v) => setPref("responseStyle", v)}
                          options={[
                            { value: "concise", label: "Concise" },
                            { value: "balanced", label: "Balanced" },
                            { value: "detailed", label: "Detailed" },
                          ]}
                        />
                      </Field>
                    </Card>
                    <Card className="!p-5">
                      <Field label="Length">
                        <Segmented
                          value={prefs.responseLength}
                          onChange={(v) => setPref("responseLength", v)}
                          options={[
                            { value: "short", label: "Short" },
                            { value: "balanced", label: "Balanced" },
                            { value: "long", label: "Long" },
                          ]}
                        />
                      </Field>
                    </Card>
                    <Card className="!p-5">
                      <Field label="Creativity">
                        <Segmented
                          value={prefs.creativity}
                          onChange={(v) => setPref("creativity", v)}
                          options={[
                            { value: "precise", label: "Precise" },
                            { value: "balanced", label: "Balanced" },
                            { value: "creative", label: "Creative" },
                          ]}
                        />
                      </Field>
                    </Card>
                  </div>

                  <Card>
                    <h3 className="font-medium">Texting style</h3>
                    <div className="mt-4 grid gap-5 md:grid-cols-2">
                      <Field label="Emoji">
                        <Segmented
                          value={prefs.emoji}
                          onChange={(v) => setPref("emoji", v)}
                          options={[
                            { value: "never", label: "Never" },
                            { value: "mirror", label: "Mirror me" },
                            { value: "freely", label: "Freely" },
                          ]}
                        />
                      </Field>
                      <Field label="Slang & abbreviations">
                        <Segmented
                          value={prefs.slang}
                          onChange={(v) => setPref("slang", v)}
                          options={[
                            { value: "never", label: "Never" },
                            { value: "mirror", label: "Mirror me" },
                            { value: "freely", label: "Freely" },
                          ]}
                        />
                      </Field>
                      <Field label="Message style">
                        <Segmented
                          value={prefs.messageStyle}
                          onChange={(v) => setPref("messageStyle", v)}
                          options={[
                            { value: "single", label: "One message" },
                            { value: "mirror", label: "Mirror me" },
                            { value: "bursts", label: "Short bursts" },
                          ]}
                        />
                      </Field>
                      <Field label="Punctuation & casing">
                        <Segmented
                          value={prefs.punctuation}
                          onChange={(v) => setPref("punctuation", v)}
                          options={[
                            { value: "never", label: "Never" },
                            { value: "mirror", label: "Mirror me" },
                            { value: "clean", label: "Always clean" },
                          ]}
                        />
                      </Field>
                    </div>
                  </Card>

                  {saveBar(() => persist({ preferences: prefs }))}
                </div>
              )}

              {section === "personalization" && tab === "instructions" && (
                <div className="grid grid-cols-1 gap-5">
                  <Card>
                    <Field label="What should Arevias know about you?" hint={`${prefs.aboutYou.length}/1500`}>
                      <Textarea
                        rows={6}
                        maxLength={1500}
                        value={prefs.aboutYou}
                        onChange={(e) => setPref("aboutYou", e.target.value)}
                        placeholder="e.g. I'm a product designer who prefers concise, example-driven answers."
                      />
                    </Field>
                  </Card>
                  <Card>
                    <Field label="How should Arevias respond?" hint={`${prefs.responseGuidance.length}/1500`}>
                      <Textarea
                        rows={6}
                        maxLength={1500}
                        value={prefs.responseGuidance}
                        onChange={(e) => setPref("responseGuidance", e.target.value)}
                        placeholder="e.g. Be direct, skip the preamble, and challenge my assumptions."
                      />
                    </Field>
                  </Card>
                  {saveBar(() => persist({ preferences: prefs }))}
                </div>
              )}

              {section === "personalization" && tab === "context" && (
                <div className="grid grid-cols-1 gap-5">
                  <Card>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-medium">Use context in chats</h3>
                        <p className="mt-1 text-sm text-muted-foreground">When on, Arevias quietly references the fields below to tailor responses.</p>
                      </div>
                      <PremiumToggle checked={prefs.contextEnabled} onChange={(v) => setPref("contextEnabled", v)} />
                    </div>
                  </Card>
                  <Card>
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field label="Occupation">
                        <TextInput value={prefs.occupation} onChange={(e) => setPref("occupation", e.target.value)} placeholder="e.g. Software engineer" />
                      </Field>
                      <Field label="Interests">
                        <TextInput value={prefs.interests} onChange={(e) => setPref("interests", e.target.value)} placeholder="e.g. Design systems, running" />
                      </Field>
                      <Field label="Goals">
                        <Textarea rows={3} value={prefs.goals} onChange={(e) => setPref("goals", e.target.value)} placeholder="e.g. Ship faster and write clearer docs." />
                      </Field>
                      <Field label="Communication preferences">
                        <Textarea rows={3} value={prefs.communication} onChange={(e) => setPref("communication", e.target.value)} placeholder="e.g. No fluff, use analogies, explain trade-offs." />
                      </Field>
                    </div>
                  </Card>
                  {saveBar(() => persist({ preferences: prefs }))}
                </div>
              )}

              {section === "personalization" && tab === "memory" && (
                <ComingSoon
                  title="Memory"
                  description="Long-term memory that recalls facts across chats — your projects, preferences, and the details you share."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <PreviewTile icon={Brain} title="Remembered facts" description="A living list of what Arevias knows about you." />
                    <PreviewTile icon={Lock} title="Memory controls" description="Granular toggles for categories of memory." />
                  </div>
                </ComingSoon>
              )}

              {section === "personalization" && tab === "personas" && (
                <ComingSoon
                  title="Personas"
                  description="Switch between specialized versions of Arevias — each with its own instructions, tone, and expertise."
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <PreviewTile icon={Code2} title="Software Engineer" description="Precise, code-first, test-aware." />
                    <PreviewTile icon={GraduationCap} title="Tutor" description="Patient, step-by-step explanations." />
                    <PreviewTile icon={Briefcase} title="Business Consultant" description="Strategic, structured, decisive." />
                    <PreviewTile icon={PenLine} title="Writer" description="Expressive, on-brand, fluent." />
                  </div>
                </ComingSoon>
              )}

              {/* ─────────────── SECURITY ─────────────── */}
              {section === "security" && tab === "account" && (
                <div className="grid grid-cols-1 max-w-2xl gap-5">
                  <Card>
                    <h3 className="mb-4 font-medium">Change email</h3>
                    <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="min-w-0 truncate text-muted-foreground">{user.email}</span>
                      <Chip>{emailVerified ? "Verified" : "Unverified"}</Chip>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <Field label="New email" hint="A confirmation link is sent to the new address.">
                        <TextInput type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@example.com" />
                      </Field>
                      <div className="flex flex-wrap items-center gap-3">
                        <SaveButton onClick={changeEmail} disabled={!newEmail}>Update email</SaveButton>
                        {error && <span className="text-xs text-red-600">{error}</span>}
                      </div>
                    </div>
                  </Card>
                  <Card>
                    <h3 className="mb-4 font-medium">Change password</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <Field label="New password" hint="At least 6 characters.">
                        <TextInput type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                      </Field>
                      <div className="flex flex-wrap items-center gap-3">
                        <SaveButton onClick={changePassword} disabled={!newPassword}>Update password</SaveButton>
                      </div>
                    </div>
                  </Card>
                  {accountMsg && <p className="text-xs text-muted-foreground">{accountMsg}</p>}
                  <Card>
                    <h3 className="mb-4 font-medium">Account details</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Detail label="User ID" value={<CopyField value={user.id} className="max-w-full" />} />
                      <Detail label="Provider" value={<span className="capitalize">{provider}</span>} />
                      <Detail label="Created" value={fmtDate(user.created_at)} />
                      <Detail label="Email verified" value={emailVerified ? "Yes" : "No"} />
                    </div>
                  </Card>
                </div>
              )}

              {section === "security" && tab === "providers" && (
                <div className="grid grid-cols-1 max-w-2xl gap-4">
                  {PROVIDERS.map(({ id, label, Icon }) => {
                    const connected = isLinked(id);
                    return (
                      <Card key={id} className="!p-5">
                        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                          <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-soft">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="font-medium">{label}</span>
                              {connected && <Chip ink>Connected</Chip>}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{connected ? "Active sign-in method." : "Not connected."}</div>
                          </div>
                          {connected ? (
                            <Chip className="sm:ml-auto"><StatusDot on /> Active</Chip>
                          ) : (
                            <Button variant="ghost" className="w-full sm:ml-auto sm:w-auto" onClick={() => oauth(id as "google")}>Connect</Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                  {error && <p className="text-xs text-red-600">{error}</p>}
                </div>
              )}

              {section === "security" && tab === "sessions" && (
                <Card className="max-w-2xl">
                  <h3 className="mb-4 font-medium">Current session</h3>
                  <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-soft">
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm">This device</p>
                        <p className="break-words text-xs text-muted-foreground">Last sign-in {fmtDateTime(user.last_sign_in_at)}</p>
                      </div>
                    </div>
                    <Chip><StatusDot on /> Active</Chip>
                  </div>
                  <Hairline className="my-5" />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => signOut()}>
                      <LogOut className="h-3.5 w-3.5" /> Sign out
                    </Button>
                    <Button variant="danger" onClick={() => signOut("global")}>Sign out everywhere</Button>
                  </div>
                </Card>
              )}

              {section === "security" && tab === "privacy" && (
                <div className="grid grid-cols-1 max-w-2xl gap-5">
                  <Card>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-medium">Public profile</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Let others view your profile once public profiles ship.</p>
                      </div>
                      <PremiumToggle checked={prefs.isPublic} onChange={(v) => savePrefs({ isPublic: v })} />
                    </div>
                  </Card>
                  <Card>
                    <h3 className="font-medium">Export your data</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Download your profile and preferences as JSON.</p>
                    <div className="mt-4">
                      <Button variant="ghost" className="w-full sm:w-auto" onClick={exportData}>
                        <Download className="h-4 w-4" /> Download JSON
                      </Button>
                    </div>
                  </Card>
                  <Card className="!border-red-500/30">
                    <h3 className="font-medium text-red-600">Delete account</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Permanently delete your account and profile. This can't be undone.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <TextInput value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder='Type "delete" to confirm' />
                      <Button variant="danger" className="w-full sm:w-auto" onClick={deleteAccount} disabled={confirmText !== "delete" || deleting}>
                        <Trash2 className="h-4 w-4" /> {deleting ? "Deleting…" : "Delete account"}
                      </Button>
                    </div>
                    {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
                  </Card>
                </div>
              )}

              {/* ─────────────── ACTIVITY ─────────────── */}
              {section === "activity" && tab === "timeline" && (
                <Card>{timeline(["system", "login", "change"])}</Card>
              )}
              {section === "activity" && tab === "changes" && (
                <div className="grid grid-cols-1 gap-5">
                  <Card>
                    <h3 className="mb-4 font-medium">Profile changes</h3>
                    {feed(["change"])}
                  </Card>
                  <Card>
                    <h3 className="mb-4 font-medium">Current AI config snapshot</h3>
                    <pre className="overflow-auto rounded-xl border border-border bg-soft p-4 font-mono text-xs leading-relaxed text-foreground">
{JSON.stringify(aiSnapshot, null, 2)}
                    </pre>
                  </Card>
                </div>
              )}
              {section === "activity" && tab === "logins" && (
                <Card>
                  <h3 className="mb-4 font-medium">Sign-in history</h3>
                  {feed(["login"])}
                </Card>
              )}
              {section === "activity" && tab === "events" && (
                <Card>
                  <h3 className="mb-4 font-medium">System events</h3>
                  {timeline(["system"])}
                </Card>
              )}

              {/* ─────────────── SETTINGS ─────────────── */}
              {section === "settings" && tab === "general" && (
                <div className="grid grid-cols-1 max-w-2xl gap-5">
                  <Card ink>
                    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-wider text-ink-foreground/60">Current plan</div>
                        <div className="mt-2 font-display text-3xl text-ink-foreground">Arevias Free</div>
                        <p className="mt-2 text-sm text-ink-foreground/70">Upgrade for unlimited personas and long-term memory.</p>
                      </div>
                      <button className="w-full rounded-xl bg-ink-foreground px-4 py-2 text-sm font-medium text-ink sm:w-auto">Upgrade</button>
                    </div>
                  </Card>
                  <Card>
                    <h3 className="font-medium">Reset preferences</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Restore your AI and interface preferences to defaults. Your account stays.</p>
                    <div className="mt-4">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          applyReduceMotion(DEFAULT_PREFS.reduceMotion);
                          savePrefs(DEFAULT_PREFS);
                        }}
                      >
                        Reset all preferences
                      </Button>
                    </div>
                  </Card>
                </div>
              )}
              {section === "settings" && tab === "appearance" && (
                <Card className="max-w-2xl">
                  <h3 className="mb-1 font-medium">Theme</h3>
                  <p className="mb-4 text-sm text-muted-foreground">The profile console ships light-first. More themes are on the roadmap.</p>
                  <div className="flex items-center justify-between rounded-xl border border-border bg-soft px-4 py-3">
                    <span className="text-sm">Light</span>
                    <Chip ink><StatusDot on /> Active</Chip>
                  </div>
                </Card>
              )}
              {section === "settings" && tab === "notifications" && (
                <Card className="max-w-2xl">
                  <h3 className="mb-4 font-medium">Email notifications</h3>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Security alerts</div>
                      <p className="mt-0.5 text-sm text-muted-foreground">Sign-ins and account changes.</p>
                    </div>
                    <PremiumToggle checked={prefs.notifySecurity} onChange={(v) => savePrefs({ notifySecurity: v })} />
                  </div>
                  <Hairline className="my-4" />
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Tips & onboarding</div>
                      <p className="mt-0.5 text-sm text-muted-foreground">Occasional guidance to get more from Arevias.</p>
                    </div>
                    <PremiumToggle checked={prefs.notifyTips} onChange={(v) => savePrefs({ notifyTips: v })} />
                  </div>
                </Card>
              )}
              {section === "settings" && tab === "accessibility" && (
                <div className="grid grid-cols-1 max-w-2xl gap-5">
                  <Card>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">Reduce motion</div>
                        <p className="mt-0.5 text-sm text-muted-foreground">Minimize animations and transitions across Arevias.</p>
                      </div>
                      <PremiumToggle
                        checked={prefs.reduceMotion}
                        onChange={(v) => {
                          applyReduceMotion(v);
                          savePrefs({ reduceMotion: v });
                        }}
                      />
                    </div>
                  </Card>
                  <ComingSoon title="High contrast" description="A higher-contrast palette for low-vision use." />
                  <ComingSoon title="Larger text" description="Scale interface typography across the console." />
                </div>
              )}
            </motion.div>
        </div>
      </main>
    </div>
    </PageTransition>
  );
}
