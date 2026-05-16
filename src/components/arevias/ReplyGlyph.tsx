type GlyphProps = { className?: string; size?: number; strokeWidth?: number };

export function ReplyIcon({
  className,
  size = 14,
  strokeWidth = 1.3,
}: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6.25 4.25 3 7.5l3.25 3.25" />
      <path d="M3 7.5h6.25a3.25 3.25 0 0 1 0 6.5H8.5" />
    </svg>
  );
}

export function RepliedIcon({
  className,
  size = 14,
  strokeWidth = 1.25,
}: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.5 4v4.25a2.25 2.25 0 0 1-2.25 2.25H4" />
      <path d="M6.5 8.25 4 10.5l2.5 2.25" />
    </svg>
  );
}

export const ReplyGlyph = RepliedIcon;
