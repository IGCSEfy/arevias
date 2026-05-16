import { motion } from "framer-motion";
import logo from "@/assets/arevias-logo.png";

const LOGO_ASPECT = 600 / 339;

export function AmbientLogo({
  width = 520,
  opacity = 0.18,
}: {
  width?: number;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none relative"
      style={{
        width: `min(76vw, ${width}px)`,
        aspectRatio: LOGO_ASPECT,
      }}
    >
      <motion.div
        initial={{ opacity: 0.24 }}
        animate={{ opacity: [0.18, 0.28, 0.18] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: "-20% -12% -6%",
          background:
            "radial-gradient(ellipse 46% 48% at 50% 54%, color-mix(in oklab, var(--color-foreground) 5%, transparent) 0%, color-mix(in oklab, var(--color-foreground) 1.4%, transparent) 42%, transparent 72%)",
          filter: "blur(10px)",
        }}
      />
      <motion.img
        src={logo}
        alt=""
        draggable={false}
        initial={{ opacity: opacity * 0.9, scale: 1 }}
        animate={{
          opacity: [opacity * 0.9, opacity, opacity * 0.9],
          scale: [1, 1.005, 1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: "100%",
          height: "100%",
          filter:
            "saturate(0) brightness(0.6) drop-shadow(0 0 8px color-mix(in oklab, var(--color-foreground) 7%, transparent))",
          WebkitMaskImage:
            "radial-gradient(ellipse 88% 86% at 50% 52%, black 45%, color-mix(in oklab, black 84%, transparent) 82%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 88% 86% at 50% 52%, black 45%, color-mix(in oklab, black 84%, transparent) 82%, transparent 100%)",
        }}
        className="absolute inset-0 select-none"
      />
    </div>
  );
}
