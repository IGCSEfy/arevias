import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AmbientLogo } from "@/components/arevias/AmbientLogo";
import { ChatInput } from "@/components/arevias/ChatInput";
import { Footer } from "@/components/arevias/footer";
import { LandingReveal } from "@/components/arevias/landing-reveal";
import type { ReplyTarget } from "@/components/arevias/ChatInput";
import { MessageBlock } from "@/components/arevias/Message";
import type { Message } from "@/components/arevias/Message";
import { ThinkingDots } from "@/components/arevias/Thinking";
import { ai, isFallbackReplyText, toPersonalization } from "@/lib/ai";
import type { AiHistoryMessage, AiPersonalization, LimitReason } from "@/lib/ai";
import {
  appendMessage,
  createThread,
  getMessages,
  setThreadThinking,
  useThreadMessages,
  useThreadThinking,
} from "@/lib/conversations";
import { supabaseBrowser } from "@/lib/supabase";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * "Living Conversation" restraint knobs. The decision model is conservative on
 * its own, but these are hard client-side ceilings so Arevias can never become
 * chatty: at most a couple of afterthoughts per turn, and each successive one
 * must also clear a probability gate before we even ask.
 */
const MAX_AFTERTHOUGHTS_PER_TURN = 2;
const CHAINED_AFTERTHOUGHT_CHANCE = 0.3;

// Cheap, local pre-gate: should we even ASK the model whether a follow-up is
// warranted? Most messages are short/closed/mundane and never deserve one, so
// this skips the decision call entirely for them — the model only judges turns
// where a follow-up is genuinely plausible.
const AFTERTHOUGHT_EMOTION =
  /\b(nervous|scared|afraid|terrified|worried|worr(y|ied)|anxious|stress(ed)?|overwhelmed|excited|thrilled|happy|sad|depress(ed)?|angry|frustrat(ed)?|annoyed|lonely|grateful|proud|embarrassed|guilty|hopeful|hurt|heartbroken|miss|love|hate|exhausted|burn(t|ed) out|freaking out|can'?t believe|don'?t know what)\b/i;
const AFTERTHOUGHT_SIGNOFF =
  /^(ok(ay)?|k+|cool|nice|great|got it|sounds good|will do|sure|yep|yeah|yup|nope|no|thanks?|thank you|thx|ty|np|bye|cya|see ya|later|gn|goodnight|good night|gtg|ttyl|lol|lmao|haha+|hmm+|oh|word|bet|fr|facts|true)[.!? ]*$/i;

function shouldConsiderAfterthought(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  // Personal / emotional disclosure — always worth a look.
  if (AFTERTHOUGHT_EMOTION.test(t)) return true;
  // A bare acknowledgment or sign-off — never.
  if (AFTERTHOUGHT_SIGNOFF.test(t)) return false;
  // Otherwise only substantive messages are borderline enough to ask about.
  return t.split(/\s+/).filter(Boolean).length >= 6;
}

/** Humanize a reply gap; returns null for normal back-and-forth (not worth noting). */
const humanizeGap = (ms: number): string | null => {
  const min = Math.round(ms / 60000);
  if (min < 2) return null;
  if (min < 60) return `${min} minutes`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"}`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? "" : "s"}`;
};

/**
 * A short, human-readable time context for the model: the user's current time
 * of day, plus how long they took before their latest message (when notable).
 * Computed on the client so it reflects the user's real local time/timezone.
 */
const buildTimeContext = (messages: Message[]): string => {
  const now = new Date();
  const h = now.getHours();
  const partOfDay =
    h < 5 ? "the middle of the night"
      : h < 12 ? "morning"
        : h < 17 ? "afternoon"
          : h < 21 ? "evening"
            : "night";
  const day = now.toLocaleDateString(undefined, { weekday: "long" });
  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  let ctx = `Right now it's ${day} ${partOfDay} (${time}) for the user.`;

  // How long the user took before their latest message.
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") { lastUserIdx = i; break; }
  }
  if (lastUserIdx > 0) {
    const userMsg = messages[lastUserIdx];
    const prev = messages[lastUserIdx - 1];
    if (userMsg.createdAt && prev.createdAt) {
      const gap = humanizeGap(userMsg.createdAt - prev.createdAt);
      if (gap) ctx += ` They replied about ${gap} after the previous message.`;
    }
  }
  return ctx;
};

/** Text of the trailing run of consecutive AI messages — what Arevias "just said". */
const getTrailingAiText = (messages: Message[]): string => {
  const trailing: string[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "ai") break;
    trailing.unshift(messages[i].text);
  }
  return trailing.join("\n");
};

