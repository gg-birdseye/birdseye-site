"use client";

import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  STACK_SLOT_VH,
  STACK_TOGETHER_HOLD_VH,
  stackPinHoldVh,
  SUBHEADING_HOLD_VH,
} from "@/components/ScrollRevealHeadline";
import { STACK_ACCENT, STACK_BG } from "@/lib/stack-gradient";
import { isMobilePortraitLayout, subheadingSlotTopPx } from "@/lib/stack-layout";

type Props = {
  lines: string[];
  className?: string;
  overlapVh?: number;
  holdVh?: number;
  togetherHoldVh?: number;
};

function splitWords(text: string, lineIndex: number) {
  return text.split(/\s+/).filter(Boolean).map((word, wordIndex) => (
    <span
      key={`${lineIndex}-${wordIndex}`}
      className="scroll-reveal-word mr-[0.28em] inline-block overflow-hidden align-top last:mr-0"
    >
      <span className="scroll-reveal-word-inner inline-block will-change-transform">
        {word}
      </span>
    </span>
  ));
}

function unitRevealProgress(
  progress: number,
  index: number,
  count: number,
): number {
  if (count <= 0) return 0;
  const span = 1 / count;
  const start = index * span;
  const end = start + span;
  if (progress >= end) return 1;
  if (progress <= start) return 0;
  return (progress - start) / (end - start);
}

function setWordReveal(words: HTMLElement[], reveal: number) {
  words.forEach((word, index) => {
    const amount = unitRevealProgress(reveal, index, words.length);
    gsap.set(word, {
      yPercent: 110 * (1 - amount),
      opacity: amount,
    });
  });
}

function setOvalReveal(oval: HTMLElement | null, reveal: number) {
  if (!oval) return;
  gsap.set(oval, {
    opacity: reveal,
    scale: 0.94 + reveal * 0.06,
  });
}

/** Share of post-stack scroll used to fade the stack out. */
const STACK_EXIT_OUT = 0.38;
/** Scroll pause after the stack is gone, before launch demo appears. */
const STACK_EXIT_GAP = 0.14;

function postStackProgress(
  headlineProgress: number,
  scrollUpEnd: number,
  buildPhaseRatio: number,
): number {
  const stackComplete =
    scrollUpEnd + (1 - scrollUpEnd) * Math.min(1, buildPhaseRatio);
  if (headlineProgress <= stackComplete) return 0;
  const span = 1 - stackComplete;
  if (span <= 0) return 1;
  return Math.min(1, (headlineProgress - stackComplete) / span);
}

function stackFadeAmount(
  headlineProgress: number,
  scrollUpEnd: number,
  buildPhaseRatio: number,
): number {
  const stackComplete =
    scrollUpEnd + (1 - scrollUpEnd) * Math.min(1, buildPhaseRatio);
  if (headlineProgress <= stackComplete) return 1;
  const t = postStackProgress(headlineProgress, scrollUpEnd, buildPhaseRatio);
  if (t <= STACK_EXIT_OUT) return 1 - t / STACK_EXIT_OUT;
  return 0;
}

function launchDemoFadeAmount(
  headlineProgress: number,
  scrollUpEnd: number,
  buildPhaseRatio: number,
): number {
  const stackComplete =
    scrollUpEnd + (1 - scrollUpEnd) * Math.min(1, buildPhaseRatio);
  if (headlineProgress <= stackComplete) return 0;
  const t = postStackProgress(headlineProgress, scrollUpEnd, buildPhaseRatio);
  const launchStart = STACK_EXIT_OUT + STACK_EXIT_GAP;
  if (t <= launchStart) return 0;
  const launchSpan = 1 - launchStart;
  if (launchSpan <= 0) return 1;
  return Math.min(1, (t - launchStart) / launchSpan);
}

function slotTopPx(index: number, lineCount: number) {
  return subheadingSlotTopPx(index, lineCount);
}

