import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Soft, seamless reveal for the inline auth status line (errors + notices).
 *
 * The box grows `0 → auto` height while the text fades in and a slight blur
 * clears — one continuous motion, so the button below glides rather than jumps.
 * The bottom spacing lives *inside* the animated height (the `pb-3` on the
 * inner text), and callers place this directly above the button with no flex
 * gap between them, so there's no instant gap-jump to stutter the reveal.
 *
 * `error` takes precedence over `notice`; swapping between them animates out
 * then in (`mode="wait"`). Keyed on the text so a changed message replays.
 */
export function AuthMessage({
  error,
  notice,
}: {
  error?: string | null;
  notice?: string | null;
}) {
  const active = error
    ? { text: error, tone: "error" as const }
    : notice
      ? { text: notice, tone: "notice" as const }
      : null;

  return (
    <AnimatePresence initial={false} mode="wait">
      {active && (
        <motion.div
          key={`${active.tone}:${active.text}`}
          initial={{ opacity: 0, height: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
          exit={{ opacity: 0, height: 0, filter: "blur(4px)" }}
          transition={{
            height: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
            opacity: { duration: 0.5, ease: "easeOut" },
            filter: { duration: 0.32, ease: "easeOut" },
          }}
          className="overflow-hidden"
        >
          <p
            className={cn(
              "pb-3 text-center text-sm",
              active.tone === "error" ? "text-red-400" : "text-emerald-400",
            )}
          >
            {active.text}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
