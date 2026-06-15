// Custom nav icons (Noun Project glyphs — attribution stripped, recolored to
// `currentColor` so they inherit the dock's icon color, normalized to a square
// viewBox at the same render size as the lucide icons in the dock).

type IconProps = { size?: number };

// Changelog — clock with a counter-clockwise "history" arrow. (by Noe Araujo)
export function ChangelogIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M15,14v2h3.9c-1.4,2.4-4,4-6.9,4c-4.4,0-8-3.6-8-8s3.6-8,8-8c2.3,0,4.3,0.9,5.8,2.5l1.4-1.4C17.4,3.2,14.8,2,12,2C6.5,2,2,6.5,2,12s4.5,10,10,10c3.3,0,6.2-1.6,8-4v3h2v-7H15z M11,11.6l-2.7,2.7l1.4,1.4l3.3-3.3V7h-2V11.6z" />
    </svg>
  );
}

// Profile — head + shoulders. (by Sofia Espino-Yaeger)
export function ProfileIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-150 300 196 196"
      fill="currentColor"
      stroke="currentColor"
      strokeMiterlimit={10}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeWidth={9}
        d="M-9.3,360.1c0,25-20.3,45.3-45.3,45.3s-45.4-20.3-45.4-45.3s20.3-45.3,45.3-45.3S-9.3,335.1-9.3,360.1z"
      />
      <path
        strokeWidth={9}
        strokeLinecap="round"
        d="M29.4,479.8h-168.1c0,0-8.4-33.7,18.7-47.8c5.8-3,12.3-4.2,18.8-4.2h93.1c6.5,0,13,1.2,18.8,4.2C37.8,446.1,29.4,479.8,29.4,479.8z"
      />
    </svg>
  );
}

// About — lowercase "i" in a circle. (by Arkinasi)
export function AboutIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="m50 94.793c-24.707 0-44.793-20.082-44.793-44.793 0-24.707 20.086-44.793 44.793-44.793s44.793 20.082 44.793 44.793c0 24.707-20.082 44.793-44.793 44.793zm0-83.336c-21.25 0-38.543 17.293-38.543 38.543s17.293 38.543 38.543 38.543 38.543-17.293 38.543-38.543-17.293-38.543-38.543-38.543zm0 11.793c-2.293 0-4.168 1.875-4.168 4.168s1.875 4.168 4.168 4.168 4.168-1.875 4.168-4.168-1.875-4.168-4.168-4.168zm9.375 51.75c0-1.707-1.418-3.125-3.125-3.125h-3.625c-0.41797 0-0.66797-0.20703-0.79297-0.33203s-0.29297-0.41797-0.25-0.83203l3-23.875c0.25-2.043-0.375-4.125-1.707-5.668-1.332-1.582-3.293-2.5-5.375-2.5l-3.707-0.082031c-1.625 0-3.168 1.332-3.168 3.082 0 1.707 1.332 3.168 3.082 3.168l3.707 0.082031c0.41797 0 0.66797 0.20703 0.75 0.375 0.125 0.125 0.29297 0.41797 0.25 0.79297l-3 23.875c-0.25 2.082 0.375 4.168 1.75 5.75 1.375 1.582 3.375 2.457 5.457 2.457h3.625c1.707 0 3.125-1.418 3.125-3.125z" />
    </svg>
  );
}
