import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ command, mode }) => {
  const isDev = command === "serve";
  const env = loadEnv(mode, process.cwd(), "");

  // Scope network access to our own origin + Supabase (REST/auth over https,
  // realtime over wss). Falls back to broad https/wss if the URL isn't set.
  let supabaseOrigin = "";
  try {
    supabaseOrigin = env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL).origin : "";
  } catch {
    /* malformed URL — leave empty */
  }
  const connect = ["'self'", supabaseOrigin, "https:", "wss:", isDev && "ws:"]
    .filter(Boolean)
    .join(" ");

  // 'unsafe-inline' is required for styles (React inline styles, Tailwind,
  // Framer Motion) and for the SSR hydration script; 'unsafe-eval' only in dev
  // (Vite HMR). Everything else is locked down — no framing, no plugins.
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseOrigin || "https:"}`.trim(),
    "font-src 'self' data:",
    `connect-src ${connect}`,
  ].join("; ");

  const securityHeaders: Record<string, string> = {
    "Content-Security-Policy": csp,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    // HSTS only takes effect over HTTPS; harmless on localhost.
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  };

  return {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    nitro: {
      // Deploy target: Vercel (Build Output API). Nitro also auto-detects this
      // in Vercel's CI, but pinning it makes local prod builds match.
      preset: "vercel",
      routeRules: {
        "/**": { headers: securityHeaders },
      },
    },
    plugins: [tanstackStart(), nitro(), tailwindcss(), react()],
  };
});
