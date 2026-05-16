/// <reference types="vite/client" />
import type { ReactNode } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import "../styles.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Arevias" },
      { name: "description", content: "Arevias — an experimental AI surface." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Arevias" },
      { property: "og:description", content: "AI but Human." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Arevias" },
      { name: "twitter:description", content: "AI but Human." },
    ],
    links: [{ rel: "icon", href: "data:," }],
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
        <Scripts />
      </body>
    </html>
  );
}
