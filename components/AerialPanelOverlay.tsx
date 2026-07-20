"use client";

import { useEffect, useState } from "react";
import type { CourseAerialMapData } from "@/lib/sanity/courses";
import { PanelCloseButton } from "@/components/PanelCloseButton";
import { InteractiveAerialMap } from "@/components/InteractiveAerialMap";

type AerialPanelOverlayProps = {
  open: boolean;
  aerialMap?: CourseAerialMapData;
  activeHole?: number;
  onHoleSelect?: (hole: number) => void;
  onEnterHoleView?: () => void;
  onClose?: () => void;
};

export function AerialPanelOverlay({
  open,
  aerialMap,
  activeHole,
  onHoleSelect,
  onEnterHoleView,
  onClose,
}: AerialPanelOverlayProps) {
  const [showHoleMarkers, setShowHoleMarkers] = useState(false);
  const [transformKey, setTransformKey] = useState(0);

  const hotspots = aerialMap?.hotspots ?? [];
  const hasHotspots = hotspots.length > 0 && Boolean(onHoleSelect);

  useEffect(() => {
    if (open && hasHotspots) {
      setShowHoleMarkers(true);
    }
    if (!open) {
      setShowHoleMarkers(false);
      setTransformKey((key) => key + 1);
    }
  }, [open, hasHotspots]);

  if (!open) return null;

  return (
    <div
      className="course-aerial-panel pointer-events-auto"
      role="dialog"
      aria-label="Aerial map"
    >
      <div className="course-aerial-panel-inner">
        {aerialMap ? (
          <InteractiveAerialMap
            aerialMap={aerialMap}
            hotspots={hotspots}
            showHoleMarkers={showHoleMarkers}
            activeHole={activeHole}
            resetKey={transformKey}
            onHoleSelect={onHoleSelect}
            onEnterHoleView={onEnterHoleView}
            onClose={onClose}
            toolbarStart={
              hasHotspots ? (
                <div
                  className="course-aerial-view-toggle"
                  role="group"
                  aria-label="Aerial map view"
                >
                  <button
                    type="button"
                    className={`course-aerial-view-toggle-btn${showHoleMarkers ? "" : " is-active"}`}
                    aria-pressed={!showHoleMarkers}
                    onClick={() => setShowHoleMarkers(false)}
                  >
                    Map
                  </button>
                  <button
                    type="button"
                    className={`course-aerial-view-toggle-btn${showHoleMarkers ? " is-active" : ""}`}
                    aria-pressed={showHoleMarkers}
                    onClick={() => setShowHoleMarkers(true)}
                  >
                    Holes
                  </button>
                </div>
              ) : null
            }
          />
        ) : (
          <>
            <div className="course-aerial-panel-toolbar">
              <div className="course-aerial-panel-toolbar-start">
                {onEnterHoleView ? (
                  <button
                    type="button"
                    className="course-aerial-mode-btn"
                    onClick={onEnterHoleView}
                  >
                    Hole View
                  </button>
                ) : null}
              </div>
              <PanelCloseButton onClose={onClose} label="Close aerial panel" />
            </div>
            <p className="course-aerial-panel-empty">
              Aerial map placeholder — upload a map in Sanity under Course Details.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
