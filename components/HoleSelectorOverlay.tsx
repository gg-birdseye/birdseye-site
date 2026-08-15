"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type HoleSelectorOverlayProps = {
  holeCount: number;
  activeHole: number;
  parForHole: (hole: number) => number;
  accentColor?: string;
  onHoleSelect: (hole: number) => void;
  hidden?: boolean;
  /** Render inline in a parent top bar instead of fixed to the viewport. */
  embedded?: boolean;
  /** Hide the grid/backdrop but keep the hole button (e.g. portrait panel open below video). */
  hideGrid?: boolean;
  /** When a footer panel opens/changes, collapse any toggled grid. */
  panelOpen?: "scorecard" | "map" | "courses" | null;
  /** Called when the user opens the hole selector grid. */
  onOpen?: () => void;
};

function gridLayout(
  holeCount: number,
  options?: { portraitStacked?: boolean },
): { columns: number; rows: number } {
  if (options?.portraitStacked) {
    if (holeCount <= 9) return { columns: 3, rows: 3 };
    if (holeCount <= 18) return { columns: 3, rows: 6 };
    return { columns: 3, rows: Math.ceil(holeCount / 3) };
  }
  if (holeCount <= 9) return { columns: 3, rows: 3 };
  if (holeCount <= 18) return { columns: 6, rows: 3 };
  return { columns: 9, rows: 3 };
}

function isMobilePortraitViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px) and (orientation: portrait)").matches;
}

function isMobileLandscapeViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(orientation: landscape) and (max-height: 600px)")
    .matches;
}

function isVideoFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("course-video-is-fullscreen");
}

