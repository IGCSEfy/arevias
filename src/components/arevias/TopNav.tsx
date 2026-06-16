"use client";

import { useEffect, useState } from "react";
import { useLoaderData } from "@tanstack/react-router";
import { Home } from "lucide-react";

import { AnimatedDock, type DockItemData } from "@/components/ui/animated-dock";
import { ChangelogIcon, ProfileIcon, AboutIcon } from "@/components/arevias/nav-icons";
import { supabaseBrowser, useSession } from "@/lib/supabase";

// Cache the last-known avatar URL so the dock icon shows it instantly on every
// mount / navigation instead of flashing the default glyph while the async
// profile fetch is in flight. Module memory survives client-side navigation;
// localStorage survives full reloads.
const AVATAR_CACHE_KEY = "arevias:nav-avatar";
const AVATAR_COOKIE = "arevias_nav_avatar";
const AVATAR_EVENT = "arevias:avatar-changed";
let cachedAvatarUrl: string | null =
  typeof window !== "undefined" ? window.localStorage.getItem(AVATAR_CACHE_KEY) : null;

function setCachedAvatar(url: string | null) {
  cachedAvatarUrl = url;
  if (typeof window === "undefined") return;
  if (url) window.localStorage.setItem(AVATAR_CACHE_KEY, url);
  else window.localStorage.removeItem(AVATAR_CACHE_KEY);
  // Mirror to a cookie so the server can render the avatar into the SSR HTML on
  // a hard refresh (localStorage isn't readable server-side) — kills the flash.
  if (url) {
    document.cookie = `${AVATAR_COOKIE}=${encodeURIComponent(url)};path=/;max-age=31536000;samesite=lax`;
  } else {
    document.cookie = `${AVATAR_COOKIE}=;path=/;max-age=0;samesite=lax`;
  }
}

/**
 * Call after changing the user's avatar so the dock icon updates immediately
 * instead of waiting for a navigation / remount to re-fetch it.
 */
export function broadcastAvatarChange(url: string | null) {
  setCachedAvatar(url);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: url }));
  }
}

// Profile dock icon: shows the signed-in user's avatar. The initial state is
// null so the server render and the first client (hydration) render match —
// otherwise the default glyph gets baked into the SSR HTML and flashes before
// hydration. The cached avatar is seeded in an effect, and the default glyph is
// only shown once we've *definitively* resolved that there is no avatar
// (signed out, or a signed-in profile with no avatar set). Until then we render
// a blank placeholder so the default person icon never flashes.
function NavProfileIcon() {
  const { session, loading } = useSession();
  // Seed from the root loader (cookie-backed) so the server and the first
  // client render agree — the avatar is already in the SSR HTML on refresh.
  const { avatarUrl: ssrAvatar } = useLoaderData({ from: "__root__" });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(ssrAvatar ?? null);
  const [resolved, setResolved] = useState(false);

  // Seed from the cache (last-known avatar) once we're on the client, and keep
  // it live when the avatar is changed elsewhere (e.g. the profile page).
  useEffect(() => {
    if (!avatarUrl && cachedAvatarUrl) setAvatarUrl(cachedAvatarUrl);
    const onChange = (e: Event) => {
      setAvatarUrl((e as CustomEvent<string | null>).detail ?? null);
    };
    window.addEventListener(AVATAR_EVENT, onChange);
    return () => window.removeEventListener(AVATAR_EVENT, onChange);
  }, []);

  useEffect(() => {
    // Still resolving the session — keep whatever we already have, no flash.
    if (loading) return;
    // Definitively signed out — clear the cached avatar.
    if (!session) {
      setCachedAvatar(null);
      setAvatarUrl(null);
      setResolved(true);
      return;
    }
    supabaseBrowser()
      .from("profiles")
      .select("avatar_url")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        const next = (data as { avatar_url: string | null } | null)?.avatar_url ?? null;
        setCachedAvatar(next);
        setAvatarUrl(next);
        setResolved(true);
      });
  }, [session, loading]);

  if (avatarUrl) {
    return <img src={avatarUrl} alt="Profile" className="size-7 rounded-full object-cover" />;
  }
  // Only show the default glyph once we know there's genuinely no avatar.
  // Before that (SSR, hydration, in-flight fetch) render a blank placeholder so
  // the person icon never flashes in for signed-in users.
  if (resolved) return <ProfileIcon />;
  return <span className="size-7" aria-hidden />;
}

// Top navigation dock. `link` is an href; add `target: "_blank"` for external links.
const navItems: DockItemData[] = [
  { link: "/", Icon: <Home size={20} /> },
  { link: "/changelog", Icon: <ChangelogIcon /> },
  { link: "/profile", Icon: <NavProfileIcon /> },
  { link: "/about", Icon: <AboutIcon /> },
];

export function TopNav() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
      // iOS Safari can mis-position a `position: fixed` element to mid-screen
      // when another part of the page (the profile console's nested scroll +
      // async-gated render) forces a recomposite. Promoting the dock to its own
      // compositing layer pins it to the viewport. Desktop is unaffected.
      style={{ transform: "translateZ(0)" }}
    >
      {/*
        - pointer-events-auto: re-enable interaction on the dock itself (wrapper
          stays pass-through so the rest of the page remains clickable).
        - items-start + pt-3/pb-0: anchor icons to the top of the bar so they
          magnify downward into the page instead of off the top of the screen.
      */}
      <AnimatedDock
        className="arevias-top-dock pointer-events-auto items-start pb-0 pt-3"
        items={navItems}
      />
    </div>
  );
}
