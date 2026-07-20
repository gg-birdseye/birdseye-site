"use client";

import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { measureHeadlineStickTopPx } from "@/lib/stack-layout";

type Props = {
  line1: string;
  line2: string;
  className?: string;
  /** Extra scroll distance while line 2 stays pinned (vh). */
  pinHoldVh?: number;
  /** Headline + subheading rows in the stack (default 4). */
  stackQuarters?: number;
};

const TRACK_VIEWPORTS_BASE = 1.25;
/** Scroll while line 2 moves from center to the top of the viewport. */
const SCROLL_UP_VH = 45;
/** Each stack row occupies one quarter of the viewport. */
export const STACK_SLOT_VH = 25;
/** Scroll distance per subheading while the stack builds (vh). */
export const SUBHEADING_HOLD_VH = STACK_SLOT_VH;
/** Extra scroll while the full stack stays pinned together (vh). */
export const STACK_TOGETHER_HOLD_VH = 95;

export function stackPinHoldVh(
  subheadingCount: number,
  togetherHoldVh = STACK_TOGETHER_HOLD_VH,
  slotVh = STACK_SLOT_VH,
) {
  return subheadingCount * slotVh + togetherHoldVh;
}

const REVEAL1_END_RAW = 0.3;
const HOLD1_END_RAW = 0.42;
const FADE1_END_RAW = 0.5;

function buildPhaseTiming(line1Length: number, line2Length: number) {
  const line2RevealDuration =
    line1Length > 0
      ? REVEAL1_END_RAW * (line2Length / line1Length)
      : REVEAL1_END_RAW;
  const animationEnd = FADE1_END_RAW + line2RevealDuration;
  const scale = 1 / animationEnd;

  return {
    trackViewports: TRACK_VIEWPORTS_BASE * animationEnd,
    reveal1End: REVEAL1_END_RAW * scale,
    hold1End: HOLD1_END_RAW * scale,
    fade1End: FADE1_END_RAW * scale,
    reveal2End: 1,
  };
}

function revealCharCount(text: string) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .reduce((sum, word) => sum + word.length, 0);
}

function splitLetters(text: string, line: "1" | "2") {
  const words = text.split(/\s+/).filter(Boolean);

  return words.map((word, wordIndex) => (
    <span
      key={`${line}-word-${wordIndex}`}
      className="scroll-reveal-word mr-[0.28em] inline-block whitespace-nowrap align-top last:mr-0"
    >
      {Array.from(word).map((char, charIndex) => (
        <span
          key={`${line}-word-${wordIndex}-char-${charIndex}`}
          className="scroll-reveal-char inline-block"
        >
          {char}
        </span>
      ))}
    </span>
  ));
}

function unitRevealProgress(
  progress: number,
  index: number,
  count: number,
  phaseStart: number,
  phaseEnd: number,
): number {
  if (count <= 0) return 0;
  const span = (phaseEnd - phaseStart) / count;
  const start = phaseStart + index * span;
  const end = start + span;
  if (progress >= end) return 1;
  if (progress <= start) return 0;
  return (progress - start) / (end - start);
}

function lineFadeOut(
  progress: number,
  holdEnd: number,
  fadeEnd: number,
): number {
  if (progress <= holdEnd) return 1;
  if (progress >= fadeEnd) return 0;
  return 1 - (progress - holdEnd) / (fadeEnd - holdEnd);
}

