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
  yardageLabelAtArcRightEdge,
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
    const center = pinToMediaPx(pin, mediaRect.width, mediaRect.height);
    const isAllowed = canClipLocally
      ? resolveArcAllowTest(
          yardageArcs.arcClip,
          playableMask,
          mediaRect.width,
          mediaRect.height,
        )
      : null;

    const labelFor = (marker: (typeof markers)[number]) => {
      const radius = yardageMarkerRadiusPx(
        pin,
        marker,
        mediaRect.width,
        mediaRect.height,
      );
      const edge = yardageLabelAtArcRightEdge(
        center.x,
        center.y,
        radius,
        isAllowed,
      );
      return {
        labelX: Math.min(mediaRect.width - 6, Math.max(6, edge.x)),
        labelY: Math.min(mediaRect.height - 8, Math.max(12, edge.y)),
        radius,
      };
    };

    // Prefer locally clipped paths once the mask (or custom clip) is ready.
    if (canClipLocally) {
      return markers.map((marker, index) => {
        const { labelX, labelY, radius } = labelFor(marker);
        return {
          key: `${marker.yards}-${index}`,
          pathD: buildClippedCirclePath(center.x, center.y, radius, isAllowed),
          labelX,
          labelY,
          yards: marker.yards,
        };
      });
    }

    // While the mask loads, still park labels on the right of each radius.
    if (usableServerRender) {
      return yardageArcRender.paths.map((arc, index) => {
        const marker = markers[index];
        if (marker) {
          const { labelX, labelY } = labelFor(marker);
          return {
            key: `${arc.yards}-${index}`,
            pathD: arc.pathD,
            labelX,
            labelY,
            yards: arc.yards,
          };
        }
        return {
          key: `${arc.yards}-${index}`,
          pathD: arc.pathD,
          labelX: Math.min(mediaRect.width - 6, arc.labelX),
          labelY: arc.labelY,
          yards: arc.yards,
        };
      });
    }

    // Last resort: full circles (CSS mask still clips to the hole silhouette).
    return markers.map((marker, index) => {
      const { labelX, labelY, radius } = labelFor(marker);
      return {
        key: `${marker.yards}-${index}`,
        pathD: buildClippedCirclePath(center.x, center.y, radius, null),
        labelX,
        labelY,
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
  const pinInMedia = pinToMediaPx(
    yardageArcs.pin,
    mediaRect.width,
    mediaRect.height,
  );

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

      {/* Labels sit at the right arc edge (unmasked) so hole detail stays clear */}
      <div className="course-hole-graphic-yardage-layer" style={layerBoxStyle}>
        <svg
          className="course-hole-graphic-yardage-labels"
          width={mediaRect.width}
          height={mediaRect.height}
          viewBox={`0 0 ${mediaRect.width} ${mediaRect.height}`}
          preserveAspectRatio="none"
        >
          {arcPaths.map((arc) => {
            const labelW = 40;
            const labelH = 18;
            // Left-align the pill just past the arc fade-out on the right.
            const rectX = Math.min(arc.labelX, mediaRect.width - labelW - 2);
            const rectY = arc.labelY - labelH / 2;
            return (
              <g key={`label-${arc.key}`}>
                <rect
                  x={rectX}
                  y={rectY}
                  width={labelW}
                  height={labelH}
                  rx={4}
                  className="course-hole-graphic-yardage-label-bg"
                />
                <text
                  x={rectX + labelW / 2}
                  y={rectY + labelH / 2 + 4}
                  textAnchor="middle"
                  className="course-hole-graphic-yardage-label"
                >
                  {arc.yards}
                </text>
              </g>
            );
          })}
          <circle
            cx={pinInMedia.x}
            cy={pinInMedia.y}
            r={5}
            className="course-hole-graphic-yardage-pin"
          />
        </svg>
      </div>
    </div>
  );
}
