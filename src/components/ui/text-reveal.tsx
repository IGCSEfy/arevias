"use client";

import { FC, ReactNode, RefObject, useEffect, useRef } from "react";
import { motion, MotionValue, useMotionValue, useTransform } from "framer-motion";

import { cn } from "@/lib/utils";

interface TextRevealByWordProps {
  text: string;
  className?: string;
  /**
   * Scroll container to track when the page itself doesn't scroll (e.g. an
   * inner `overflow-y: auto` element). Omit to track the window.
   */
  containerRef?: RefObject<HTMLElement | null>;
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

const TextRevealByWord: FC<TextRevealByWordProps> = ({
  text,
  className,
  containerRef,
}) => {
  const targetRef = useRef<HTMLDivElement | null>(null);
  // Reveal progress 0→1, driven manually so it works inside a custom scroll
  // container (framer's `useScroll({ container })` doesn't bind reliably when
  // the document itself is scroll-locked).
  const progress = useMotionValue(0);

  useEffect(() => {
    // Find the nearest scrollable ancestor ourselves rather than trusting a
    // passed ref to be populated at effect time (framer attaches motion refs
    // late). Falls back to the window when nothing scrolls.
    const findScroller = (node: HTMLElement | null): HTMLElement | null => {
      let p = node?.parentElement ?? null;
      while (p) {
        const oy = getComputedStyle(p).overflowY;
        if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) {
          return p;
        }
        p = p.parentElement;
      }
      return null;
    };

    const container =
      containerRef?.current ?? findScroller(targetRef.current);
    const scroller: HTMLElement | Window = container ?? window;

    const update = () => {
      const target = targetRef.current;
      if (!target) return;

      if (container) {
        const denom = target.offsetHeight - container.clientHeight;
        if (denom <= 0) {
          progress.set(0);
          return;
        }
        // Measure the target's top relative to the container viewport — robust
        // to whatever positioned ancestor sits between them. progress 0 when the
        // target's top reaches the container top, 1 when its bottom reaches the
        // container bottom.
        const offset =
          target.getBoundingClientRect().top -
          container.getBoundingClientRect().top;
        progress.set(clamp(-offset / denom));
      } else {
        const rect = target.getBoundingClientRect();
        const denom = rect.height - window.innerHeight;
        if (denom <= 0) {
          progress.set(0);
          return;
        }
        progress.set(clamp(-rect.top / denom));
      }
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      scroller.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [containerRef, progress]);

  const words = text.split(" ");

  return (
    <div ref={targetRef} className={cn("relative z-0 h-[200vh]", className)}>
      <div className="sticky top-0 mx-auto flex h-[50%] max-w-4xl items-center bg-transparent px-[1rem] py-[5rem]">
        <p className="flex flex-wrap p-5 text-2xl font-bold text-black/20 dark:text-white/20 md:p-8 md:text-3xl lg:p-10 lg:text-4xl xl:text-5xl">
          {words.map((word, i) => {
            const start = i / words.length;
            const end = start + 1 / words.length;
            return (
              <Word key={i} progress={progress} range={[start, end]}>
                {word}
              </Word>
            );
          })}
        </p>
      </div>
    </div>
  );
};

interface WordProps {
  children: ReactNode;
  progress: MotionValue<number>;
  range: [number, number];
}

const Word: FC<WordProps> = ({ children, progress, range }) => {
  const opacity = useTransform(progress, range, [0, 1]);
  return (
    <span className="xl:lg-3 relative mx-1 lg:mx-2.5">
      <span className="absolute opacity-30">{children}</span>
      <motion.span
        style={{ opacity: opacity }}
        className="text-black dark:text-white"
      >
        {children}
      </motion.span>
    </span>
  );
};

export { TextRevealByWord };
