import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function CursorGlow() {
  const [pos, setPos] = useState({ x: -500, y: -500 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <motion.div
      className="pointer-events-none fixed z-10 h-[520px] w-[520px] rounded-full"
      animate={{ x: pos.x - 260, y: pos.y - 260 }}
      transition={{ type: "spring", stiffness: 60, damping: 22, mass: 1.2 }}
      style={{
        background:
          "radial-gradient(circle, color-mix(in oklab, var(--color-foreground) 8%, transparent) 0%, transparent 60%)",
        mixBlendMode: "screen",
      }}
    />
  );
}
