import logo from "@/assets/arevias-logo.png";

const LOGO_ASPECT = 600 / 339;

export function AmbientLogo({
  width = 520,
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
      <img
        src={logo}
        alt=""
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          opacity: 1,
          filter: "brightness(0) invert(1)",
        }}
        className="absolute inset-0 select-none"
      />
    </div>
  );
}
