"use client";

import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Section index 1 = top edge, then clockwise through 6. */
export type HexagonSection = 1 | 2 | 3 | 4 | 5 | 6;

export type HexagonVariant = "standard" | "alternating";

const DRAW_ORDERS: Record<HexagonVariant, HexagonSection[]> = {
  /** Sections 1 → 2 → 3 → 4 */
  standard: [1, 2, 3, 4],
  /** Sections 1 → 6 → 5 → 4 */
  alternating: [1, 6, 5, 4],
};

/** Flat-top hexagon edge paths (viewBox 0 0 100 86). */
const SECTION_PATHS: Record<HexagonSection, string> = {
  1: "M20 25 L80 25",
  2: "M80 25 L95 50",
  3: "M95 50 L80 75",
  4: "M80 75 L20 75",
  5: "M20 75 L5 50",
  6: "M5 50 L20 25",
};

type Props = {
  variant: HexagonVariant;
  className?: string;
  /** When true, skip draw animation and show final sides immediately. */
  static?: boolean;
};

function pathLength(el: SVGPathElement): number {
  if (typeof el.getTotalLength === "function") {
    return el.getTotalLength();
  }
  return 60;
}

export function AnimatedHexagon({
  variant,
  className = "",
  static: staticRender = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drawOrder = DRAW_ORDERS[variant];

  const registered = useMemo(() => ({ current: false }), []);
  if (!registered.current) {
    gsap.registerPlugin(ScrollTrigger);
    registered.current = true;
  }

  useEffect(() => {
    if (staticRender) return;
    const svg = svgRef.current;
    if (!svg) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const sections = drawOrder
      .map((n) => svg.querySelector<SVGPathElement>(`[data-section="${n}"]`))
      .filter(Boolean) as SVGPathElement[];

    const hiddenSections = ([1, 2, 3, 4, 5, 6] as HexagonSection[])
      .filter((n) => !drawOrder.includes(n))
      .map((n) => svg.querySelector<SVGPathElement>(`[data-section="${n}"]`))
      .filter(Boolean) as SVGPathElement[];

    hiddenSections.forEach((path) => {
      gsap.set(path, { opacity: 0 });
    });

    sections.forEach((path) => {
      const len = pathLength(path);
      gsap.set(path, {
        strokeDasharray: len,
        strokeDashoffset: len,
        opacity: 1,
      });
    });

    const reveal = () => {
      if (prefersReducedMotion) {
        sections.forEach((path) => gsap.set(path, { strokeDashoffset: 0 }));
        return;
      }
      const tl = gsap.timeline();
      sections.forEach((path) => {
        tl.to(path, {
          strokeDashoffset: 0,
          duration: 0.45,
          ease: "power2.out",
        });
      });
    };

    const trigger = ScrollTrigger.create({
      trigger: svg,
      start: "top 88%",
      once: true,
      onEnter: reveal,
    });

    if (trigger.progress === 1) {
      reveal();
    }

    return () => {
      trigger.kill();
    };
  }, [variant, staticRender]);

  useEffect(() => {
    if (!staticRender) return;
    const svg = svgRef.current;
    if (!svg) return;
    drawOrder.forEach((n) => {
      const path = svg.querySelector<SVGPathElement>(`[data-section="${n}"]`);
      if (path) gsap.set(path, { strokeDashoffset: 0, opacity: 1 });
    });
    ([1, 2, 3, 4, 5, 6] as HexagonSection[])
      .filter((n) => !drawOrder.includes(n))
      .forEach((n) => {
        const path = svg.querySelector<SVGPathElement>(`[data-section="${n}"]`);
        if (path) gsap.set(path, { opacity: 0 });
      });
  }, [variant, staticRender]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 86"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`h-28 w-28 text-white md:h-36 md:w-36 ${className}`.trim()}
      aria-hidden
      data-hexagon={variant}
      data-draw-order={drawOrder.join(",")}
    >
      {([1, 2, 3, 4, 5, 6] as HexagonSection[]).map((section) => (
        <path
          key={section}
          data-section={section}
          d={SECTION_PATHS[section]}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
