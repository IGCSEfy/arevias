import React, { useState, useRef, useEffect } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import { ArrowUpRight, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- Types ---------- */

interface TeamMember {
  id: string;
  name: string;
  role: string;
  /** Optional — when omitted, the hover/accordion image is skipped for that row. */
  image?: string;
  /** Optional — makes the row a clickable external link (opens in a new tab). */
  link?: string;
}

interface KineticTeamHybridProps {
  /** The people to show. Defaults to the demo roster. */
  members?: TeamMember[];
  /** Big headline. Pass `null` to hide it and show only the eyebrow label. */
  title?: React.ReactNode;
  /** Small label on the right of the header — text, or an element such as a logo. */
  eyebrow?: React.ReactNode;
  /** Standalone full-screen section (default) vs. embedded between other sections. */
  fullScreen?: boolean;
  className?: string;
}

/* ---------- Main Component ---------- */

export default function KineticTeamHybrid({
  members = [],
  title = null,
  eyebrow,
  fullScreen = true,
  className,
}: KineticTeamHybridProps = {}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse position resources (global for the floating card)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth physics for the floating card
  const springConfig = { damping: 20, stiffness: 150, mass: 0.5 };
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);

  // Detect mobile for conditional rendering logic
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile) return;
    // Offset the cursor card so it doesn't block the text
    mouseX.set(e.clientX + 20);
    mouseY.set(e.clientY + 20);
  };

  const hasAnyImage = members.some((m) => m.image);
  const activeImage = members.find((m) => m.id === activeId)?.image;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={cn(
        "relative w-full text-neutral-200",
        fullScreen
          ? "min-h-screen cursor-default bg-neutral-950 px-6 py-24 md:px-12"
          : "px-4 py-20",
        className,
      )}
    >
      {/* Background Ambience (standalone only) */}
      {fullScreen && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.03),transparent_70%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay" />
        </>
      )}

      <div className="mx-auto max-w-6xl">
        {title ? (
          <motion.header
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-20 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
          >
            <div>
              <h1 className="text-4xl font-light tracking-tighter text-white sm:text-6xl md:text-8xl">
                {title}
              </h1>
            </div>
            <div className="mx-8 hidden h-px flex-1 bg-neutral-900 md:block" />
            {eyebrow ? (
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-neutral-500">
                {eyebrow}
              </p>
            ) : null}
          </motion.header>
        ) : eyebrow ? (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10 text-xs font-medium uppercase tracking-[0.3em] text-neutral-500"
          >
            {eyebrow}
          </motion.p>
        ) : null}

        {/* The List */}
        <div className="flex flex-col">
          {members.map((member, index) => (
            <TeamRow
              key={member.id}
              data={member}
              index={index}
              isActive={activeId === member.id}
              setActiveId={setActiveId}
              isMobile={isMobile}
              isAnyActive={activeId !== null}
            />
          ))}
        </div>
      </div>

      {/* DESKTOP ONLY: Global Floating Cursor Image (only when there are photos) */}
      {hasAnyImage && !isMobile && (
        <motion.div
          style={{ x: cursorX, y: cursorY }}
          className="pointer-events-none fixed left-0 top-0 z-50 hidden md:block"
        >
          <AnimatePresence mode="wait">
            {activeId && activeImage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.5, filter: "blur(10px)" }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="relative h-64 w-80 overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl"
              >
                <img
                  src={activeImage}
                  alt="Preview"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                    <span className="text-[10px] uppercase tracking-widest text-white/80">
                      Active
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

/* ---------- Row Component ---------- */

function TeamRow({
  data,
  index,
  isActive,
  setActiveId,
  isMobile,
  isAnyActive,
}: {
  data: TeamMember;
  index: number;
  isActive: boolean;
  setActiveId: (id: string | null) => void;
  isMobile: boolean;
  isAnyActive: boolean;
}) {
  const isDimmed = isAnyActive && !isActive;
  const hasImage = Boolean(data.image);

  const rowClass =
    "relative z-10 flex flex-col py-8 md:flex-row md:items-center md:justify-between md:py-12";
  const rowInner = (
    <>
      {/* Name & Index Section */}
      <div className="flex items-baseline gap-6 pl-4 transition-transform duration-500 group-hover:translate-x-4 md:gap-12 md:pl-0">
        <span className="font-mono text-xs text-neutral-600">0{index + 1}</span>
        <h2 className="text-3xl font-medium tracking-tight text-neutral-400 transition-colors duration-300 group-hover:text-white md:text-6xl">
          {data.name}
        </h2>
      </div>

      {/* Role & Icon Section */}
      <div className="mt-4 flex items-center justify-between pl-12 pr-4 md:mt-0 md:justify-end md:gap-12 md:pl-0 md:pr-0">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-600 transition-colors group-hover:text-neutral-400">
          {data.role}
        </span>

        {/* Mobile affordance: +/- when there's an image, arrow when it's a link */}
        {hasImage ? (
          <div className="block text-neutral-500 md:hidden">
            {isActive ? <Minus size={18} /> : <Plus size={18} />}
          </div>
        ) : data.link ? (
          <div className="block text-white/70 md:hidden">
            <ArrowUpRight size={18} />
          </div>
        ) : null}

        {/* Desktop Arrow */}
        <motion.div
          animate={{ x: isActive ? 0 : -10, opacity: isActive ? 1 : 0 }}
          className="hidden text-white md:block"
        >
          <ArrowUpRight size={28} strokeWidth={1.5} />
        </motion.div>
      </div>
    </>
  );

  return (
    <motion.div
      layout // enables smooth height animation on mobile
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: isDimmed ? 0.3 : 1,
        y: 0,
        backgroundColor:
          isActive && isMobile && hasImage
            ? "rgba(255,255,255,0.03)"
            : "transparent",
      }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      onMouseEnter={() => !isMobile && setActiveId(data.id)}
      onMouseLeave={() => !isMobile && setActiveId(null)}
      onClick={() => isMobile && hasImage && setActiveId(isActive ? null : data.id)}
      className={cn(
        "group relative border-t border-neutral-900 transition-colors duration-500 last:border-b",
        isMobile && hasImage ? "cursor-pointer" : "cursor-default",
      )}
    >
      {data.link ? (
        <a
          href={data.link}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(rowClass, "cursor-pointer")}
        >
          {rowInner}
        </a>
      ) : (
        <div className={rowClass}>{rowInner}</div>
      )}

      {/* MOBILE ONLY: Inline Accordion Image */}
      <AnimatePresence>
        {isMobile && isActive && data.image && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden bg-neutral-900/50"
          >
            <div className="p-4">
              <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                <img
                  src={data.image}
                  alt={data.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <p className="text-xs uppercase tracking-widest text-white">
                    View Profile
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
