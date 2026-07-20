"use client";

import Link from "next/link";
import gsap from "gsap";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import styles from "./LaunchDemoButton.module.css";

const RING_DRAW_DURATION = 0.55;
const RING_RADIUS = 46;
const RING_CENTER = 50;

/** Clockwise ring from the top (12 o'clock). */
const RING_PATH = `M ${RING_CENTER} ${RING_CENTER - RING_RADIUS} A ${RING_RADIUS} ${RING_RADIUS} 0 1 1 ${RING_CENTER - 0.001} ${RING_CENTER - RING_RADIUS}`;

export function LaunchDemoButton() {
  const drawRef = useRef<SVGPathElement>(null);
  const [hovered, setHovered] = useState(false);
  const [cycle, setCycle] = useState(0);

  const activate = useCallback(() => {
    setHovered(true);
    setCycle((count) => count + 1);
  }, []);

  const deactivate = useCallback(() => {
    setHovered(false);
  }, []);

  useLayoutEffect(() => {
    const draw = drawRef.current;
    if (!draw) return;

    gsap.killTweensOf(draw);

    if (!hovered) {
      gsap.set(draw, {
        autoAlpha: 0,
        attr: { "stroke-dashoffset": draw.getTotalLength() },
      });
      return;
    }

    const length = draw.getTotalLength();
    gsap.set(draw, {
      autoAlpha: 1,
      attr: {
        "stroke-dasharray": length,
        "stroke-dashoffset": length,
      },
    });
    gsap.to(draw, {
      attr: { "stroke-dashoffset": 0 },
      duration: RING_DRAW_DURATION,
      ease: "power2.inOut",
      overwrite: true,
    });
  }, [hovered, cycle]);

  return (
    <Link
      href="/courses/example-course"
      className={`${styles.root} ${hovered ? styles.hovered : ""}`}
      aria-label="Preview course"
      onPointerEnter={activate}
      onPointerLeave={deactivate}
      onFocus={activate}
      onBlur={deactivate}
    >
      <svg aria-hidden className={styles.ring} viewBox="0 0 100 100">
        <circle
          className={styles.track}
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={1.5}
        />
        <path
          ref={drawRef}
          className={styles.draw}
          d={RING_PATH}
          fill="none"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
      <span className={`${styles.label} ${hovered ? styles.labelExpanded : ""}`}>
        <span className={styles.labelLine}>Preview</span>
        <span className={styles.labelLine}>Course</span>
      </span>
    </Link>
  );
}
