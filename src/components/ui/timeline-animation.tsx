"use client";

import { motion, useInView, type Variants } from "framer-motion";
import React, { type ElementType } from "react";

interface TimelineContentProps {
  children: React.ReactNode;
  /** Index used as framer-motion `custom`, so variants can stagger by position. */
  animationNum: number;
  /** Ref to the scroll container that gates the in-view reveal. */
  timelineRef: React.RefObject<HTMLElement | null>;
  /** Override the default blur-fade-up variants. */
  customVariants?: Variants;
  className?: string;
  /** Element/tag to render (e.g. "h1", "span", "button"). Defaults to "div". */
  as?: ElementType;
  /** Animate only the first time it enters the viewport. */
  once?: boolean;
  /** Extra props forwarded to the underlying motion element. */
  [key: string]: unknown;
}

const defaultVariants: Variants = {
  hidden: { filter: "blur(10px)", y: 0, opacity: 0 },
  visible: (i: number) => ({
    filter: "blur(0px)",
    y: 0,
    opacity: 1,
    transition: { delay: i * 0.4, duration: 0.5 },
  }),
};

export function TimelineContent({
  children,
  animationNum,
  timelineRef,
  customVariants,
  className,
  as,
  once = false,
  ...props
}: TimelineContentProps) {
  const variants = customVariants ?? defaultVariants;
  const isInView = useInView(timelineRef, { once });
  const MotionComponent = motion[(as ?? "div") as keyof typeof motion] as typeof motion.div;

  return (
    <MotionComponent
      custom={animationNum}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
      className={className}
      {...props}
    >
      {children}
    </MotionComponent>
  );
}
