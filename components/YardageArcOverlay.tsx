"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import {
  containedMediaRect,
  type ContainedMediaRect,
} from "@/lib/aerial-map-geometry";
import {
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
import type { YardageArcRender } from "@/lib/sanity/courses";

type YardageArcOverlayProps = {
  contentRef: RefObject<HTMLElement | null>;
  graphicSrc?: string | null;
  graphicCdnSrc?: string | null;
  yardageArcs?: YardageArcsData | null;
  /** Server-precomputed clipped paths (used when pathD values look valid). */
  yardageArcRender?: YardageArcRender | null;
  visible?: boolean;
};

function readImageDimensions(
  img: HTMLImageElement,
): { width: number; height: number } {
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    return { width: img.naturalWidth, height: img.naturalHeight };
  }
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

/** Reject Flight refs / empty junk that sometimes leak into client props. */
function isUsableSvgPath(pathD: string | null | undefined): boolean {
  if (!pathD || typeof pathD !== "string") return false;
  const trimmed = pathD.trim();
  if (trimmed.length < 8) return false;
  if (trimmed.startsWith("$")) return false;
  return trimmed.startsWith("M") || trimmed.startsWith("m");
}

function serverRenderIsUsable(
  render: YardageArcRender | null | undefined,
): render is YardageArcRender {
  return Boolean(
    render &&
      render.width > 0 &&
      render.height > 0 &&
      render.paths?.length &&
      render.paths.every((arc) => isUsableSvgPath(arc.pathD)),
  );
}

export function YardageArcOverlay({
  contentRef,
  graphicSrc,
  graphicCdnSrc,
  yardageArcs,
  yardageArcRender,
  visible = true,
}: YardageArcOverlayProps) {
  const [mediaRect, setMediaRect] = useState<ContainedMediaRect | null>(null);
  const [playableMask, setPlayableMask] =
    useState<HoleGraphicPlayableMask | null>(null);
  const ready = yardageArcsAreReady(yardageArcs);
  const usableServerRender = serverRenderIsUsable(yardageArcRender);
  const maskSrc = graphicSrc || graphicCdnSrc || null;

  const markers = useMemo(
    () => (ready ? sortMarkersByYards(yardageArcs.markers) : []),
    [ready, yardageArcs],
  );

  const hasCustomClip = Boolean(
    ready && yardageArcs.arcClip && yardageArcs.arcClip.length >= 3,
  );

  const updateMediaRect = useCallback(() => {
    const container = contentRef.current;
    const img = findHoleGraphicImage(container);
    if (!container || !img) return;

    // Layout sizes stay stable under CSS zoom/pan transforms; client rects don't.
    const dimensions = readImageDimensions(img);
    const fitted = containedMediaRect(
      container.clientWidth,
      container.clientHeight,
      dimensions.width,
      dimensions.height,
    );
    if (!fitted) return;

    setMediaRect(fitted);
  }, [contentRef]);

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
    if (img) resizeObserver?.observe(img);

    return () => {
      window.removeEventListener("resize", updateMediaRect);
      img?.removeEventListener("load", onImageLoad);
      resizeObserver?.disconnect();
    };
  }, [contentRef, ready, updateMediaRect, yardageArcs]);

  // Always load the Sharp playable mask on the client (same-origin API).
  // This matches localhost clipping and avoids depending on huge RSC path strings.
  useEffect(() => {
    if (!ready || hasCustomClip || !maskSrc) {
      setPlayableMask(null);
      return;
    }

    let cancelled = false;
    void buildHoleGraphicPlayableMaskFromUrl(maskSrc).then((mask) => {
      if (!cancelled) setPlayableMask(mask);
    });

    return () => {
      cancelled = true;
    };
  }, [ready, hasCustomClip, maskSrc, yardageArcs]);

  const arcPaths = useMemo(() => {
    if (!mediaRect || !ready) return [];

    const pin = yardageArcs.pin;
    const canClipLocally = hasCustomClip || playableMask != null;

    // Prefer locally clipped paths once the mask (or custom clip) is ready.
    if (canClipLocally) {
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
    }

    // While the mask loads, use server-precomputed paths if they look valid.
    if (usableServerRender) {
      return yardageArcRender.paths.map((arc, index) => ({
        key: `${arc.yards}-${index}`,
        pathD: arc.pathD,
        labelX: arc.labelX,
        labelY: arc.labelY,
        yards: arc.yards,
      }));
    }

    // Last resort: full circles (CSS mask still clips to the hole silhouette).
    const center = pinToMediaPx(pin, mediaRect.width, mediaRect.height);
    return markers.map((marker, index) => {
      const radius = yardageMarkerRadiusPx(
        pin,
        marker,
        mediaRect.width,
        mediaRect.height,
      );
      return {
        key: `${marker.yards}-${index}`,
        pathD: buildClippedCirclePath(center.x, center.y, radius, null),
        labelX: (marker.x / 100) * mediaRect.width,
        labelY: (marker.y / 100) * mediaRect.height,
        yards: marker.yards,
      };
    });
  }, [
    hasCustomClip,
    markers,
    mediaRect,
    playableMask,
    ready,
    usableServerRender,
    yardageArcRender,
    yardageArcs,
  ]);

  if (!visible || !mediaRect || !ready) return null;

  const useServerViewBox = usableServerRender && playableMask == null && !hasCustomClip;
  const viewW = useServerViewBox ? yardageArcRender.width : mediaRect.width;
  const viewH = useServerViewBox ? yardageArcRender.height : mediaRect.height;
  const pinX = useServerViewBox
    ? yardageArcRender.pinX
    : pinToMediaPx(yardageArcs.pin, mediaRect.width, mediaRect.height).x;
  const pinY = useServerViewBox
    ? yardageArcRender.pinY
    : pinToMediaPx(yardageArcs.pin, mediaRect.width, mediaRect.height).y;

  // Clip strokes to the hole graphic's alpha so arcs never paint the dark panel,
  // even if the green mask is late or missing.
  const layerMaskStyle: CSSProperties | undefined = maskSrc
    ? {
        WebkitMaskImage: `url("${maskSrc}")`,
        maskImage: `url("${maskSrc}")`,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        // Prefer alpha so transparent SVG areas fully hide strokes.
        maskMode: "alpha",
      }
    : undefined;

  const layerBoxStyle: CSSProperties = {
    left: `${mediaRect.left}px`,
    top: `${mediaRect.top}px`,
    width: `${mediaRect.width}px`,
    height: `${mediaRect.height}px`,
  };

  return (
    <div className="course-hole-graphic-yardage-overlay" aria-hidden>
      {/* Arcs only — masked to hole graphic alpha so strokes never hit the panel */}
      <div
        className="course-hole-graphic-yardage-layer"
        style={{ ...layerBoxStyle, ...layerMaskStyle }}
      >
        <svg
          className="course-hole-graphic-yardage-svg"
          width={mediaRect.width}
          height={mediaRect.height}
          viewBox={`0 0 ${viewW} ${viewH}`}
          preserveAspectRatio="none"
        >
          {arcPaths.map((arc) =>
            isUsableSvgPath(arc.pathD) ? (
              <path
                key={arc.key}
                d={arc.pathD}
                className="course-hole-graphic-yardage-arc"
                fill="none"
              />
            ) : null,
          )}
        </svg>
      </div>

      {/* Labels stay unmasked so markers remain readable */}
      <div className="course-hole-graphic-yardage-layer" style={layerBoxStyle}>
        <svg
          className="course-hole-graphic-yardage-labels"
          width={mediaRect.width}
          height={mediaRect.height}
          viewBox={`0 0 ${viewW} ${viewH}`}
          preserveAspectRatio="none"
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
            cx={pinX}
            cy={pinY}
            r={5}
            className="course-hole-graphic-yardage-pin"
          />
        </svg>
      </div>
    </div>
  );
}
