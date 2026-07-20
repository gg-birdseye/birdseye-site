"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  buildCameraPathPolyline,
  cameraPathHasTrack,
  progressAtClosestPathPoint,
  sampleCameraPathAtProgress,
  type CameraPathPoint,
} from "@/lib/camera-path";
import {
  containedMediaRect,
  type ContainedMediaRect,
} from "@/lib/aerial-map-geometry";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

type CameraPathOverlayProps = {
  contentRef: RefObject<HTMLElement | null>;
  cameraPath?: CameraPathPoint[] | null;
  progress: number;
  onPathSeek?: (progress: number) => void;
  visible?: boolean;
};

function readImageDimensions(img: HTMLImageElement): { width: number; height: number } | null {
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    return { width: img.naturalWidth, height: img.naturalHeight };
  }
  return null;
}

export function CameraPathOverlay({
  contentRef,
  cameraPath,
  progress,
  onPathSeek,
  visible = true,
}: CameraPathOverlayProps) {
  const [mediaRect, setMediaRect] = useState<ContainedMediaRect | null>(null);
  const [lottieData, setLottieData] = useState<object | null>(null);

  const hasTrack = cameraPathHasTrack(cameraPath);
  const pathD = useMemo(() => buildCameraPathPolyline(cameraPath), [cameraPath]);
  const tracker = useMemo(
    () => sampleCameraPathAtProgress(cameraPath, progress),
    [cameraPath, progress],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/lottie/blue-pulse-circle.json")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setLottieData(data);
      })
      .catch(() => {
        if (!cancelled) setLottieData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateMediaRect = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;

    const img = container.querySelector<HTMLImageElement>(
      ".course-hole-graphic-panel-media",
    );
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

  useEffect(() => {
    if (!hasTrack) {
      setMediaRect(null);
      return;
    }

    updateMediaRect();
    window.addEventListener("resize", updateMediaRect);

    const container = contentRef.current;
    const img = container?.querySelector<HTMLImageElement>(
      ".course-hole-graphic-panel-media",
    );

    if (img && !img.complete) {
      img.addEventListener("load", updateMediaRect);
    }

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && container
        ? new ResizeObserver(() => updateMediaRect())
        : null;
    if (container) {
      resizeObserver?.observe(container);
    }

    return () => {
      window.removeEventListener("resize", updateMediaRect);
      img?.removeEventListener("load", updateMediaRect);
      resizeObserver?.disconnect();
    };
  }, [contentRef, hasTrack, updateMediaRect, cameraPath]);

  const handlePathClick = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      if (!onPathSeek) return;

      const svg = event.currentTarget;
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      const targetProgress = progressAtClosestPathPoint(cameraPath, x, y);
      if (targetProgress == null) return;

      onPathSeek(targetProgress);
    },
    [cameraPath, onPathSeek],
  );

  if (!visible || !hasTrack) return null;

  return (
    <div
      className="course-hole-graphic-camera-path-overlay"
      aria-hidden={false}
    >
      {mediaRect ? (
      <div
        className="course-hole-graphic-camera-path-layer"
        style={{
          left: `${mediaRect.left}px`,
          top: `${mediaRect.top}px`,
          width: `${mediaRect.width}px`,
          height: `${mediaRect.height}px`,
        }}
      >
        {pathD ? (
          <svg
            className="course-hole-graphic-camera-path-line"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            onClick={handlePathClick}
          >
            <path
              d={pathD}
              className="course-hole-graphic-camera-path-hit"
              pathLength={100}
            />
            <path d={pathD} pathLength={100} />
          </svg>
        ) : null}

        {tracker ? (
          <div
            className="course-hole-graphic-camera-tracker"
            style={{ left: `${tracker.x}%`, top: `${tracker.y}%` }}
          >
            {lottieData ? (
              <Lottie
                animationData={lottieData}
                loop
                className="course-hole-graphic-camera-tracker-lottie"
              />
            ) : (
              <span className="course-hole-graphic-camera-tracker-fallback" />
            )}
          </div>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}
