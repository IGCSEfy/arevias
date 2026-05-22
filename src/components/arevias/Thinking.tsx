export function ThinkingDots() {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2">
      <span className="sr-only">Arevias is thinking</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="arevias-thinking-dot block h-1.5 w-1.5 rounded-full bg-foreground/70"
          style={{ animationDelay: `${i * 0.28}s` }}
        />
      ))}
    </div>
  );
}
