import type { ComponentType, MouseEvent } from "react";
import { SiTiktok, SiX } from "react-icons/si";
import { FaDiscord } from "react-icons/fa";
import { Instagram, Linkedin, Mail } from "lucide-react";
import { useAnimate } from "framer-motion";

// Both lucide-react and react-icons icons accept a `className`, so this common
// shape lets us pass either kind through `Icon`.
type IconComponent = ComponentType<{ className?: string }>;

interface LinkBoxProps {
  Icon?: IconComponent;
  href: string;
  imgSrc?: string;
  className?: string;
}

export const ClipPathLinks = () => {
  return (
    <div className="divide-y border divide-border border-border">
      <div className="grid grid-cols-3 divide-x divide-border">
        <LinkBox Icon={Mail} href="mailto:contact@arevias.com" />
        <LinkBox Icon={SiX} href="https://x.com/AreviasAI" />
        <LinkBox Icon={Instagram} href="https://www.instagram.com/arevias.ai?igsh=MW44bXE1enk1dWdxMw==" />
      </div>
      <div className="grid grid-cols-3 divide-x divide-border">
        <LinkBox Icon={Linkedin} href="https://www.linkedin.com/company/arevias" />
        <LinkBox Icon={SiTiktok} href="https://www.tiktok.com/@arevias.ai?_r=1&_t=ZS-979F5PoJyOj" />
        <LinkBox Icon={FaDiscord} href="https://discord.gg/K9MUVwCb" />
      </div>
    </div>
  );
};

const NO_CLIP = "polygon(0 0, 100% 0, 100% 100%, 0% 100%)";
const BOTTOM_RIGHT_CLIP = "polygon(0 0, 100% 0, 0 0, 0% 100%)";
const TOP_RIGHT_CLIP = "polygon(0 0, 0 100%, 100% 100%, 0% 100%)";
const BOTTOM_LEFT_CLIP = "polygon(100% 100%, 100% 0, 100% 100%, 0 100%)";
const TOP_LEFT_CLIP = "polygon(0 0, 100% 0, 100% 100%, 100% 0)";

const ENTRANCE_KEYFRAMES: Record<string, string[]> = {
  left: [BOTTOM_RIGHT_CLIP, NO_CLIP],
  bottom: [BOTTOM_RIGHT_CLIP, NO_CLIP],
  top: [BOTTOM_RIGHT_CLIP, NO_CLIP],
  right: [TOP_LEFT_CLIP, NO_CLIP],
};

const EXIT_KEYFRAMES: Record<string, string[]> = {
  left: [NO_CLIP, TOP_RIGHT_CLIP],
  bottom: [NO_CLIP, TOP_RIGHT_CLIP],
  top: [NO_CLIP, TOP_RIGHT_CLIP],
  right: [NO_CLIP, BOTTOM_LEFT_CLIP],
};

const LinkBox = ({ Icon, href, imgSrc, className }: LinkBoxProps) => {
  const [scope, animate] = useAnimate();

  const getNearestSide = (e: MouseEvent<HTMLAnchorElement>) => {
    const box = e.currentTarget.getBoundingClientRect();

    const proximityToLeft = {
      proximity: Math.abs(box.left - e.clientX),
      side: "left",
    };
    const proximityToRight = {
      proximity: Math.abs(box.right - e.clientX),
      side: "right",
    };
    const proximityToTop = {
      proximity: Math.abs(box.top - e.clientY),
      side: "top",
    };
    const proximityToBottom = {
      proximity: Math.abs(box.bottom - e.clientY),
      side: "bottom",
    };

    const sortedProximity = [
      proximityToLeft,
      proximityToRight,
      proximityToTop,
      proximityToBottom,
    ].sort((a, b) => a.proximity - b.proximity);

    return sortedProximity[0].side;
  };

  const handleMouseEnter = (e: MouseEvent<HTMLAnchorElement>) => {
    const side = getNearestSide(e);
    animate(scope.current, {
      clipPath: ENTRANCE_KEYFRAMES[side],
    });
  };

  const handleMouseLeave = (e: MouseEvent<HTMLAnchorElement>) => {
    const side = getNearestSide(e);
    animate(scope.current, {
      clipPath: EXIT_KEYFRAMES[side],
    });
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative grid h-20 w-full place-content-center sm:h-28 md:h-36 text-foreground bg-background"
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt="custom icon"
          className={className ?? "max-h-10 sm:max-h-16 md:max-h-20 object-contain"}
        />
      ) : (
        Icon && <Icon className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10" />
      )}

      <div
        ref={scope}
        style={{ clipPath: BOTTOM_RIGHT_CLIP }}
        className="absolute inset-0 grid place-content-center bg-primary text-primary-foreground transition-colors duration-300"
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt="custom icon hover"
            className={className ?? "max-h-10 sm:max-h-16 md:max-h-20 object-contain"}
          />
        ) : (
          Icon && <Icon className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10" />
        )}
      </div>
    </a>
  );
};
