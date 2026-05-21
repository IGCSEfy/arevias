import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AmbientLogo } from "@/components/arevias/AmbientLogo";
import { ChatInput } from "@/components/arevias/ChatInput";
import type { ReplyTarget } from "@/components/arevias/ChatInput";
import { CursorGlow } from "@/components/arevias/CursorGlow";
import { MessageBlock } from "@/components/arevias/Message";
import type { Message } from "@/components/arevias/Message";
import { ThinkingDots } from "@/components/arevias/Thinking";
import { ai } from "@/lib/ai";
import type { AiHistoryMessage } from "@/lib/ai";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const toAiHistory = (message: Message): AiHistoryMessage => ({
  id: message.id,
  role: message.role,
  text: message.text,
  replyTo: message.replyTo,
});

function IndexComponent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const pendingScrollRaf = useRef<number | null>(null);
  const pendingScrollTimer = useRef<number | null>(null);
  const activeScrollRaf = useRef<number | null>(null);
  const autoScrolling = useRef(false);
  const previousRender = useRef({ messageCount: 0, thinking: false });
  const empty = messages.length === 0;

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const cancelPendingScroll = () => {
    if (pendingScrollTimer.current != null) {
      clearTimeout(pendingScrollTimer.current);
    }
    if (pendingScrollRaf.current != null) {
      cancelAnimationFrame(pendingScrollRaf.current);
    }
    pendingScrollTimer.current = null;
    pendingScrollRaf.current = null;
  };

  const cancelActiveScroll = () => {
    if (activeScrollRaf.current != null) {
      cancelAnimationFrame(activeScrollRaf.current);
    }
    activeScrollRaf.current = null;
    autoScrolling.current = false;
  };

  const scrollToBottom = (el: HTMLDivElement) => {
    const target = Math.max(0, el.scrollHeight - el.clientHeight);
    const start = el.scrollTop;
    const distance = target - start;

    if (Math.abs(distance) < 2) {
      el.scrollTo({ top: target, behavior: "auto" });
      stickToBottom.current = true;
      return;
    }

    const duration = Math.min(620, Math.max(300, Math.abs(distance) * 0.45));
    const startedAt = performance.now();
    autoScrolling.current = true;

    const tick = (now: number) => {
      const p = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.scrollTo({ top: start + distance * eased, behavior: "auto" });

      if (p < 1) {
        activeScrollRaf.current = requestAnimationFrame(tick);
        return;
      }

      activeScrollRaf.current = null;
      el.scrollTo({ top: target, behavior: "auto" });
      autoScrolling.current = false;
      stickToBottom.current = true;
    };

    activeScrollRaf.current = requestAnimationFrame(tick);
  };

  const scheduleScroll = (force = false) => {
    if (!force && !stickToBottom.current) return;
    cancelPendingScroll();
    cancelActiveScroll();
    pendingScrollTimer.current = window.setTimeout(() => {
      pendingScrollTimer.current = null;
      pendingScrollRaf.current = requestAnimationFrame(() => {
        pendingScrollRaf.current = requestAnimationFrame(() => {
          pendingScrollRaf.current = null;
          const el = scrollRef.current;
          if (!el || (!force && !stickToBottom.current)) return;
          scrollToBottom(el);
        });
      });
    }, 80);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateStickiness = () => {
      if (autoScrolling.current) return;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottom.current = distance < 200;
    };

    const handleUserScrollIntent = () => {
      cancelPendingScroll();
      cancelActiveScroll();
      el.scrollTo({ top: el.scrollTop, behavior: "auto" });
      updateStickiness();
    };

    el.addEventListener("scroll", updateStickiness, { passive: true });
    el.addEventListener("wheel", handleUserScrollIntent, { passive: true });
    el.addEventListener("touchstart", handleUserScrollIntent, { passive: true });
    el.addEventListener("pointerdown", handleUserScrollIntent, { passive: true });

    return () => {
      el.removeEventListener("scroll", updateStickiness);
      el.removeEventListener("wheel", handleUserScrollIntent);
      el.removeEventListener("touchstart", handleUserScrollIntent);
      el.removeEventListener("pointerdown", handleUserScrollIntent);
    };
  }, [messages.length > 0]);

  useEffect(() => {
    const messageAdded = messages.length > previousRender.current.messageCount;
    const thinkingStarted = thinking && !previousRender.current.thinking;

    previousRender.current = { messageCount: messages.length, thinking };

    if (messageAdded || thinkingStarted) {
      scheduleScroll();
    }
  }, [messages.length, thinking]);

  useEffect(() => {
    if (empty) return;

    const root = document.documentElement;
    const timers = new Set<number>();

    const updateKeyboardLayout = () => {
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const keyboardOffset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      const dock = document.querySelector<HTMLElement>(".arevias-input-dock");
      const dockHeight = dock?.getBoundingClientRect().height ?? 112;

      root.style.setProperty(
        "--arevias-visual-height",
        `${Math.round(viewportHeight)}px`,
      );
      root.style.setProperty(
        "--arevias-keyboard-offset",
        `${Math.round(keyboardOffset)}px`,
      );
      root.style.setProperty(
        "--arevias-input-dock-space",
        `${Math.ceil(dockHeight + 28)}px`,
      );
    };

    const clearKeyboardLayout = () => {
      root.style.removeProperty("--arevias-visual-height");
      root.style.removeProperty("--arevias-keyboard-offset");
      root.style.removeProperty("--arevias-input-dock-space");
    };

    const queueScroll = () => {
      updateKeyboardLayout();
      stickToBottom.current = true;
      scheduleScroll(true);

      for (const delay of [120, 320, 620]) {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          updateKeyboardLayout();
          stickToBottom.current = true;
          scheduleScroll(true);
        }, delay);
        timers.add(timer);
      }
    };

    const isActiveChatInput = (target: EventTarget | null) =>
      target instanceof HTMLTextAreaElement &&
      Boolean(target.closest(".arevias-input-dock"));

    const handleFocusIn = (event: FocusEvent) => {
      if (!isActiveChatInput(event.target)) return;
      root.dataset.areviasChatInputFocus = "true";
      updateKeyboardLayout();
      queueScroll();
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (!isActiveChatInput(event.target)) return;
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (isActiveChatInput(document.activeElement)) return;
        delete root.dataset.areviasChatInputFocus;
        clearKeyboardLayout();
      }, 80);
      timers.add(timer);
    };

    const handleViewportChange = () => {
      if (root.dataset.areviasChatInputFocus === "true") {
        updateKeyboardLayout();
        queueScroll();
      }
    };

    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);
    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("scroll", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.clear();
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
      delete root.dataset.areviasChatInputFocus;
      clearKeyboardLayout();
    };
  }, [empty]);

  useEffect(() => {
    return () => {
      cancelPendingScroll();
      cancelActiveScroll();
    };
  }, []);

  const handleSend = async (text: string) => {
    const currentReply = replyTo;
    const wasEmpty = messages.length === 0;
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      replyTo: currentReply ?? undefined,
    };

    stickToBottom.current = true;
    setMessages((m) => [...m, userMsg]);
    setReplyTo(null);
    setThinking(true);
    scheduleScroll(true);

    const responseStartedAt = performance.now();
    const parts = await ai.generateReplyParts({
      message: text,
      history: messages.slice(-8).map(toAiHistory),
      replyTo: currentReply,
    });
    const responseWaitMs = performance.now() - responseStartedAt;
    const replyParts = parts.filter(Boolean);

    if (replyParts.length === 0) {
      setThinking(false);
      return;
    }

    for (let i = 0; i < replyParts.length; i++) {
      const part = replyParts[i];

      if (i > 0) {
        setThinking(true);
      }
      scheduleScroll();
      const baseThinkMs =
        (i === 0 ? 1300 : 700) + part.length * 14 + Math.random() * 500;
      const minimumFirstThinkMs = wasEmpty ? 1500 : 900;
      const minimumAfterResponseMs = wasEmpty ? 450 : 350;
      const thinkMs =
        i === 0
          ? Math.max(
              minimumAfterResponseMs,
              minimumFirstThinkMs - responseWaitMs,
              baseThinkMs - responseWaitMs,
            )
          : baseThinkMs;
      await wait(thinkMs);

      setThinking(false);
      await wait(220);

      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "ai",
          text: part,
          continuation: i > 0,
        },
      ]);
      scheduleScroll();

      await wait(900 + Math.random() * 400);
    }
  };

  return (
    <div className="arevias-app-shell fixed inset-0 overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 radial-glow" />
      <CursorGlow />
      <main className="arevias-main relative z-10 flex h-[100dvh] overflow-hidden flex-col">
        <AnimatePresence mode="wait">
          {empty ? (
            <motion.section
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className={`arevias-hero-section relative flex flex-1 items-center justify-center px-6 ${
                loaded ? "is-loaded" : ""
              }`}
            >
              <div aria-hidden className="arevias-intro-blob-field">
                <div className="arevias-intro-blob arevias-intro-blob-1" />
                <div className="arevias-intro-blob arevias-intro-blob-2" />
                <div className="arevias-intro-blob arevias-intro-blob-3" />
              </div>
              <div aria-hidden className="arevias-hero-depth" />
              <div aria-hidden className="arevias-hero-vignette" />
              <div className="arevias-hero-composition relative z-10 w-full mx-auto">
                <div className="arevias-intro-headline arevias-hero-logo-frame pointer-events-none">
                  <AmbientLogo width={540} opacity={0.2} />
                </div>
                <div className="arevias-intro-cta arevias-hero-input-frame relative">
                  <ChatInput onSend={handleSend} disableEntranceMotion />
                </div>
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="conversation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="arevias-conversation relative flex h-full min-h-0 flex-col overflow-hidden"
            >
              <div
                ref={scrollRef}
                className="arevias-conversation-scroll overscroll-contain flex-1 min-h-0 overflow-y-auto px-6 md:px-14 pt-16"
              >
                <div className="arevias-conversation-inner max-w-3xl mx-auto py-10 space-y-6 pb-[220px]">
                  {messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const tightToPrev = prev && prev.role === m.role && !m.replyTo;

                    return (
                      <div key={m.id} className={tightToPrev ? "-mt-2" : ""}>
                        <MessageBlock
                          msg={m}
                          onReply={(t) =>
                            setReplyTo({ id: t.id, role: t.role, text: t.text })
                          }
                        />
                      </div>
                    );
                  })}
                  <AnimatePresence initial={false}>
                    {thinking && (
                      <motion.div
                        key="thinking"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: "linear" }}
                        style={{ willChange: "opacity" }}
                      >
                        <ThinkingDots />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div ref={bottomRef} aria-hidden className="h-px w-full" />
                </div>
              </div>

              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-64"
                style={{
                  background:
                    "linear-gradient(to top, var(--color-background) 38%, color-mix(in oklab, var(--color-background) 70%, transparent) 72%, transparent)",
                }}
              />

              <div className="arevias-input-dock absolute inset-x-0 bottom-0 z-10 px-6 md:px-14 pb-8 pt-4">
                <div className="arevias-input-shell relative w-full max-w-2xl mx-auto">
                  <div className="relative">
                    <ChatInput
                      onSend={handleSend}
                      disabled={thinking}
                      replyTo={replyTo}
                      onCancelReply={() => setReplyTo(null)}
                    />
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