const toAiHistory = (message: Message): AiHistoryMessage => ({
  id: message.id,
  role: message.role,
  text: message.text,
  replyTo: message.replyTo,
});

const toReplyTarget = (message: Message): ReplyTarget => ({
  id: message.id,
  role: message.role,
  text: message.text,
});

const getTrailingUserMessages = (messages: Message[]) => {
  const trailing: Message[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") break;
    trailing.unshift(message);
  }

  return trailing;
};

const chooseAreviasReplyTarget = (
  history: Message[],
  userMsg: Message,
): ReplyTarget | undefined => {
  const conversation = [...history, userMsg];
  const trailingUserMessages = getTrailingUserMessages(conversation);

  if (trailingUserMessages.length >= 2) {
    const earlierUserMessages = trailingUserMessages.slice(0, -1);
    const target =
      earlierUserMessages[
        Math.floor(Math.random() * earlierUserMessages.length)
      ];
    return toReplyTarget(target);
  }

  const userMessageCount = conversation.filter((m) => m.role === "user").length;
  const cadenceHit = userMessageCount >= 2 && userMessageCount % 3 === 0;
  const naturalExtraHit = userMessageCount >= 4 && Math.random() < 0.12;

  if (!cadenceHit && !naturalExtraHit) return undefined;

  const recentUserMessages = conversation
    .filter((m) => m.role === "user")
    .slice(-4);
  const target =
    recentUserMessages[Math.floor(Math.random() * recentUserMessages.length)];

  return target ? toReplyTarget(target) : undefined;
};

