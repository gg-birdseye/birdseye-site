"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from "react";
import {
  containedMediaRect,
  type ContainedMediaRect,
} from "@/lib/aerial-map-geometry";
import {
  arcClipIsReady,
  buildClippedCirclePath,
  buildHoleGraphicPlayableMaskFromUrl,
  pinToMediaPx,
  resolveArcAllowTest,
  sortMarkersByYards,
  yardageArcsAreReady,
  yardageMarkerRadiusPx,
  type HoleGraphicPlayableMask,
  type YardageArcsData,
} from "@/lib/yardage-arcs";

type YardageArcOverlayProps = {
  contentRef: RefObject<HTMLElement | null>;
  /** Hole graphic URL (proxy or CDN) — used to fetch the server playable mask. */
  graphicSrc?: string | null;
  yardageArcs?: YardageArcsData | null;
  visible?: boolean;
};

function readImageDimensions(
  img: HTMLImageElement,
): { width: number; height: number } | null {
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    return { width: img.naturalWidth, height: img.naturalHeight };
  }
  // viewBox-only SVGs can report 0×0; fall back so arcs still layout.
  return { width: 480, height: 1080 };
}

function findHoleGraphicImage(
  container: HTMLElement | null,
): HTMLImageElement | null {
  return (
    container?.querySelector<HTMLImageElement>(
      ".course-hole-graphic-panel-media",
    ) ?? null
  );
}

export function YardageArcOverlay({
  contentRef,
  graphicSrc,
  yardageArcs,
  visible = true,
}: YardageArcOverlayProps) {
  const [mediaRect, setMediaRect] = useState<ContainedMediaRect | null>(null);
  const [playableMask, setPlayableMask] =
    useState<HoleGraphicPlayableMask | null>(null);
  const ready = yardageArcsAreReady(yardageArcs);
  const hasCustomClip = ready && arcClipIsReady(yardageArcs.arcClip);

  const markers = useMemo(
    () => (ready ? sortMarkersByYards(yardageArcs.markers) : []),
    [ready, yardageArcs],
  );

  const updateMediaRect = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;

    const img = findHoleGraphicImage(container);
    if (!img) return;

    const containerRect = container.getBoundingClientRect();
    const dimensions = readImageDimensions(img);
    if (!dimensions) return;

    setMediaRect(
      containedMediaRect(
        containerRect.width,
        containerRect.height,
        dimensions.width,
        dimensions.height,
      ),
    );
  }, [contentRef]);

  // Layout: track the hole graphic box.
  useEffect(() => {
    if (!ready) {
      setMediaRect(null);
      return;
    }

    updateMediaRect();
    window.addEventListener("resize", updateMediaRect);

    const container = contentRef.current;
    const img = findHoleGraphicImage(container);
    const onImageLoad = () => updateMediaRect();

    if (img) {
      img.addEventListener("load", onImageLoad);
      if (img.complete) onImageLoad();
    }

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && container
        ? new ResizeObserver(() => updateMediaRect())
        : null;
    if (container) resizeObserver?.observe(container);

    return () => {
      window.removeEventListener("resize", updateMediaRect);
      img?.removeEventListener("load", onImageLoad);
      resizeObserver?.disconnect();
    };
  }, [contentRef, ready, updateMediaRect, yardageArcs, graphicSrc]);

  // Mask: fetch from server API using the graphic URL prop (not DOM img state).
  useEffect(() => {
    if (!ready || hasCustomClip) {
      setPlayableMask(null);
      return;
    }

    const src = graphicSrc?.trim();
    if (!src) {
      setPlayableMask(null);
      return;
    }

    let cancelled = false;
    setPlayableMask(null);

    void buildHoleGraphicPlayableMaskFromUrl(src).then((mask) => {
      if (!cancelled) setPlayableMask(mask);
    });

    return () => {
      cancelled = true;
    };
  }, [ready, hasCustomClip, graphicSrc]);

  const arcPaths = useMemo(() => {
    if (!ready || !mediaRect) return [];
    const pin = yardageArcs.pin;
    const center = pinToMediaPx(pin, mediaRect.width, mediaRect.height);
    const isAllowed = resolveArcAllowTest(
      yardageArcs.arcClip,
      playableMask,
      mediaRect.width,
      mediaRect.height,
    );

    return markers.map((marker, index) => {
      const radius = yardageMarkerRadiusPx(
        pin,
        marker,
        mediaRect.width,
        mediaRect.height,
      );
      return {
        key: `${marker.yards}-${index}`,
        pathD: buildClippedCirclePath(center.x, center.y, radius, isAllowed),
        labelX: (marker.x / 100) * mediaRect.width,
        labelY: (marker.y / 100) * mediaRect.height,
        yards: marker.yards,
      };
    });
  }, [markers, mediaRect, playableMask, ready, yardageArcs]);

  if (!visible || !ready || !mediaRect) return null;

  const pin = yardageArcs.pin;
  const center = pinToMediaPx(pin, mediaRect.width, mediaRect.height);

  return (
    <div className="course-hole-graphic-yardage-overlay" aria-hidden>
      <div
        className="course-hole-graphic-yardage-layer"
        style={{
          left: `${mediaRect.left}px`,
          top: `${mediaRect.top}px`,
          width: `${mediaRect.width}px`,
          height: `${mediaRect.height}px`,
        }}
      >
        <svg
          className="course-hole-graphic-yardage-svg"
          width={mediaRect.width}
          height={mediaRect.height}
          viewBox={`0 0 ${mediaRect.width} ${mediaRect.height}`}
        >
          {arcPaths.map((arc) =>
            arc.pathD ? (
              <path
                key={arc.key}
                d={arc.pathD}
                className="course-hole-graphic-yardage-arc"
                fill="none"
              />
            ) : null,
          )}
        </svg>

        <svg
          className="course-hole-graphic-yardage-labels"
          width={mediaRect.width}
          height={mediaRect.height}
          viewBox={`0 0 ${mediaRect.width} ${mediaRect.height}`}
        >
          {arcPaths.map((arc) => (
            <g key={`label-${arc.key}`}>
              <rect
                x={arc.labelX - 20}
                y={arc.labelY - 24}
                width={40}
                height={18}
                rx={4}
                className="course-hole-graphic-yardage-label-bg"
              />
              <text
                x={arc.labelX}
                y={arc.labelY - 11}
                textAnchor="middle"
                className="course-hole-graphic-yardage-label"
              >
                {arc.yards}
              </text>
            </g>
          ))}
          <circle
            cx={center.x}
            cy={center.y}
            r={5}
            className="course-hole-graphic-yardage-pin"
          />
        </svg>
      </div>
    </div>
  );
}
