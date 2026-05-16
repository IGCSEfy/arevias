import { motion } from "framer-motion";

export function ThinkingDots() {
  return (
    <div className="flex items-center gap-2">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-foreground/70"
          animate={{ opacity: [0.15, 0.9, 0.15] }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: [0.4, 0, 0.6, 1],
            delay: i * 0.28,
          }}
        />
      ))}
    </div>
  );
}
