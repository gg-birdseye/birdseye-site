"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { TransformComponent, TransformWrapper, useControls, useTransformEffect } from "react-zoom-pan-pinch";
import type { CourseAerialMapData, CourseAerialMapHotspot } from "@/lib/sanity/courses";
import { PanelCloseButton } from "@/components/PanelCloseButton";
import {
  containedMediaRect,
  type ContainedMediaRect,
} from "@/lib/aerial-map-geometry";

type InteractiveAerialMapProps = {
  aerialMap: CourseAerialMapData;
  hotspots: CourseAerialMapHotspot[];
  showHoleMarkers: boolean;
  activeHole?: number;
  resetKey: number;
  onHoleSelect?: (hole: number) => void;
  toolbarStart?: ReactNode;
  onEnterHoleView?: () => void;
  onClose?: () => void;
};

const ROTATE_STEP = 15;

type HotspotScreenPosition = {
  x: number;
  y: number;
};

function AerialHotspotOverlay({
  viewportRef,
  markerRefs,
  hotspots,
  showHoleMarkers,
  activeHole,
  rotation,
  layoutKey,
}: {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  markerRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  hotspots: CourseAerialMapHotspot[];
  showHoleMarkers: boolean;
  activeHole?: number;
  rotation: number;
  layoutKey: string | null;
}) {
  const [positions, setPositions] = useState<Record<number, HotspotScreenPosition>>({});

  const updatePositions = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const viewportRect = viewport.getBoundingClientRect();
    const next: Record<number, HotspotScreenPosition> = {};

    for (const hotspot of hotspots) {
      const marker = markerRefs.current[hotspot.holeNumber];
      if (!marker) continue;

      const markerRect = marker.getBoundingClientRect();
      next[hotspot.holeNumber] = {
        x: markerRect.left + markerRect.width / 2 - viewportRect.left,
        y: markerRect.top + markerRect.height / 2 - viewportRect.top,
      };
    }

    setPositions(next);
  }, [hotspots, markerRefs, viewportRef]);

  useTransformEffect(() => {
    updatePositions();
  });

  useEffect(() => {
    updatePositions();
  }, [updatePositions, rotation, showHoleMarkers, layoutKey]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(updatePositions);
    observer.observe(viewport);
    window.addEventListener("resize", updatePositions);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePositions);
    };
  }, [updatePositions, viewportRef]);

  if (!showHoleMarkers) return null;

  return (
    <div className="course-aerial-hotspot-overlay" aria-hidden>
      {hotspots.map((hotspot) => {
        const position = positions[hotspot.holeNumber];
        if (!position) return null;

        const isActive = activeHole === hotspot.holeNumber;
        return (
          <span
            key={hotspot.holeNumber}
            className={`course-aerial-hotspot${isActive ? " course-aerial-hotspot-active" : ""}`}
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
            }}
          >
            {hotspot.holeNumber}
          </span>
        );
      })}
    </div>
  );
}

function readMediaDimensions(
  element: HTMLImageElement | HTMLVideoElement,
): { width: number; height: number } | null {
  if (element instanceof HTMLVideoElement) {
    if (element.videoWidth > 0 && element.videoHeight > 0) {
      return { width: element.videoWidth, height: element.videoHeight };
    }
    return null;
  }
  if (element.naturalWidth > 0 && element.naturalHeight > 0) {
    return { width: element.naturalWidth, height: element.naturalHeight };
  }
  // SVG-as-<img> can report 0×0 until decoded; Example Course artboard is 1920×1080.
  if (element.complete && /\.svg($|\?)/i.test(element.currentSrc || element.src)) {
    return { width: 1920, height: 1080 };
  }
  return null;
}

function touchAngle(touches: TouchList): number {
  const dx = touches[1].clientX - touches[0].clientX;
  const dy = touches[1].clientY - touches[0].clientY;
  return Math.atan2(dy, dx);
}

function applyRotateLayerTransform(
  layer: HTMLDivElement | null,
  degrees: number,
) {
  if (!layer) return;
  layer.style.transform = degrees ? `rotate(${degrees}deg)` : "";
}

/** Hit radius for selecting a hole marker via viewport tap (hotspots don't capture touches). */
const HOTSPOT_TAP_RADIUS_PX = 32;
const TAP_MOVE_THRESHOLD_PX = 14;

