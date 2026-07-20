"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ScrollRevealHeadline,
  STACK_SLOT_VH,
  stackPinHoldVh,
  STACK_TOGETHER_HOLD_VH,
} from "@/components/ScrollRevealHeadline";
import { ScrollRevealSubheadings } from "@/components/ScrollRevealSubheadings";
import { SCROLLY_VIDEO_FADE_START } from "@/lib/scrolly-video";
const MOCKUP_GRADIENT_TOP = "#02aab0";
const MOCKUP_GRADIENT_BOTTOM = "#00cdac";
const MOCKUP_BACKGROUND = `linear-gradient(to bottom, ${MOCKUP_GRADIENT_TOP}, ${MOCKUP_GRADIENT_BOTTOM})`;
/** Gradient extends above the section so the top edge stays off-screen during fade-in. */
const MOCKUP_TOP_EXTENSION = "100svh";
const MOCKUP_SECTION_LIFT = "100svh";

function fadeT(progress: number): number {
  if (progress < SCROLLY_VIDEO_FADE_START) return 0;
  return Math.min(
    1,
    (progress - SCROLLY_VIDEO_FADE_START) / (1 - SCROLLY_VIDEO_FADE_START),
  );
}

const SUBHEADING_LINES = [
  "Interactive Data & Content",
  "Marketing & Promotion",
  "Practical Utility for Players",
];

export function HomeClientsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const mockupWrapRef = useRef<HTMLDivElement>(null);
  const bgOverlayRef = useRef<HTMLDivElement>(null);

  const registered = useMemo(() => ({ current: false }), []);
  if (!registered.current) {
    gsap.registerPlugin(ScrollTrigger);
    registered.current = true;
  }

  useEffect(() => {
    const track = document.querySelector<HTMLElement>("[data-scrolly-track]");
    const mockupWrap = mockupWrapRef.current;
    const bgOverlay = bgOverlayRef.current;
    if (!track || !mockupWrap || !bgOverlay) return;

    const sync = (progress: number) => {
      const t = fadeT(progress);
      const handoff = t >= 1;

      gsap.set(bgOverlay, {
        position: "fixed",
        top: `calc(-1 * ${MOCKUP_TOP_EXTENSION})`,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: handoff ? 0 : t,
      });

      // Only reveal the mockup block once the fade completes — avoids a visible top edge mid-transition.
      gsap.set(mockupWrap, {
        autoAlpha: handoff ? 1 : 0,
      });
    };

    gsap.set(mockupWrap, { autoAlpha: 0 });
    gsap.set(bgOverlay, { opacity: 0 });

    const trigger = ScrollTrigger.create({
      trigger: track,
      start: "top top",
      end: "bottom bottom",
      invalidateOnRefresh: true,
      onUpdate: (self) => sync(self.progress),
    });

    sync(trigger.progress);

    const onResize = () => ScrollTrigger.refresh();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      trigger.kill();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="clients"
      className="relative z-[15] -mt-[100svh] scroll-mt-24"
    >
      <div
        ref={bgOverlayRef}
        className="pointer-events-none z-[14]"
        style={{ background: MOCKUP_BACKGROUND }}
        aria-hidden
      />

      <div
        ref={mockupWrapRef}
        className="relative z-[15] w-full"
        style={{ marginTop: `calc(-1 * ${MOCKUP_SECTION_LIFT})` }}
      >
        <div className="relative" style={{ background: MOCKUP_BACKGROUND }}>
          <div
            className="absolute bottom-full left-0 right-0"
            style={{
              height: MOCKUP_TOP_EXTENSION,
              backgroundColor: MOCKUP_GRADIENT_TOP,
            }}
            aria-hidden
          />
          <div
            className="flex min-h-[52svh] items-center justify-center px-4 pb-[300px] pt-[800px] sm:min-h-[58svh] md:min-h-[62svh] md:px-8"
          >
            <div className="relative mx-auto w-full max-w-5xl">
              <a
                href="/courses/example-course"
                className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
                aria-label="Check it out — view example course"
              >
                <Image
                  src="/screens-mockup1.png"
                  alt="Birdseye course preview on desktop and mobile screens"
                  width={1200}
                  height={800}
                  className="mx-auto h-auto w-full cursor-pointer object-contain drop-shadow-[0_24px_48px_rgba(0,0,0,0.18)] transition-opacity hover:opacity-95"
                  priority
                />
              </a>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <a
                  href="/courses/example-course"
                  className="pointer-events-auto inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold text-stone-100 backdrop-blur-sm transition hover:border-white/35 hover:bg-white/10"
                >
                  Check it out
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-[15] bg-[var(--surface-elevated)]">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-12 md:px-6 md:pt-16">
        <ScrollRevealHeadline
          line1="Give site visitors what they want"
          line2="A versatile tool to showcase your course"
          className="text-6xl font-bold leading-[1.08] tracking-tight text-white md:text-7xl lg:text-8xl"
          pinHoldVh={stackPinHoldVh(SUBHEADING_LINES.length)}
        />

        <ScrollRevealSubheadings
          lines={SUBHEADING_LINES}
          holdVh={STACK_SLOT_VH}
          togetherHoldVh={STACK_TOGETHER_HOLD_VH}
          className="text-2xl font-semibold md:text-3xl lg:text-[2.25rem]"
        />

        </div>
      </div>
    </section>
  );
}
