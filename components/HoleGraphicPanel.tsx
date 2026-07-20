"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CameraPathPoint,
  HoleGraphic,
  YardageArcsData,
} from "@/lib/sanity/courses";
import { cameraPathHasTrack } from "@/lib/camera-path";
import { yardageArcsAreReady } from "@/lib/yardage-arcs";
import { PanelCloseButton } from "@/components/PanelCloseButton";
import { CameraPathOverlay } from "@/components/CameraPathOverlay";
import { YardageArcOverlay } from "@/components/YardageArcOverlay";
import { HoleSelectorOverlay } from "@/components/HoleSelectorOverlay";

type EmbeddedHoleSelectorProps = {
  holeCount: number;
  activeHole: number;
  parForHole: (hole: number) => number;
  accentColor?: string;
  onHoleSelect: (hole: number) => void;
  panelOpen?: "scorecard" | "map" | "courses" | null;
};

type HoleGraphicPanelProps = {
  open: boolean;
  holeNumber: number;
  par: number;
  holeGraphic?: HoleGraphic;
  cameraPath?: CameraPathPoint[];
  yardageArcs?: YardageArcsData;
  flyoverProgress?: number;
  onPathSeek?: (progress: number) => void;
  useDesktopTopBar?: boolean;
  embeddedHoleSelector?: EmbeddedHoleSelectorProps;
  onCourseView: () => void;
  onClose?: () => void;
};

export function HoleGraphicPanel({
  open,
  holeNumber,
  par,
  holeGraphic,
  cameraPath,
  yardageArcs,
  flyoverProgress = 0,
  onPathSeek,
  useDesktopTopBar = false,
  embeddedHoleSelector,
  onCourseView,
  onClose,
}: HoleGraphicPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [trackerVisible, setTrackerVisible] = useState(true);
  const [yardagesVisible, setYardagesVisible] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(false);
  const hasCameraTrack = cameraPathHasTrack(cameraPath);
  const hasYardageArcs = yardageArcsAreReady(yardageArcs);

  useEffect(() => {
    setTrackerVisible(true);
    setYardagesVisible(true);
  }, [holeNumber]);

  useEffect(() => {
    if (!open) setActionsOpen(false);
  }, [open]);

  useEffect(() => {
    if (!actionsOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (!menu || !(event.target instanceof Node)) return;
      if (!menu.contains(event.target)) setActionsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActionsOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [actionsOpen]);

  if (!open) return null;

  const useDesktopTopBarLayout = useDesktopTopBar || Boolean(embeddedHoleSelector);

  const trackerToggleButton = hasCameraTrack ? (
    <button
      type="button"
      className="course-aerial-mode-btn"
      onClick={() => setTrackerVisible((visible) => !visible)}
      aria-pressed={!trackerVisible}
    >
      {trackerVisible ? "Hide Tracker" : "Show Tracker"}
    </button>
  ) : null;

  const yardageToggleButton = hasYardageArcs ? (
    <button
      type="button"
      className="course-aerial-mode-btn"
      onClick={() => setYardagesVisible((visible) => !visible)}
      aria-pressed={!yardagesVisible}
    >
      {yardagesVisible ? "Hide Yardages" : "Show Yardages"}
    </button>
  ) : null;

  const panelActionButtons = (
    <>
      <button
        type="button"
        className="course-aerial-mode-btn"
        onClick={onCourseView}
      >
        Course View
      </button>
      {trackerToggleButton}
      {yardageToggleButton}
    </>
  );

  const actionsDropdown = (
    <div ref={menuRef} className="course-hole-graphic-panel-menu">
      <button
        type="button"
        className="course-hole-graphic-panel-menu-btn"
        aria-expanded={actionsOpen}
        aria-label={actionsOpen ? "Hide view options" : "Show view options"}
        title="View options"
        onClick={() => setActionsOpen((value) => !value)}
      >
        <svg
          viewBox="0 0 24 24"
          className="course-hole-graphic-panel-menu-chevron"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.25}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {actionsOpen ? (
        <div className="course-hole-graphic-panel-menu-items">
          {panelActionButtons}
        </div>
      ) : null}
    </div>
  );

  return (
    <aside
      className={`course-hole-graphic-panel pointer-events-auto${
        useDesktopTopBarLayout ? " course-hole-graphic-panel--desktop-topbar" : ""
      }`}
      role="complementary"
      aria-label={`Hole ${holeNumber} layout`}
    >
      <div className="course-hole-graphic-panel-inner">
        {useDesktopTopBarLayout ? (
          <div className="course-hole-graphic-panel-topbar">
            <div className="course-hole-graphic-panel-topbar-menu">
              {actionsDropdown}
            </div>
            {embeddedHoleSelector ? (
              <div className="course-hole-graphic-panel-topbar-left">
                <HoleSelectorOverlay embedded {...embeddedHoleSelector} />
              </div>
            ) : null}
            <div className="course-hole-graphic-panel-topbar-right">
              <PanelCloseButton onClose={onClose} label="Close hole view" />
            </div>
          </div>
        ) : (
          <div className="course-hole-graphic-panel-toolbar">
            <div className="course-hole-graphic-panel-toolbar-start">
              {actionsDropdown}
            </div>
            <PanelCloseButton onClose={onClose} label="Close hole view" />
          </div>
        )}

        {!useDesktopTopBarLayout ? (
          <div className="course-hole-graphic-panel-header">
            <p className="course-hole-graphic-panel-label">Hole {holeNumber}</p>
            <p className="course-hole-graphic-panel-par">Par {par}</p>
          </div>
        ) : null}

        <div ref={contentRef} className="course-hole-graphic-panel-content">
          {holeGraphic ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={holeGraphic.src}
                alt={holeGraphic.alt ?? `Hole ${holeNumber} layout`}
                className="course-hole-graphic-panel-media"
                onLoad={() => {
                  window.dispatchEvent(new Event("resize"));
                }}
              />
              <YardageArcOverlay
                contentRef={contentRef}
                yardageArcs={yardageArcs}
                visible={yardagesVisible}
              />
              <CameraPathOverlay
                contentRef={contentRef}
                cameraPath={cameraPath}
                progress={flyoverProgress}
                onPathSeek={onPathSeek}
                visible={trackerVisible}
              />
            </>
          ) : (
            <p className="course-hole-graphic-panel-empty">
              Upload a hole graphic in Sanity under Hole Flyovers for hole {holeNumber}.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
