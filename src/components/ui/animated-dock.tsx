"use client"

import * as React from "react"
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  MotionValue,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

import { cn } from "@/lib/utils";

export interface AnimatedDockProps {
  className?: string;
  items: DockItemData[];
}

export interface DockItemData {
  link: string;
  Icon: React.ReactNode;
  target?: string;
}

// The cursor-proximity magnify only makes sense with a fine pointer that can
// hover. On touch devices `onMouseMove` can latch `mouseX` to a tap position
// with no `onMouseLeave` to release it, leaving icons stuck enlarged — so we
// disable magnification entirely there and render fixed-size items.
function useHasFineHover() {
  const [fineHover, setFineHover] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setFineHover(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return fineHover;
}

export const AnimatedDock = ({ className, items }: AnimatedDockProps) => {
  const mouseX = useMotionValue(Infinity);
  const magnify = useHasFineHover();

  return (
    <motion.div
      onMouseMove={magnify ? (e) => mouseX.set(e.pageX) : undefined}
      onMouseLeave={magnify ? () => mouseX.set(Infinity) : undefined}
      className={cn(
        "mx-auto flex h-16 items-end gap-4 rounded-2xl bg-secondary/50 border border-primary/10 shadow-md px-4 pb-3",
        className,
      )}
    >
      {items.map((item, index) => {
        const linkClass =
          "grow flex items-center justify-center w-full h-full text-primary-foreground";
        return (
          <DockItem key={index} mouseX={mouseX} magnify={magnify}>
            {item.target ? (
              // External / new-tab links keep a plain anchor.
              <a
                href={item.link}
                target={item.target}
                rel="noopener noreferrer"
                className={linkClass}
              >
                {item.Icon}
              </a>
            ) : (
              // Internal links navigate client-side so the app shell (and this
              // dock) never reloads — no avatar flash, no remount.
              <Link to={item.link} className={linkClass}>
                {item.Icon}
              </Link>
            )}
          </DockItem>
        );
      })}
    </motion.div>
  );
};

interface DockItemProps {
  mouseX: MotionValue<number>;
  children: React.ReactNode;
  magnify: boolean;
}

export const DockItem = ({ mouseX, children, magnify }: DockItemProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
  const width = useSpring(widthSync, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  const iconScale = useTransform(width, [40, 80], [1, 1.5]);
  const iconSpring = useSpring(iconScale, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  // Touch / no-hover: a plain fixed-size icon, no proximity magnification.
  // Pin the size with inline px (applies immediately, independent of class /
  // media-query timing) and flexShrink:0 so the item can never balloon — on
  // iOS the `w-10` class momentarily dropped during the route transition,
  // letting the inner flex item expand to fill the bar (the large/centered
  // flash when opening the profile page).
  if (!magnify) {
    return (
      <div
        style={{ width: 40, height: 40, flexShrink: 0, flexGrow: 0 }}
        className="aspect-square rounded-full bg-primary text-secondary-foreground flex items-center justify-center"
      >
        <div className="flex items-center justify-center w-full h-full">
          {children}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      style={{ width }}
      className="aspect-square w-10 rounded-full bg-primary text-secondary-foreground flex items-center justify-center"
    >
      <motion.div
        style={{ scale: iconSpring }}
        className="flex items-center justify-center w-full h-full grow"
      >
        {children}
      </motion.div>
    </motion.div>
  );
};