export function ScrollRevealSubheadings({
  lines,
  className = "",
  holdVh = SUBHEADING_HOLD_VH,
  togetherHoldVh = STACK_TOGETHER_HOLD_VH,
  overlapVh = stackPinHoldVh(lines.length, togetherHoldVh, holdVh),
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const solidBackdropRef = useRef<HTMLDivElement>(null);

  const registered = useMemo(() => ({ current: false }), []);
  if (!registered.current) {
    gsap.registerPlugin(ScrollTrigger);
    registered.current = true;
  }

  useEffect(() => {
    const container = containerRef.current;
    const solidBackdrop = solidBackdropRef.current;
    if (!container || !solidBackdrop) return;

    const headlineTrack =
      container.previousElementSibling instanceof HTMLElement &&
      container.previousElementSibling.classList.contains("scroll-reveal-section")
        ? container.previousElementSibling
        : container.parentElement?.querySelector<HTMLElement>(
            ".scroll-reveal-section",
          );
    if (!headlineTrack) return;

    const headlineSticky =
      headlineTrack.querySelector<HTMLElement>(":scope > div");
    const stackFooter = container.parentElement?.querySelector<HTMLElement>(
      "[data-stack-fade]",
    );
    const launchDemo = document.querySelector<HTMLElement>("[data-launch-demo]");
    const contactSection = document.getElementById("contact");

    const scrollUpEnd = Number(headlineTrack.dataset.scrollUpEnd);
    const revealEnd = Number(headlineTrack.dataset.revealEnd);
    if (Number.isNaN(scrollUpEnd) || Number.isNaN(revealEnd)) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const rows = lines.map((_, lineIndex) => {
      const row = container.querySelector<HTMLElement>(
        `[data-reveal-line="${lineIndex}"]`,
      );
      const oval = row?.querySelector<HTMLElement>(".scroll-reveal-oval") ?? null;
      const words = row
        ? gsap.utils.toArray<HTMLElement>(".scroll-reveal-word-inner", row)
        : [];
      return { row, oval, words };
    });

    const buildPhaseRatio =
      overlapVh > 0 ? (lines.length * holdVh) / overlapVh : 1;
    const segmentSize =
      lines.length > 0 ? buildPhaseRatio / lines.length : buildPhaseRatio;
    const revealPortion = 0.38;

    const syncLaunchDemoLift = (progress: number) => {
      if (!launchDemo || reducedMotion) return;
      const lift = progress * window.innerHeight * 0.3;
      gsap.set(launchDemo, { y: -lift });
    };

    const resetLaunchDemoLift = () => {
      if (!launchDemo) return;
      gsap.set(launchDemo, { y: 0 });
    };

    const setSolidBackdropVisible = (visible: boolean) => {
      gsap.set(solidBackdrop, {
        autoAlpha: visible ? 1 : 0,
        backgroundColor: STACK_BG,
      });
    };

    const equalizePortraitOvalHeights = () => {
      const ovals = rows
        .map(({ oval }) => oval)
        .filter((oval): oval is HTMLElement => oval != null);

      ovals.forEach((oval) => {
        oval.style.minHeight = "";
      });

      if (!isMobilePortraitLayout() || ovals.length === 0) return;

      // Measure unscaled content height so mid-animation scale doesn't skew the max.
      let maxHeight = 0;
      ovals.forEach((oval) => {
        const prev = oval.style.transform;
        oval.style.transform = "none";
        maxHeight = Math.max(maxHeight, oval.getBoundingClientRect().height);
        oval.style.transform = prev;
      });

      if (maxHeight <= 0) return;
      const next = `${Math.ceil(maxHeight)}px`;
      ovals.forEach((oval) => {
        oval.style.minHeight = next;
      });
    };

    const syncRowPosition = (
      row: HTMLElement | null,
      top: number,
      visible: boolean,
    ) => {
      if (!row) return;
      gsap.set(row, {
        autoAlpha: visible ? 1 : 0,
        top,
        opacity: visible ? undefined : 1,
        pointerEvents: "none",
      });
    };

    const applyStackFade = (headlineProgress: number) => {
      const stackFade = stackFadeAmount(
        headlineProgress,
        scrollUpEnd,
        buildPhaseRatio,
      );
      const launchFade = launchDemoFadeAmount(
        headlineProgress,
        scrollUpEnd,
        buildPhaseRatio,
      );

      if (headlineSticky) {
        gsap.set(headlineSticky, { opacity: stackFade });
      }
      if (stackFooter) {
        gsap.set(stackFooter, { opacity: stackFade });
      }
      if (headlineProgress >= revealEnd) {
        gsap.set(solidBackdrop, {
          autoAlpha: stackFade > 0 ? 1 : 0,
          opacity: stackFade,
        });
      }
      rows.forEach(({ row }) => {
        if (!row) return;
        const rowVisible = gsap.getProperty(row, "autoAlpha") === 1;
        if (rowVisible) {
          gsap.set(row, { opacity: stackFade });
        }
        if (stackFade <= 0) {
          gsap.set(row, { autoAlpha: 0, pointerEvents: "none" });
        }
      });

      const stackComplete =
        scrollUpEnd + (1 - scrollUpEnd) * Math.min(1, buildPhaseRatio);
      if (launchDemo) {
        gsap.set(launchDemo, {
          autoAlpha: headlineProgress > stackComplete ? launchFade : 0,
        });
      }

      return stackFade;
    };

    const sync = (headlineProgress: number) => {
      if (reducedMotion) {
        rows.forEach(({ row, oval, words }, index) => {
          syncRowPosition(row, slotTopPx(index, lines.length), true);
          setWordReveal(words, 1);
          setOvalReveal(oval, 1);
        });
        setSolidBackdropVisible(headlineProgress >= revealEnd);
        applyStackFade(headlineProgress);
        return;
      }

      if (headlineProgress < revealEnd) {
        rows.forEach(({ row, oval, words }) => {
          syncRowPosition(row, window.innerHeight, false);
          gsap.set(words, { yPercent: 110, opacity: 0 });
          setOvalReveal(oval, 0);
        });
        setSolidBackdropVisible(false);
        if (headlineSticky) gsap.set(headlineSticky, { opacity: 1 });
        if (stackFooter) gsap.set(stackFooter, { opacity: 1 });
        if (launchDemo) gsap.set(launchDemo, { autoAlpha: 0, y: 0 });
        return;
      }

      setSolidBackdropVisible(true);

      const pinSpan = 1 - scrollUpEnd;
      const pinProgress =
        pinSpan > 0
          ? Math.min(1, (headlineProgress - scrollUpEnd) / pinSpan)
          : 1;

      rows.forEach(({ row, oval, words }, index) => {
        if (!row) return;

        const segStart = index * segmentSize;
        const segEnd = segStart + segmentSize;
        const targetTop = slotTopPx(index, lines.length);
        const isLast = index === lines.length - 1;
        const isPortrait = isMobilePortraitLayout();
        // Portrait: slide every pill up from the bottom of the screen.
        // Desktop: earlier pills ease in from mid-viewport; the last from bottom.
        const useStandardReveal = !isLast && !isPortrait;
        const rowRevealPortion = isPortrait
          ? 0.42
          : useStandardReveal
            ? revealPortion
            : 0.55;
        const rowMoveStart = isPortrait
          ? 0
          : useStandardReveal
            ? revealPortion * 0.45
            : 0;
        const rowStartTop = isPortrait
          ? window.innerHeight
          : useStandardReveal
            ? window.innerHeight * 0.67
            : window.innerHeight;

        if (pinProgress <= segStart) {
          syncRowPosition(row, window.innerHeight, false);
          gsap.set(words, { yPercent: 110, opacity: 0 });
          setOvalReveal(oval, 0);
          return;
        }

        if (pinProgress >= segEnd) {
          syncRowPosition(row, targetTop, true);
          setWordReveal(words, 1);
          setOvalReveal(oval, 1);
          return;
        }

        gsap.set(row, { autoAlpha: 1 });

        const local = (pinProgress - segStart) / segmentSize;
        const revealAmount = Math.min(1, local / rowRevealPortion);
        setWordReveal(words, revealAmount);
        setOvalReveal(oval, revealAmount);

        const moveProgress =
          local <= rowMoveStart
            ? 0
            : Math.min(1, (local - rowMoveStart) / (1 - rowMoveStart));
        const nextTop = rowStartTop + (targetTop - rowStartTop) * moveProgress;
        gsap.set(row, { top: nextTop });
      });

      applyStackFade(headlineProgress);
    };

    const hideRows = () => {
      rows.forEach(({ row, oval, words }) => {
        syncRowPosition(row, window.innerHeight, false);
        gsap.set(words, { yPercent: 110, opacity: 0 });
        setOvalReveal(oval, 0);
        if (row) gsap.set(row, { opacity: 1 });
      });
      setSolidBackdropVisible(false);
      if (headlineSticky) gsap.set(headlineSticky, { opacity: 1 });
      if (stackFooter) gsap.set(stackFooter, { opacity: 1 });
      if (launchDemo) gsap.set(launchDemo, { autoAlpha: 1, y: 0 });
    };

    const ctx = gsap.context(() => {
      rows.forEach(({ row, oval, words }) => {
        syncRowPosition(row, window.innerHeight, false);
        gsap.set(words, { yPercent: 110, opacity: 0 });
        setOvalReveal(oval, 0);
      });
      gsap.set(solidBackdrop, { autoAlpha: 0, backgroundColor: STACK_BG });
      if (headlineSticky) gsap.set(headlineSticky, { opacity: 1 });
      if (stackFooter) gsap.set(stackFooter, { opacity: 1 });
      if (launchDemo) gsap.set(launchDemo, { autoAlpha: 0, y: 0 });

      const trigger = ScrollTrigger.create({
        trigger: headlineTrack,
        start: "top 28%",
        end: "bottom bottom",
        onUpdate: (self) => sync(self.progress),
      });

      ScrollTrigger.create({
        trigger: headlineTrack,
        start: "bottom top",
        onEnter: hideRows,
        onLeaveBack: () => sync(trigger.progress),
      });

      if (contactSection && launchDemo) {
        ScrollTrigger.create({
          trigger: contactSection,
          start: "top bottom",
          end: "top 28%",
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => syncLaunchDemoLift(self.progress),
          onLeaveBack: () => {
            resetLaunchDemoLift();
            sync(trigger.progress);
          },
        });
      }

      const headlineTrigger = ScrollTrigger.getById("scroll-reveal-headline");

      requestAnimationFrame(() => {
        equalizePortraitOvalHeights();
        ScrollTrigger.refresh();
        sync(headlineTrigger?.progress ?? trigger.progress);
      });

      // Re-measure once web fonts settle — short vs long lines can wrap differently.
      const fontsReady =
        "fonts" in document
          ? document.fonts.ready.then(() => {
              equalizePortraitOvalHeights();
              ScrollTrigger.refresh();
              sync(trigger.progress);
            })
          : null;
      void fontsReady;

      const onResize = () => {
        equalizePortraitOvalHeights();
        ScrollTrigger.refresh();
        sync(trigger.progress);
      };

      window.addEventListener("resize", onResize);
      equalizePortraitOvalHeights();

      return () => {
        window.removeEventListener("resize", onResize);
      };
    }, container);

    return () => ctx.revert();
  }, [lines, holdVh, togetherHoldVh, overlapVh]);

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto w-full max-w-4xl ${className}`}
      style={{
        marginTop: overlapVh > 0 ? `-${overlapVh}vh` : undefined,
        minHeight: overlapVh > 0 ? `${overlapVh}vh` : undefined,
      }}
    >
      <div
        ref={solidBackdropRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[12]"
      />
      {lines.map((line, lineIndex) => (
        <div
          key={line}
          data-reveal-line={lineIndex}
          className="pointer-events-none fixed inset-x-0 z-20 mx-auto flex h-[25svh] w-full max-w-4xl items-center justify-center px-4 text-center max-[767px]:portrait:h-auto max-[767px]:portrait:min-h-0 max-[940px]:landscape:h-[12svh] max-[940px]:landscape:px-2"
        >
          <div
            className="scroll-reveal-oval inline-flex max-w-full items-center justify-center rounded-[999px] px-8 py-3.5 md:px-12 md:py-5 max-[767px]:portrait:min-h-[4.25rem] max-[767px]:portrait:w-full max-[767px]:portrait:max-w-[22rem] max-[940px]:landscape:px-5 max-[940px]:landscape:py-2"
            style={{ backgroundColor: STACK_ACCENT, color: STACK_BG }}
          >
            <p className="leading-tight tracking-tight max-[767px]:portrait:text-balance">
              {splitWords(line, lineIndex)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
