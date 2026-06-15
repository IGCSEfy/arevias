import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Swaps a button's label for an animated three-dot loader while `busy`.
 *
 * The handoff is a crossfade-with-pop: the outgoing content scales down + blurs
 * out, the incoming scales up + blurs in (`mode="wait"`, so it's a clean in/out
 * rather than an overlap). While shown, the dots keep a looping staggered
 * bounce so the button reads as actively working. Colour is inherited
 * (`bg-current`) so it adapts to whatever button variant it sits in.
 */
export function ButtonBusyLabel({ busy, children }: { busy: boolean; children: ReactNode }) {
  const swap = {
    initial: { opacity: 0, scale: 0.7, filter: "blur(4px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.7, filter: "blur(4px)" },
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {busy ? (
        <motion.span key="dots" {...swap} className="inline-flex items-center gap-1" aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="inline-block h-1.5 w-1.5 rounded-full bg-current"
              animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut", delay: i * 0.13 }}
            />
          ))}
        </motion.span>
      ) : (
        <motion.span key="label" {...swap}>
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
