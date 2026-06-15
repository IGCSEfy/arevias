import { useSyncExternalStore } from "react";
import type { Message } from "@/components/arevias/Message";

/**
 * Threaded conversation history, persisted to localStorage.
 *
 * The store — not component state — is the source of truth for a thread's
 * messages and its transient "thinking" flag. The chat streaming loop writes
 * here with an explicit thread id, so the first-send navigation (`/` →
 * `/c/$threadId`) can remount ChatView mid-stream without losing the reply:
 * the old instance's loop keeps writing to the store, and the new instance
 * simply subscribes to it.
 */

const STORAGE_KEY = "arevias.conversations.v1";

export type Thread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

type Store = { threads: Thread[]; messages: Record<string, Message[]> };

const EMPTY_THREADS: Thread[] = [];
const EMPTY_MESSAGES: Message[] = [];

let cache: Store | null = null;
const listeners = new Set<() => void>();
/** Transient, in-memory only — which threads are generating a reply right now. */
const thinkingByThread = new Map<string, boolean>();

function read(): Store {
  if (cache) return cache;
  if (typeof window === "undefined") return { threads: EMPTY_THREADS, messages: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Store) : null;
    cache =
      parsed && Array.isArray(parsed.threads) && parsed.messages && typeof parsed.messages === "object"
        ? parsed
        : { threads: [], messages: {} };
  } catch {
    cache = { threads: [], messages: {} };
  }
  return cache;
}

function persist() {
  if (typeof window === "undefined" || !cache) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full or blocked — the in-memory copy keeps the session working */
  }
}

function emit() {
  for (const fn of listeners) fn();
}

/* Cross-tab sync: another tab's write replaces our cache. */
let storageSyncReady = false;
function ensureStorageSync() {
  if (storageSyncReady || typeof window === "undefined") return;
  storageSyncReady = true;
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    try {
      cache = e.newValue ? (JSON.parse(e.newValue) as Store) : { threads: [], messages: {} };
    } catch {
      return;
    }
    emit();
  });
}

function subscribe(fn: () => void) {
  ensureStorageSync();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function deriveTitle(text?: string): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "Untitled";
  return t.length > 45 ? `${t.slice(0, 45)}…` : t;
}

export function createThread(firstMessageText?: string): Thread {
  const store = read();
  const now = Date.now();
  const thread: Thread = {
    id: crypto.randomUUID(),
    title: firstMessageText ? deriveTitle(firstMessageText) : "New conversation",
    createdAt: now,
    updatedAt: now,
  };
  cache = {
    threads: [thread, ...store.threads],
    messages: { ...store.messages, [thread.id]: [] },
  };
  persist();
  emit();
  return thread;
}

export function deleteThread(id: string) {
  const store = read();
  const { [id]: _removed, ...rest } = store.messages;
  cache = { threads: store.threads.filter((t) => t.id !== id), messages: rest };
  thinkingByThread.delete(id);
  persist();
  emit();
}

export function renameThread(id: string, title: string) {
  const store = read();
  cache = {
    ...store,
    threads: store.threads.map((t) => (t.id === id ? { ...t, title } : t)),
  };
  persist();
  emit();
}

export function getMessages(id: string): Message[] {
  return read().messages[id] ?? EMPTY_MESSAGES;
}

export function setMessages(id: string, messages: Message[]) {
  const store = read();
  const thread = store.threads.find((t) => t.id === id);
  // Thread was deleted (possibly mid-stream) — drop the write instead of
  // resurrecting an orphaned messages entry.
  if (!thread) return;
  const firstUser = messages.find((m) => m.role === "user");
  const updated: Thread = {
    ...thread,
    updatedAt: Date.now(),
    title:
      thread.title === "New conversation" && firstUser
        ? deriveTitle(firstUser.text)
        : thread.title,
  };
  cache = {
    // Most recently active thread floats to the top.
    threads: [updated, ...store.threads.filter((t) => t.id !== id)],
    messages: { ...store.messages, [id]: messages },
  };
  persist();
  emit();
}

export function appendMessage(id: string, message: Message) {
  // Stamp the send time here so every message has one regardless of caller —
  // this is what gives Arevias its sense of time (reply gaps, time of day).
  const stamped = { ...message, createdAt: message.createdAt ?? Date.now() };
  setMessages(id, [...getMessages(id), stamped]);
}

export function setThreadThinking(id: string, on: boolean) {
  thinkingByThread.set(id, on);
  emit();
}

/* ── Hooks ─────────────────────────────────────────────────────────────── */

export function useThreads(): Thread[] {
  return useSyncExternalStore(
    subscribe,
    () => read().threads,
    () => EMPTY_THREADS,
  );
}

export function useThreadMessages(id: string | null): Message[] {
  return useSyncExternalStore(
    subscribe,
    () => (id ? getMessages(id) : EMPTY_MESSAGES),
    () => EMPTY_MESSAGES,
  );
}

export function useThreadThinking(id: string | null): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (id ? (thinkingByThread.get(id) ?? false) : false),
    () => false,
  );
}
