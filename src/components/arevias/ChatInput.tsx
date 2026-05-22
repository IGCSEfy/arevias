import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ElementType, JSX, KeyboardEvent } from "react";

export type ReplyTarget = { id: string; role: "user" | "ai"; text: string };

const placeholders = [
  "Ask Arevias anything",
  "Start with a thought",
  "Describe an idea",
  "What are you building?",
];

export function ChatInput({
  onSend,
  disabled,
  replyTo,
  onCancelReply,
  disableEntranceMotion,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  replyTo?: ReplyTarget | null;
  onCancelReply?: () => void;
  disableEntranceMotion?: boolean;
}): JSX.Element {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const hasValue = value.trim().length > 0;

  useEffect(() => {
    const id = setInterval(
      () => setPhIdx((i) => (i + 1) % placeholders.length),
      4200,
    );
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${Math.min(ref.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const submit = () => {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const Root = (disableEntranceMotion ? "div" : motion.div) as ElementType;
  const rootMotionProps = disableEntranceMotion
    ? {}
    : {
        layout: true,
        initial: { opacity: 0, y: 24 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
      };

  return (
    <Root
      {...rootMotionProps}
      data-arevias-chat-input
      className="w-full max-w-2xl mx-auto"
      style={{ maxWidth: "var(--arevias-input-max-w, 42rem)" }}
    >
      <div className="relative">
        <AnimatePresence>
          {replyTo && (
            <motion.div
              key="reply-preview"
              data-arevias-reply-preview
              initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{
                opacity: 0,
                y: 12,
                filter: "blur(6px)",
                transition: { duration: 0.45, ease: [0.64, 0, 0.78, 0] },
              }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="absolute left-1/2 -translate-x-1/2 z-0"
              style={{ bottom: "calc(100% - 14px)", width: "94%" }}
            >
              <div
                className="relative backdrop-blur-xl"
                style={{
                  borderRadius: 14,
                  border:
                    "1px solid color-mix(in oklab, var(--color-foreground) 7%, transparent)",
                  background:
                    "radial-gradient(ellipse at center, color-mix(in oklab, var(--color-card) 60%, black 40%) 0%, color-mix(in oklab, var(--color-card) 74%, black 26%) 100%)",
                  boxShadow:
                    "inset 0 1px 0 color-mix(in oklab, var(--color-foreground) 4%, transparent), 0 18px 50px -40px color-mix(in oklab, var(--color-foreground) 22%, transparent)",
                }}
              >
                <div className="flex items-center gap-3 pl-6 pr-4 pt-2 pb-3">
                  <div
                    aria-hidden
                    className="shrink-0 self-stretch w-px my-1"
                    style={{
                      background:
                        "color-mix(in oklab, var(--color-foreground) 22%, transparent)",
                    }}
                  />
                  <div className="flex-1 min-w-0 -translate-y-0.5">
                    <div className="font-mono text-[8px] uppercase tracking-[0.28em] leading-[1.25] text-muted-foreground/75 mb-1">
                      replying to {replyTo.role === "user" ? "you" : "arevias"}
                    </div>
                    <div className="truncate text-[11.5px] leading-[1.35] font-light text-foreground/55 italic">
                      {replyTo.text}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onCancelReply}
                    aria-label="Cancel reply"
                    className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-foreground/40 hover:text-foreground/80 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          data-arevias-input-pill
          animate={{
            borderColor: focused
              ? "var(--arevias-input-border-focused, color-mix(in oklab, var(--color-foreground) 14%, transparent))"
              : "var(--arevias-input-border, color-mix(in oklab, var(--color-foreground) 7%, transparent))",
            boxShadow: focused
              ? "var(--arevias-input-shadow-focused, inset 0 1px 0 color-mix(in oklab, var(--color-foreground) 5%, transparent), inset 0 0 30px color-mix(in oklab, var(--color-foreground) 4%, transparent), 0 50px 120px -40px color-mix(in oklab, var(--color-foreground) 28%, transparent))"
              : "var(--arevias-input-shadow, inset 0 1px 0 color-mix(in oklab, var(--color-foreground) 4%, transparent), 0 24px 70px -50px color-mix(in oklab, var(--color-foreground) 22%, transparent))",
          }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 rounded-full border backdrop-blur-xl overflow-hidden"
          style={{
            borderWidth: "var(--arevias-input-border-width, 1px)",
            background:
              "var(--arevias-input-bg, radial-gradient(ellipse at center, color-mix(in oklab, var(--color-card) 70%, black 30%) 0%, color-mix(in oklab, var(--color-card) 80%, black 20%) 100%))",
          }}
        >
          <motion.div
            aria-hidden
            animate={{ opacity: focused || hasValue ? 1 : 0 }}
            transition={{ duration: 0.8 }}
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(ellipse 60% 100% at 50% 50%, color-mix(in oklab, var(--color-foreground) 5%, transparent), transparent 70%)",
            }}
          />
          <div
            className="relative flex items-center gap-3"
            style={{
              padding:
                "var(--arevias-input-padding, 0.375rem 0.5rem 0.375rem 1.75rem)",
            }}
          >
            <div
              className="flex-1 relative flex items-center min-h-[44px]"
              style={{ minHeight: "var(--arevias-input-min-h, 44px)" }}
            >
              <textarea
                ref={ref}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={onKeyDown}
                rows={1}
                aria-label="Message"
                className="w-full resize-none bg-transparent outline-none text-foreground text-[15px] md:text-base font-light leading-[1.4] tracking-[-0.005em] placeholder:text-transparent py-0 my-auto block"
                style={{
                  display: "block",
                  fontSize: "var(--arevias-input-font-size)",
                  color: "var(--arevias-input-text-color)",
                }}
              />
              {!value && (
                <div className="absolute inset-0 pointer-events-none flex items-center">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={phIdx}
                      initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      className="text-muted-foreground/70 text-[15px] md:text-base font-light tracking-[-0.005em]"
                      style={{
                        color:
                          "var(--arevias-placeholder-color, color-mix(in oklab, var(--color-foreground) 34%, transparent))",
                        fontSize: "var(--arevias-placeholder-size, inherit)",
                        fontWeight: "var(--arevias-placeholder-weight, 300)",
                      }}
                    >
                      {placeholders[phIdx]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              )}
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              animate={{
                backgroundColor: hasValue
                  ? "var(--arevias-send-active-bg, color-mix(in oklab, var(--color-foreground) 92%, transparent))"
                  : "var(--arevias-send-empty-bg, color-mix(in oklab, var(--color-foreground) 14%, transparent))",
              }}
              transition={{ duration: 0.4 }}
              onClick={submit}
              disabled={!hasValue || disabled}
              aria-label="Send"
              className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-background disabled:cursor-not-allowed"
              style={{
                width: "var(--arevias-send-size, 2.25rem)",
                height: "var(--arevias-send-size, 2.25rem)",
                opacity: hasValue
                  ? "var(--arevias-send-active-opacity, 1)"
                  : "var(--arevias-send-empty-opacity, 0.35)",
                color: "var(--arevias-send-icon-color, var(--color-background))",
                boxShadow: "var(--arevias-send-shadow, none)",
                transition: "opacity 0.4s ease",
              }}
            >
              <ArrowUp
                className="h-[14px] w-[14px]"
                strokeWidth={1.8}
                style={{
                  width: "var(--arevias-send-icon-size, 14px)",
                  height: "var(--arevias-send-icon-size, 14px)",
                }}
              />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </Root>
  );
}