export function HoleSelectorOverlay({
  holeCount,
  activeHole,
  parForHole,
  accentColor = "#CF8018",
  onHoleSelect,
  hidden = false,
  embedded = false,
  hideGrid = false,
  panelOpen = null,
  onOpen,
}: HoleSelectorOverlayProps) {
  const [open, setOpen] = useState(false);
  const [isMobilePortrait, setIsMobilePortrait] = useState(() => isMobilePortraitViewport());
  const [isMobileLandscape, setIsMobileLandscape] = useState(() =>
    isMobileLandscapeViewport(),
  );
  const [isFullscreen, setIsFullscreen] = useState(() => isVideoFullscreen());

  const isMobileOverlayLayout = isMobilePortrait || isMobileLandscape;

  const holes = useMemo(
    () => Array.from({ length: holeCount }, (_, index) => index + 1),
    [holeCount],
  );
  const { columns, rows } = gridLayout(holeCount, {
    portraitStacked: isFullscreen && isMobilePortrait,
  });
  const activePar = parForHole(activeHole);
  // Portrait normally keeps a persistent grid under the video. In fullscreen that
  // would cover the flyover, so require an explicit open tap instead.
  const showGrid =
    open || (isMobilePortrait && !hideGrid && !isFullscreen);

  useEffect(() => {
    if (hideGrid) {
      setOpen(false);
    }
  }, [hideGrid]);

  useEffect(() => {
    if (panelOpen != null) {
      setOpen(false);
    }
  }, [panelOpen]);

  useEffect(() => {
    const portraitMq = window.matchMedia("(max-width: 767px) and (orientation: portrait)");
    const landscapeMq = window.matchMedia(
      "(orientation: landscape) and (max-height: 600px)",
    );
    const update = () => {
      setIsMobilePortrait(portraitMq.matches);
      setIsMobileLandscape(landscapeMq.matches);
      setIsFullscreen(isVideoFullscreen());
    };
    update();
    portraitMq.addEventListener("change", update);
    landscapeMq.addEventListener("change", update);

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      portraitMq.removeEventListener("change", update);
      landscapeMq.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!showGrid || isMobileOverlayLayout) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showGrid, isMobileOverlayLayout]);

  useEffect(() => {
    document.documentElement.classList.toggle("course-hole-selector-grid-open", showGrid);
    document.documentElement.classList.toggle(
      "course-hole-selector-portrait-persistent",
      isMobileOverlayLayout && showGrid,
    );
    return () => {
      document.documentElement.classList.remove("course-hole-selector-grid-open");
      document.documentElement.classList.remove("course-hole-selector-portrait-persistent");
    };
  }, [showGrid, isMobilePortrait, isMobileLandscape, isMobileOverlayLayout]);

  if (hidden) return null;

  const toggleButton = (
    <button
      type="button"
      className="course-hole-selector-btn"
      onClick={() => {
        if (isMobilePortrait && !hideGrid && !isFullscreen) return;
        const nextOpen = !open;
        setOpen(nextOpen);
        if (nextOpen) onOpen?.();
      }}
      aria-expanded={showGrid}
      aria-haspopup="dialog"
      aria-label={`Hole ${activeHole}, par ${activePar}. Open hole selector.`}
    >
      <span className="course-hole-selector-btn-face">
        <svg
          viewBox="0 0 72 72"
          className="course-hole-selector-btn-svg course-hole-selector-btn-svg--label"
          aria-hidden
        >
          <rect
            x="1"
            y="1"
            width="70"
            height="70"
            rx="6"
            fill="rgba(255,255,255,0.22)"
            stroke="rgba(255,255,255,0.42)"
            strokeWidth="1.5"
          />
          <text
            x="36"
            y="31"
            textAnchor="middle"
            fill="#fff"
            fontSize="26"
            fontWeight="700"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {activeHole}
          </text>
          <text
            x="36"
            y="52"
            textAnchor="middle"
            fill="rgba(255,255,255,0.82)"
            fontSize="11"
            fontWeight="600"
            letterSpacing="0.08em"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {`PAR ${activePar}`}
          </text>
        </svg>
        <svg
          viewBox="0 0 72 72"
          className="course-hole-selector-btn-svg course-hole-selector-btn-svg--grid"
          aria-hidden
        >
          <rect
            x="1"
            y="1"
            width="70"
            height="70"
            rx="6"
            fill="rgba(255,255,255,0.22)"
            stroke="rgba(255,255,255,0.42)"
            strokeWidth="1.5"
          />
          <g fill="#fff">
            <rect x="16" y="16" width="10" height="10" rx="1.5" />
            <rect x="31" y="16" width="10" height="10" rx="1.5" />
            <rect x="46" y="16" width="10" height="10" rx="1.5" />
            <rect x="16" y="31" width="10" height="10" rx="1.5" />
            <rect x="31" y="31" width="10" height="10" rx="1.5" />
            <rect x="46" y="31" width="10" height="10" rx="1.5" />
            <rect x="16" y="46" width="10" height="10" rx="1.5" />
            <rect x="31" y="46" width="10" height="10" rx="1.5" />
            <rect x="46" y="46" width="10" height="10" rx="1.5" />
          </g>
        </svg>
      </span>
    </button>
  );

  // Landscape only: move toggle into the panel top row. Portrait keeps a single
  // fixed toggle on the video corner. Fullscreen keeps the fixed top-left toggle.
  const showPanelToggleRow =
    isMobileLandscape && !isMobilePortrait && showGrid && !isFullscreen;

  return (
    <>
      <div
        className={`course-hole-selector${embedded ? " course-hole-selector-embedded" : ""}${
          open ? " course-hole-selector-open" : ""
        }${showPanelToggleRow ? " course-hole-selector-fixed-hidden" : ""}`}
      >
        {toggleButton}
      </div>

      {/* Portal the grid to <body>: when the selector is embedded in a panel
          with backdrop-filter, that panel becomes the containing block for
          fixed positioning and would trap the grid inside it. */}
      {showGrid && typeof document !== "undefined" ? (
        createPortal(
        <>
          {!isMobileOverlayLayout ? (
            <button
              type="button"
              className="course-hole-selector-backdrop"
              aria-label="Close hole selector"
              onClick={() => setOpen(false)}
            />
          ) : null}
          <div
            className={`course-hole-selector-panel${
              showPanelToggleRow ? " course-hole-selector-panel--landscape" : ""
            }${isMobilePortrait && showGrid ? " course-hole-selector-panel--portrait-open" : ""}${
              isFullscreen ? " course-hole-selector-panel--fullscreen" : ""
            }`}
            role="dialog"
            aria-label="Select a hole"
            aria-modal={!isMobileOverlayLayout}
          >
            {showPanelToggleRow ? (
              <div className="course-hole-selector-landscape-toggle-row">
                {toggleButton}
              </div>
            ) : null}
            <div
              className="course-hole-selector-grid"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
              }}
            >
              {holes.map((hole) => {
                const isActive = hole === activeHole;
                return (
                  <button
                    key={hole}
                    type="button"
                    onClick={() => {
                      onHoleSelect(hole);
                      // Portrait keeps the grid up as a standing picker unless
                      // a panel is waiting underneath it.
                      if (!isMobilePortrait || isFullscreen || panelOpen != null) {
                        setOpen(false);
                      }
                    }}
                    className={`course-hole-selector-grid-btn ${
                      isActive ? "course-hole-selector-grid-btn-active" : ""
                    }`}
                    style={
                      isActive
                        ? {
                            borderColor: "#00cdac",
                            backgroundColor: "#00cdac33",
                          }
                        : undefined
                    }
                    aria-label={`Hole ${hole}, par ${parForHole(hole)}`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    <span className="course-hole-selector-grid-hole">{hole}</span>
                    <span className="course-hole-selector-grid-par">
                      Par {parForHole(hole)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body,
        )
      ) : null}
    </>
  );
}