export function ScrollRevealHeadline({
  line1,
  line2,
  className = "",
  pinHoldVh = SUBHEADING_HOLD_VH,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const line1WrapRef = useRef<HTMLDivElement>(null);
  const line2WrapRef = useRef<HTMLDivElement>(null);

  const revealTrackVh =
    buildPhaseTiming(revealCharCount(line1), revealCharCount(line2))
      .trackViewports * 100;
  const totalTrackVh = revealTrackVh + SCROLL_UP_VH + pinHoldVh;
  const revealEnd = revealTrackVh / totalTrackVh;
  const scrollUpEnd = (revealTrackVh + SCROLL_UP_VH) / totalTrackVh;

  const registered = useMemo(() => ({ current: false }), []);
  if (!registered.current) {
    gsap.registerPlugin(ScrollTrigger);
    registered.current = true;
  }

  useEffect(() => {
    const track = trackRef.current;
    const sticky = stickyRef.current;
    const line1Wrap = line1WrapRef.current;
    const line2Wrap = line2WrapRef.current;
    if (!track || !sticky || !line1Wrap || !line2Wrap) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const ctx = gsap.context(() => {
      const chars1 = gsap.utils.toArray<HTMLElement>(
        '[data-scroll-reveal-line="1"] .scroll-reveal-char',
        line1Wrap,
      );
      const chars2 = gsap.utils.toArray<HTMLElement>(
        '[data-scroll-reveal-line="2"] .scroll-reveal-char',
        line2Wrap,
      );

      if (chars1.length === 0 && chars2.length === 0) return;

      const positionLineCenter = () => {
        gsap.set([line1Wrap, line2Wrap], {
          top: "50%",
          yPercent: -50,
          y: 0,
        });
      };

      const positionLineAtTop = (progress: number) => {
        const viewportHeight = window.innerHeight;
        const line2Height = line2Wrap.offsetHeight || 0;
        const viewportCenter = viewportHeight * 0.5;
        const centeredTop = viewportCenter - line2Height / 2;
        const topTarget = measureHeadlineStickTopPx();

        const nextTop = centeredTop + (topTarget - centeredTop) * progress;

        gsap.set(line2Wrap, {
          top: nextTop,
          yPercent: 0,
          y: 0,
        });
      };

      if (reducedMotion) {
        line1Wrap.style.display = "none";
        gsap.set(chars2, { opacity: 1 });
        positionLineAtTop(1);
        return;
      }

      gsap.set(chars1, { opacity: 0 });
      gsap.set(chars2, { opacity: 0 });
      positionLineCenter();

      const { reveal1End, hold1End, fade1End, reveal2End } = buildPhaseTiming(
        chars1.length,
        chars2.length,
      );

      const sync = (rawProgress: number) => {
        let animProgress = 1;
        if (rawProgress <= revealEnd) {
          animProgress = rawProgress / revealEnd;
        }

        const fade1 = lineFadeOut(animProgress, hold1End, fade1End);

        chars1.forEach((char, index) => {
          const reveal = unitRevealProgress(
            animProgress,
            index,
            chars1.length,
            0,
            reveal1End,
          );
          gsap.set(char, { opacity: reveal * fade1 });
        });

        chars2.forEach((char, index) => {
          const reveal = unitRevealProgress(
            animProgress,
            index,
            chars2.length,
            fade1End,
            reveal2End,
          );
          gsap.set(char, { opacity: reveal });
        });

        line1Wrap.style.visibility = animProgress >= fade1End ? "hidden" : "visible";

        if (rawProgress <= revealEnd) {
          positionLineCenter();
          return;
        }

        if (rawProgress >= scrollUpEnd) {
          positionLineAtTop(1);
          return;
        }

        const scrollUpProgress =
          (rawProgress - revealEnd) / (scrollUpEnd - revealEnd);
        positionLineAtTop(scrollUpProgress);
      };

      const trigger = ScrollTrigger.create({
        id: "scroll-reveal-headline",
        trigger: track,
        start: "top 28%",
        end: "bottom bottom",
        scrub: 0.25,
        invalidateOnRefresh: true,
        onUpdate: (self) => sync(self.progress),
      });

      sync(trigger.progress);

      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        sync(trigger.progress);
      });
    }, track);

    const onResize = () => ScrollTrigger.refresh();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      ctx.revert();
    };
  }, [line1, line2, pinHoldVh, revealEnd, scrollUpEnd]);

  return (
    <div
      ref={trackRef}
      className="scroll-reveal-section relative"
      style={{ height: `${totalTrackVh}vh` }}
      data-scroll-up-end={scrollUpEnd}
      data-reveal-end={revealEnd}
    >
      <div
        ref={stickyRef}
        className="pointer-events-none sticky top-0 z-30 h-[100svh] w-full overflow-visible"
        aria-label={`${line1}. ${line2}`}
      >
        <div
          ref={line1WrapRef}
          className={`pointer-events-none absolute inset-x-0 z-20 mx-auto w-full max-w-6xl px-4 text-center md:px-6 ${className}`}
        >
          <span data-scroll-reveal-line="1" className="block">
            {splitLetters(line1, "1")}
          </span>
        </div>
        <div
          ref={line2WrapRef}
          className={`pointer-events-none absolute inset-x-0 z-20 mx-auto w-full max-w-6xl px-4 text-center md:px-6 ${className}`}
          aria-hidden={false}
        >
          <span data-scroll-reveal-line="2" className="block">
            {splitLetters(line2, "2")}
          </span>
        </div>
      </div>
    </div>
  );
}