function AerialMapViewport({
  aerialMap,
  hotspots,
  showHoleMarkers,
  activeHole,
  onHoleSelect,
  rotation,
  setRotation,
  shiftHeld,
  shiftRotating,
  setShiftRotating,
  shiftRotateStart,
  rotateLayerRef,
}: {
  aerialMap: CourseAerialMapData;
  hotspots: CourseAerialMapHotspot[];
  showHoleMarkers: boolean;
  activeHole?: number;
  onHoleSelect?: (hole: number) => void;
  rotation: number;
  setRotation: React.Dispatch<React.SetStateAction<number>>;
  shiftHeld: boolean;
  shiftRotating: boolean;
  setShiftRotating: React.Dispatch<React.SetStateAction<boolean>>;
  shiftRotateStart: React.MutableRefObject<{ angle: number; rotation: number } | null>;
  rotateLayerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);
  const markerRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [mediaRect, setMediaRect] = useState<ContainedMediaRect | null>(null);
  const { centerView } = useControls();

  // Keep the rotate layer in sync when rotation changes from buttons / Shift-drag.
  useEffect(() => {
    applyRotateLayerTransform(rotateLayerRef.current, rotation);
  }, [rotation, rotateLayerRef]);

  const updateMediaRect = useCallback(() => {
    const viewport = viewportRef.current;
    const media = mediaRef.current;
    if (!viewport || !media) return;

    const dimensions = readMediaDimensions(media);
    if (!dimensions) return;

    const next = containedMediaRect(
      viewport.clientWidth,
      viewport.clientHeight,
      dimensions.width,
      dimensions.height,
    );
    if (!next) return;
    setMediaRect(next);
  }, []);

  useEffect(() => {
    setMediaRect(null);
  }, [aerialMap.src]);

  useEffect(() => {
    updateMediaRect();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(() => updateMediaRect());
    observer.observe(viewport);
    const retry = window.requestAnimationFrame(() => updateMediaRect());
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(retry);
    };
  }, [aerialMap.src, updateMediaRect]);

  useEffect(() => {
    if (!mediaRect || mediaRect.width <= 1 || mediaRect.height <= 1) return;
    const frame = window.requestAnimationFrame(() => {
      centerView(1, 0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [centerView, mediaRect]);

  const pointerStartRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const ignoreTapRef = useRef(false);

  const selectHoleAtPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!onHoleSelect || !showHoleMarkers) return;
      let bestHole: number | null = null;
      let bestDist = HOTSPOT_TAP_RADIUS_PX;

      for (const hotspot of hotspots) {
        const marker = markerRefs.current[hotspot.holeNumber];
        if (!marker) continue;
        const rect = marker.getBoundingClientRect();
        const dist = Math.hypot(
          clientX - (rect.left + rect.width / 2),
          clientY - (rect.top + rect.height / 2),
        );
        if (dist <= bestDist) {
          bestDist = dist;
          bestHole = hotspot.holeNumber;
        }
      }

      if (bestHole != null) onHoleSelect(bestHole);
    },
    [hotspots, onHoleSelect, showHoleMarkers],
  );

  const handleShiftRotatePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.isPrimary) {
        pointerStartRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
        ignoreTapRef.current = false;
      }

      if (!shiftHeld || event.button !== 0) return;
      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      shiftRotateStart.current = {
        angle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
        rotation,
      };
      setShiftRotating(true);
      ignoreTapRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [rotation, setShiftRotating, shiftHeld, shiftRotateStart],
  );

  const handleShiftRotatePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = pointerStartRef.current;
      if (
        start &&
        event.pointerId === start.pointerId &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) >
          TAP_MOVE_THRESHOLD_PX
      ) {
        ignoreTapRef.current = true;
      }

      if (!shiftRotating || !shiftRotateStart.current) return;
      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
      const delta = ((angle - shiftRotateStart.current.angle) * 180) / Math.PI;
      setRotation(shiftRotateStart.current.rotation + delta);
      event.preventDefault();
    },
    [setRotation, shiftRotateStart, shiftRotating],
  );

  const handleViewportPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (shiftRotating) {
        shiftRotateStart.current = null;
        setShiftRotating(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const start = pointerStartRef.current;
      const shouldSelect =
        start != null &&
        event.pointerId === start.pointerId &&
        !ignoreTapRef.current &&
        !shiftHeld &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) <=
          TAP_MOVE_THRESHOLD_PX;

      pointerStartRef.current = null;

      if (shouldSelect) {
        selectHoleAtPoint(event.clientX, event.clientY);
      }
    },
    [selectHoleAtPoint, setShiftRotating, shiftHeld, shiftRotateStart, shiftRotating],
  );

  // Multi-touch (pinch) should never count as a hole tap.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length >= 2) ignoreTapRef.current = true;
    };

    viewport.addEventListener("touchstart", onTouchStart, { passive: true });
    return () => viewport.removeEventListener("touchstart", onTouchStart);
  }, []);

  const hasHotspots = hotspots.length > 0 && Boolean(onHoleSelect);
  const mediaReady =
    mediaRect != null && mediaRect.width > 1 && mediaRect.height > 1;

  const mediaStyle = mediaReady
    ? {
        width: `${mediaRect.width}px`,
        height: `${mediaRect.height}px`,
      }
    : {
        width: "100%",
        height: "100%",
      };

  return (
    <div
      ref={viewportRef}
      className={`course-aerial-interactive-viewport${shiftHeld ? " course-aerial-interactive-viewport-rotate" : ""}`}
      onPointerDown={handleShiftRotatePointerDown}
      onPointerMove={handleShiftRotatePointerMove}
      onPointerUp={handleViewportPointerUp}
      onPointerCancel={handleViewportPointerUp}
    >
      <TransformComponent
        wrapperClass="course-aerial-transform-wrapper"
        contentClass="course-aerial-transform-content"
      >
        <div ref={rotateLayerRef} className="course-aerial-map-rotate-layer">
          <div
            className={`course-aerial-map-stage${mediaReady ? "" : " course-aerial-map-stage-loading"}`}
            style={
              mediaReady
                ? {
                    width: `${mediaRect.width}px`,
                    height: `${mediaRect.height}px`,
                  }
                : undefined
            }
          >
            {aerialMap.isVideo ? (
              <video
                ref={mediaRef as React.RefObject<HTMLVideoElement>}
                src={aerialMap.src}
                className="course-aerial-panel-media"
                style={mediaStyle}
                autoPlay
                loop
                muted
                playsInline
                onLoadedMetadata={updateMediaRect}
                aria-label={aerialMap.alt ?? "Aerial course map"}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={mediaRef as React.RefObject<HTMLImageElement>}
                src={aerialMap.src}
                alt={aerialMap.alt ?? "Aerial course map"}
                className="course-aerial-panel-media"
                style={mediaStyle}
                draggable={false}
                onLoad={updateMediaRect}
              />
            )}

            {hasHotspots && showHoleMarkers ? (
              <div className="course-aerial-panel-hotspot-markers" aria-hidden="true">
                {hotspots.map((hotspot) => (
                  <div
                    key={hotspot.holeNumber}
                    ref={(element) => {
                      markerRefs.current[hotspot.holeNumber] = element;
                    }}
                    className="course-aerial-hotspot-marker"
                    style={{
                      left: `${hotspot.x}%`,
                      top: `${hotspot.y}%`,
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </TransformComponent>

      {hasHotspots ? (
        <AerialHotspotOverlay
          viewportRef={viewportRef}
          markerRefs={markerRefs}
          hotspots={hotspots}
          showHoleMarkers={showHoleMarkers}
          activeHole={activeHole}
          rotation={rotation}
          layoutKey={mediaReady ? `${mediaRect.width}x${mediaRect.height}` : null}
        />
      ) : null}
    </div>
  );
}

export function InteractiveAerialMap({
  aerialMap,
  hotspots,
  showHoleMarkers,
  activeHole,
  resetKey,
  onHoleSelect,
  toolbarStart,
  onEnterHoleView,
  onClose,
}: InteractiveAerialMapProps) {
  const shiftRotateStart = useRef<{ angle: number; rotation: number } | null>(null);
  const pinchRotateStart = useRef<{ angle: number; rotation: number } | null>(null);
  const rotateLayerRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef(0);

  const [rotation, setRotation] = useState(0);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [shiftRotating, setShiftRotating] = useState(false);

  const resetRotation = useCallback(() => {
    setRotation(0);
  }, []);

  const rotateLeft = useCallback(() => {
    setRotation((value) => value - ROTATE_STEP);
  }, []);

  const rotateRight = useCallback(() => {
    setRotation((value) => value + ROTATE_STEP);
  }, []);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    setRotation(0);
    pinchRotateStart.current = null;
    shiftRotateStart.current = null;
  }, [resetKey, aerialMap.src]);

  // Block native browser zoom (trackpad pinch / ctrl+scroll / iOS pinch)
  // while the aerial map is open so only the map graphic zooms.
  useEffect(() => {
    const preventGesture = (event: Event) => event.preventDefault();
    const preventPinchTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    const preventCtrlWheel = (event: WheelEvent) => {
      if (event.ctrlKey) event.preventDefault();
    };

    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("touchmove", preventPinchTouch, { passive: false });
    document.addEventListener("wheel", preventCtrlWheel, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("touchmove", preventPinchTouch);
      document.removeEventListener("wheel", preventCtrlWheel);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") setShiftHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setShiftHeld(false);
        shiftRotateStart.current = null;
        setShiftRotating(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return (
    <div className="course-aerial-interactive-root">
      <TransformWrapper
        key={resetKey}
        initialScale={1}
        minScale={0.35}
        maxScale={4}
        centerOnInit
        limitToBounds={false}
        wheel={{ step: 0.08 }}
        pinch={{ step: 5 }}
        doubleClick={{ disabled: true }}
        panning={{
          disabled: shiftHeld || shiftRotating,
          excluded: ["course-aerial-control-btn"],
        }}
        onPinchStart={(_ref, event) => {
          if (event.touches.length < 2) return;
          // Twist-rotate via DOM during the gesture (no React setState) so
          // pinch zoom isn't interrupted by re-renders.
          pinchRotateStart.current = {
            angle: touchAngle(event.touches),
            rotation: rotationRef.current,
          };
        }}
        onPinch={(_ref, event) => {
          if (!pinchRotateStart.current || event.touches.length < 2) return;
          const angle = touchAngle(event.touches);
          const delta =
            ((angle - pinchRotateStart.current.angle) * 180) / Math.PI;
          const next = pinchRotateStart.current.rotation + delta;
          rotationRef.current = next;
          applyRotateLayerTransform(rotateLayerRef.current, next);
        }}
        onPinchStop={() => {
          pinchRotateStart.current = null;
          setRotation(rotationRef.current);
        }}
      >
        {(api) => (
          <div className="course-aerial-transform-shell">
            <div className="course-aerial-panel-toolbar">
              <div className="course-aerial-panel-toolbar-start">
                {toolbarStart}
                {onEnterHoleView ? (
                  <button
                    type="button"
                    className="course-aerial-mode-btn"
                    onClick={onEnterHoleView}
                  >
                    Hole View
                  </button>
                ) : null}
                <div
                  className="course-aerial-transform-controls"
                  role="group"
                  aria-label="Aerial map controls"
                >
                  <button
                    type="button"
                    className="course-aerial-control-btn"
                    aria-label="Zoom out"
                    onClick={() => api.zoomOut(0.2, 180)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="course-aerial-control-btn"
                    aria-label="Zoom in"
                    onClick={() => api.zoomIn(0.2, 180)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="course-aerial-control-btn"
                    aria-label="Rotate left"
                    onClick={rotateLeft}
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    className="course-aerial-control-btn"
                    aria-label="Rotate right"
                    onClick={rotateRight}
                  >
                    ↻
                  </button>
                  <button
                    type="button"
                    className="course-aerial-control-btn course-aerial-control-btn-reset"
                    onClick={() => {
                      resetRotation();
                      api.resetTransform(200);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
              <PanelCloseButton onClose={onClose} label="Close aerial panel" />
            </div>

            <div className="course-aerial-panel-content">
              <AerialMapViewport
                aerialMap={aerialMap}
                hotspots={hotspots}
                showHoleMarkers={showHoleMarkers}
                activeHole={activeHole}
                onHoleSelect={onHoleSelect}
                rotation={rotation}
                setRotation={setRotation}
                shiftHeld={shiftHeld}
                shiftRotating={shiftRotating}
                setShiftRotating={setShiftRotating}
                shiftRotateStart={shiftRotateStart}
                rotateLayerRef={rotateLayerRef}
              />
            </div>
          </div>
        )}
      </TransformWrapper>

      <p className="course-aerial-panel-hint">
        Drag to pan · Pinch or scroll to zoom · Twist or use ↺ ↻ to rotate · Shift+drag to rotate
        on desktop
      </p>
    </div>
  );
}
