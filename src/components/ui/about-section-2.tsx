"use client";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { useRef } from "react";

export default function AboutSection2() {
  const heroRef = useRef<HTMLDivElement>(null);
  const revealVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        delay: i * 1.5,
        duration: 0.7,
      },
    }),
    hidden: {
      filter: "blur(10px)",
      y: 40,
      opacity: 0,
    },
  };
  const textVariants = {
    visible: (i: number) => ({
      filter: "blur(0px)",
      opacity: 1,
      transition: {
        delay: i * 0.3,
        duration: 0.7,
      },
    }),
    hidden: {
      filter: "blur(10px)",
      opacity: 0,
    },
  };
  return (
    <section className="pt-32 pb-10 px-4 bg-black">
      <div className="max-w-6xl mx-auto" ref={heroRef}>
        <div className="flex flex-col lg:flex-row items-start gap-8">
          {/* Right side - Content */}
          <div className="flex-1">
            <TimelineContent
              as="h1"
              animationNum={0}
              timelineRef={heroRef}
              customVariants={revealVariants}
              className="sm:text-4xl text-2xl md:text-5xl !leading-[110%] font-semibold text-white mb-8"
            >
              We are{" "}
              <TimelineContent
                as="span"
                animationNum={1}
                timelineRef={heroRef}
                customVariants={textVariants}
                className="text-blue-400 border-2 border-blue-500 inline-block xl:h-16  border-dotted px-2 rounded-md"
              >
                rethinking
              </TimelineContent>{" "}
              what it means to talk to a machine, building AI that feels less
              like a tool and more like someone who actually gets you. Our goal
              is to continually raise the bar and{" "}
              <TimelineContent
                as="span"
                animationNum={2}
                timelineRef={heroRef}
                customVariants={textVariants}
                className="text-orange-400 border-2 border-orange-500 inline-block xl:h-16 border-dotted px-2 rounded-md"
              >
                challenge
              </TimelineContent>{" "}
              how things could{" "}
              <TimelineContent
                as="span"
                animationNum={3}
                timelineRef={heroRef}
                customVariants={textVariants}
                className="text-green-400 border-2 border-green-500 inline-block xl:h-16 border-dotted px-2 rounded-md"
              >
                work for you.
              </TimelineContent>
            </TimelineContent>

          </div>
        </div>
      </div>
    </section>
  );
}
