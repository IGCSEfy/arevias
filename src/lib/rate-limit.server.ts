import "@tanstack/react-start/server-only";
import { createHash } from "node:crypto";

/** Daily message caps. Anonymous users get a taste; signing in unlocks ~10x. */
export const ANON_DAILY_LIMIT = 5;
export const USER_DAILY_LIMIT = 50;

export type Requester = { id: string; loggedIn: boolean };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IP_SALT = process.env.RATE_LIMIT_SALT ?? "arevias-rate-limit-v1";

async function admin() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function limitFor(loggedIn: boolean): number {
  return loggedIn ? USER_DAILY_LIMIT : ANON_DAILY_LIMIT;
}

/**
 * Identify who's calling: verify the bearer token → signed-in user, otherwise
 * fall back to a hashed IP. The raw IP is never stored — only a salted hash.
 */
export async function identifyRequester(request: Request): Promise<Requester> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : "";

  if (token) {
    const sb = await admin();
    if (sb) {
      try {
        const { data } = await sb.auth.getUser(token);
        if (data.user) return { id: `user:${data.user.id}`, loggedIn: true };
      } catch {
        /* invalid/expired token → treat as anonymous */
      }
    }
  }

  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip =
    forwarded.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const hash = createHash("sha256").update(ip + IP_SALT).digest("hex").slice(0, 20);
  return { id: `ip:${hash}`, loggedIn: false };
}

function dayKey(id: string): string {
  return `${id}:${new Date().toISOString().slice(0, 10)}`;
}

/**
 * Add one to today's count and return the new total. Fails OPEN (returns 0) when
 * the limiter isn't configured or errors — availability over strictness, since a
 * down limiter shouldn't take the whole app with it.
 */
export async function countUsage(id: string): Promise<number> {
  const sb = await admin();
  if (!sb) return 0;
  try {
    const { data, error } = await sb.rpc("increment_usage", { p_key: dayKey(id) });
    return error || typeof data !== "number" ? 0 : data;
  } catch {
    return 0;
  }
}

/** Read today's count without incrementing (for guarding secondary endpoints). */
export async function peekUsage(id: string): Promise<number> {
  const sb = await admin();
  if (!sb) return 0;
  try {
    const { data } = await sb
      .from("usage_limits")
      .select("count")
      .eq("key", dayKey(id))
      .maybeSingle();
    return (data as { count: number } | null)?.count ?? 0;
  } catch {
    return 0;
  }
}