export function ChatView({ threadId }: { threadId: string | null }) {
  // On `/` the first send creates a thread and navigates to it. `createdId`
  // bridges the gap until the `/c/$threadId` route remounts us: this instance
  // immediately rebinds to the new thread so the store-driven messages and
  // thinking state render without a blink.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const activeId = threadId ?? createdId;
  const navigate = useNavigate();

  const messages = useThreadMessages(activeId);
  const thinking = useThreadThinking(activeId);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  // Set once the user hits their daily cap: "signup" (anon → log in) or
  // "signoff" (logged-in → out for today). Soft-blocks the input.
  const [blocked, setBlocked] = useState<LimitReason | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // The hero section is its own scroll container (the document is locked), so
  // the scroll-reveal below the chat tracks it rather than the window.
  const heroSectionRef = useRef<HTMLElement>(null);
  const stickToBottom = useRef(true);
  const pendingScrollRaf = useRef<number | null>(null);
  const pendingScrollTimer = useRef<number | null>(null);
  const activeScrollRaf = useRef<number | null>(null);
  const autoScrolling = useRef(false);
  const previousRender = useRef({ messageCount: 0, thinking: false });
  const personalization = useRef<AiPersonalization | null>(null);
  // "Living Conversation" — a pending autonomous follow-up and its cancel token.
  const afterthoughtRun = useRef<{ cancelled: boolean } | null>(null);
  const afterthoughtTimer = useRef<number | null>(null);
  const afterthoughtResolve = useRef<(() => void) | null>(null);
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

  // Switching threads resets transient UI state and drops any pending follow-up.
  useEffect(() => {
    setReplyTo(null);
    setBlocked(null);
    stickToBottom.current = true;
    return () => {
      if (afterthoughtRun.current) afterthoughtRun.current.cancelled = true;
      afterthoughtRun.current = null;
      if (afterthoughtTimer.current != null) clearTimeout(afterthoughtTimer.current);
      afterthoughtTimer.current = null;
      afterthoughtResolve.current?.();
      afterthoughtResolve.current = null;
    };
  }, [threadId]);

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

      // iOS scrolls the layout viewport to bring a focused input into view.
      // With our fixed-body layout that shoves all the fixed content (the
      // messages) up out of the visible area, leaving an empty band until the
      // user manually scrolls. Keep the window pinned at the top so the fixed
      // content stays aligned with what's actually visible.
      if (window.scrollY !== 0 || window.pageYOffset !== 0) {
        window.scrollTo(0, 0);
      }
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
      Boolean(target.closest("[data-arevias-chat-input]"));

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
  }, []);

  useEffect(() => {
    return () => {
      cancelPendingScroll();
      cancelActiveScroll();
    };
  }, []);

  // Load the user's saved personalization so it can shape AI replies.
  useEffect(() => {
    let active = true;
    const sb = supabaseBrowser();
    void sb.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) return;
      void sb
        .from("profiles")
        .select("preferences")
        .eq("id", uid)
        .single()
        .then(({ data: row }) => {
          if (!active) return;
          const prefs = (row as { preferences?: Record<string, unknown> } | null)?.preferences;
          personalization.current = toPersonalization(prefs);
        });
    });
    return () => {
      active = false;
    };
  }, []);

  // A wait that a cancel can resolve early, so a pending follow-up stops the
  // moment the user re-engages (sends or starts typing).
  const afterthoughtWait = (ms: number) =>
    new Promise<void>((resolve) => {
      afterthoughtResolve.current = resolve;
      afterthoughtTimer.current = window.setTimeout(() => {
        afterthoughtTimer.current = null;
        afterthoughtResolve.current = null;
        resolve();
      }, ms);
    });

  const cancelAfterthoughts = (clearThinking: boolean) => {
    if (afterthoughtRun.current) afterthoughtRun.current.cancelled = true;
    afterthoughtRun.current = null;
    if (afterthoughtTimer.current != null) clearTimeout(afterthoughtTimer.current);
    afterthoughtTimer.current = null;
    // Wake any in-flight wait so the run can see it's cancelled and bail.
    afterthoughtResolve.current?.();
    afterthoughtResolve.current = null;
    // On a new send, handleSend owns the thinking indicator — don't touch it.
    // On typing, clear any follow-up "typing…" blip we may have shown.
    if (clearThinking && activeId) setThreadThinking(activeId, false);
  };

  // After a reply, decide (conservatively) whether Arevias would send a
  // spontaneous follow-up, wait its chosen delay, then deliver it — repeating a
  // capped, decaying number of times. Fire-and-forget; cancels if the user
  // re-engages or the thread changes.
  const runAfterthoughts = async (id: string) => {
    // Local pre-gate: only spend a decision call when the user's last message
    // is the kind of thing a follow-up could plausibly attach to.
    const lastUser = [...getMessages(id)].reverse().find((m) => m.role === "user");
    if (!lastUser || !shouldConsiderAfterthought(lastUser.text)) return;

    const token = { cancelled: false };
    afterthoughtRun.current = token;
    const stop = () => token.cancelled || afterthoughtRun.current !== token;

    for (let prior = 0; prior < MAX_AFTERTHOUGHTS_PER_TURN; prior++) {
      if (stop()) return;
      // Each chained follow-up beyond the first must also clear a chance gate.
      if (prior > 0 && Math.random() > CHAINED_AFTERTHOUGHT_CHANCE) return;

      const history = getMessages(id);
      const lastReply = getTrailingAiText(history);
      const lastUser = [...history].reverse().find((m) => m.role === "user");
      if (!lastReply || !lastUser) return;

      const decision = await ai.generateAfterthought({
        message: lastUser.text,
        history: history
          .filter((m) => !(m.role === "ai" && isFallbackReplyText(m.text)))
          .slice(-8)
          .map(toAiHistory),
        replyTo: null,
        personalization: personalization.current,
        lastReply,
        priorAfterthoughts: prior,
        timeContext: buildTimeContext(history),
      });
      if (stop()) return;
      if (!decision?.continueConversation || !decision.message) return;

      await afterthoughtWait(decision.delay * 1000);
      if (stop()) return;

      // Brief "typing…" blip, then the message lands.
      stickToBottom.current = true;
      setThreadThinking(id, true);
      scheduleScroll();
      await afterthoughtWait(700 + decision.message.length * 12 + Math.random() * 400);
      if (stop()) {
        setThreadThinking(id, false);
        return;
      }
      setThreadThinking(id, false);
      await wait(220);

      appendMessage(id, {
        id: crypto.randomUUID(),
        role: "ai",
        text: decision.message,
        continuation: true,
      });
      scheduleScroll();
    }
  };

  const handleSend = async (text: string) => {
    // The user is back — drop any pending autonomous follow-up from last turn.
    cancelAfterthoughts(false);
    const currentReply = replyTo;

    // First send from `/`: create the thread, rebind this instance to it, and
    // move the URL. The streaming loop below writes to the store with the
    // captured `id`, so the route remount cannot interrupt or orphan it.
    let id = activeId;
    if (!id) {
      const thread = createThread(text);
      id = thread.id;
      setCreatedId(thread.id);
      void navigate({ to: "/c/$threadId", params: { threadId: thread.id } });
    }

    const history = getMessages(id);
    const wasEmpty = history.length === 0;
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      replyTo: currentReply ?? undefined,
      createdAt: Date.now(),
    };

    stickToBottom.current = true;
    appendMessage(id, userMsg);
    setReplyTo(null);
    setThreadThinking(id, true);
    scheduleScroll(true);

    const responseStartedAt = performance.now();
    const result = await ai.generateReplyParts({
      message: text,
      history: history
        .filter((m) => !(m.role === "ai" && isFallbackReplyText(m.text)))
        .slice(-8)
        .map(toAiHistory),
      replyTo: currentReply,
      personalization: personalization.current,
      timeContext: buildTimeContext([...history, userMsg]),
    });
    const responseWaitMs = performance.now() - responseStartedAt;
    const replyParts = result.parts.filter(Boolean);

    if (replyParts.length === 0) {
      setThreadThinking(id, false);
      return;
    }

    const shouldAvoidReplyContext = replyParts.some(isFallbackReplyText);
    const areviasReplyTo = shouldAvoidReplyContext
      ? undefined
      : chooseAreviasReplyTarget(history, userMsg);

    for (let i = 0; i < replyParts.length; i++) {
      const part = replyParts[i];

      if (i > 0) {
        setThreadThinking(id, true);
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

      setThreadThinking(id, false);
      await wait(220);

      appendMessage(id, {
        id: crypto.randomUUID(),
        role: "ai",
        text: part,
        continuation: i > 0,
        replyTo: i === 0 ? areviasReplyTo : undefined,
      });
      scheduleScroll();

      await wait(900 + Math.random() * 400);
    }

    // Hit the daily cap — the message just delivered was Arevias's in-character
    // send-off / log-in nudge. Soft-block further input and skip follow-ups.
    if (result.limited) {
      setBlocked(result.reason ?? "signoff");
      return;
    }

    // Reply delivered — let Arevias consider a spontaneous follow-up. Skipped
    // for fallback replies (nothing real to build on). Not awaited, so the
    // input frees up immediately.
    if (!shouldAvoidReplyContext) {
      void runAfterthoughts(id);
    }
  };

  return (
    <div className="arevias-app-shell fixed inset-0 overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 radial-glow" />
      <main className="arevias-main relative z-10 flex h-[100dvh] overflow-hidden flex-col">
        <AnimatePresence mode="wait">
          {empty ? (
            <motion.section
              key="hero"
              ref={heroSectionRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className={`arevias-hero-section relative flex-1 ${
                loaded ? "is-loaded" : ""
              }`}
            >
              <div className="flex flex-col">
                <div className="arevias-hero-stage relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-6">
                  <div aria-hidden className="arevias-hero-vignette" />
                  <div className="arevias-hero-composition relative z-10 w-full mx-auto">
                    <div className="arevias-intro-headline arevias-hero-logo-frame pointer-events-none">
                      <AmbientLogo width={540} />
                    </div>
                    <div className="arevias-intro-cta arevias-hero-input-frame relative">
                      <ChatInput
                        onSend={handleSend}
                        onTyping={() => cancelAfterthoughts(true)}
                        disableEntranceMotion
                      />
                    </div>
                  </div>
                </div>
                {threadId === null && (
                  <LandingReveal containerRef={heroSectionRef} />
                )}
                {threadId === null && <Footer className="relative z-10" />}
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
                <div role="log" aria-live="polite" className="arevias-conversation-inner max-w-3xl mx-auto py-10 space-y-8 md:space-y-6 pb-[220px]">
                  {messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const tightToPrev = prev && prev.role === m.role && !m.replyTo;

                    return (
                      <div key={m.id} className={tightToPrev ? "-mt-5 md:-mt-2" : ""}>
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
                  <div aria-hidden className="h-px w-full" />
                </div>
              </div>

              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-32"
                style={{
                  background:
                    "linear-gradient(to bottom, var(--color-background) 30%, color-mix(in oklab, var(--color-background) 70%, transparent) 70%, transparent)",
                }}
              />

              <div
                aria-hidden
                className="arevias-conversation-fade-bottom pointer-events-none absolute inset-x-0 bottom-0"
              />

              <div className="arevias-input-dock absolute inset-x-0 bottom-0 z-10 px-6 md:px-14 pb-8 pt-4">
                <div className="arevias-input-shell relative w-full max-w-2xl mx-auto">
                  {blocked === "signup" ? (
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/login" })}
                      className="w-full rounded-full border border-border bg-card/60 px-5 py-3.5 text-center text-sm font-medium text-foreground backdrop-blur-xl transition-colors hover:bg-card/80"
                    >
                      Log in to keep talking →
                    </button>
                  ) : blocked === "signoff" ? (
                    <div className="w-full rounded-full border border-border bg-card/40 px-5 py-3.5 text-center text-sm text-muted-foreground backdrop-blur-xl">
                      You've reached today's limit — come back tomorrow.
                    </div>
                  ) : (
                    <div className="relative">
                      <ChatInput
                        onSend={handleSend}
                        onTyping={() => cancelAfterthoughts(true)}
                        disabled={thinking}
                        replyTo={replyTo}
                        onCancelReply={() => setReplyTo(null)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
