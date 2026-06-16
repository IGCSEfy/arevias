/// <reference types="vite/client" />
import { useEffect, type ReactNode } from "react";
import { createIsomorphicFn } from "@tanstack/react-start";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import areviasFavicon from "@/assets/arevias-favicon.png";
import { ConversationPanel } from "@/components/arevias/ConversationPanel";
import { TopNav } from "@/components/arevias/TopNav";
import { DockDebug } from "@/components/arevias/DockDebug";
import "../styles.css";

const AVATAR_COOKIE = "arevias_nav_avatar";

// Read the avatar cookie so the dock can render the user's picture into the SSR
// HTML on a hard refresh — without this the server paints a blank/default icon
// and it flashes before the client hydrates. Runs isomorphically: server reads
// the request cookie, client reads document.cookie (for client-side nav).
const readAvatarCookie = createIsomorphicFn()
  .client((): string | null => {
    const match = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${AVATAR_COOKIE}=`));
    const raw = match?.split("=")[1];
    return raw ? decodeURIComponent(raw) : null;
  })
  .server(async (): Promise<string | null> => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const raw = getCookie(AVATAR_COOKIE);
    return raw ? decodeURIComponent(raw) : null;
  });

export const Route = createRootRoute({
  loader: async () => ({ avatarUrl: await readAvatarCookie() }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Arevias" },
      { name: "description", content: "Arevias — AI but human. A conversation partner that adapts to you." },
      { name: "author", content: "Arevias" },
      { property: "og:title", content: "Arevias" },
      { property: "og:description", content: "AI but Human." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: areviasFavicon },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Arevias" },
      { name: "twitter:description", content: "AI but Human." },
      { name: "twitter:image", content: areviasFavicon },
    ],
    links: [
      { rel: "icon", type: "image/png", href: areviasFavicon },
      { rel: "apple-touch-icon", href: areviasFavicon },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" style={{ background: "#000" }}>
      <head>
        <HeadContent />
      </head>
      <body style={{ background: "#000", color: "#fff" }}>
        {children}
        <ConversationPanel />
        <TopNav />
        <DockDebug />
        <ReducedMotion />
        <Scripts />
      </body>
    </html>
  );
}

// Applies the saved "reduce motion" preference app-wide on every load.
function ReducedMotion() {
  useEffect(() => {
    try {
      const on = localStorage.getItem("arevias:reduce-motion") === "true";
      document.documentElement.dataset.reduceMotion = String(on);
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
