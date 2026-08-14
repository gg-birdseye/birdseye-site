import {
  cameraPathHasTrack,
  sampleCameraPathAtProgress,
  type CameraPathPoint,
} from "@/lib/camera-path";

/** Percent coords (0–100) on the hole graphic. */
export type LandingZonePoint = {
  x: number;
  y: number;
};

export type LandingZoneTeePoint = LandingZonePoint & {
  teeIndex: number;
};

/**
 * Known distances at a fairway point — used to calibrate both legs of the ruler.
 * `yards` = distance to green center; `yardsFromTee` = distance to the furthest-back tee.
 */
export type LandingZoneMarker = LandingZonePoint & {
  yards: number;
  /** Optional: yards from furthest-back tee (preferred for tee→landing readouts). */
  yardsFromTee?: number;
};

export type GreenEdgeSide = "left" | "right" | "front" | "back";

/** Edge of the putting green with authored yards to green center. */
export type LandingZoneGreenEdge = LandingZonePoint & {
  side: GreenEdgeSide;
  yards: number;
};

export type LandingZoneData = {
  green: LandingZonePoint;
  tees: LandingZoneTeePoint[];
  markers: LandingZoneMarker[];
  /** Optional L/R/F/B green edges for near-green calibration + width/depth. */
  greenEdges?: LandingZoneGreenEdge[];
};

export const GREEN_EDGE_SIDES: GreenEdgeSide[] = [
  "front",
  "back",
  "left",
  "right",
];

export const GREEN_EDGE_LABELS: Record<GreenEdgeSide, string> = {
  front: "Front",
  back: "Back",
  left: "Left",
  right: "Right",
};

const STANDARD_YARDAGES = [50, 100, 150, 200, 250, 300, 350, 400];

function isFinitePoint(point: { x?: unknown; y?: unknown } | null | undefined): boolean {
  return (
    point != null &&
    Number.isFinite(Number(point.x)) &&
    Number.isFinite(Number(point.y))
  );
}

export function markerIsUsable(
  marker: LandingZoneMarker | null | undefined,
): marker is LandingZoneMarker {
  if (!marker) return false;
  if (!Number.isFinite(marker.yards) || marker.yards <= 0) return false;
  return Number.isFinite(marker.x) && Number.isFinite(marker.y);
}

export function greenEdgeIsUsable(
  edge: LandingZoneGreenEdge | null | undefined,
): edge is LandingZoneGreenEdge {
  if (!edge) return false;
  if (!GREEN_EDGE_SIDES.includes(edge.side)) return false;
  if (!Number.isFinite(edge.yards) || edge.yards <= 0) return false;
  return Number.isFinite(edge.x) && Number.isFinite(edge.y);
}

/**
 * Fairway markers + green-edge samples for distance-from-green calibration.
 * Edge points improve accuracy near and on the green.
 */
export function greenCalibrationMarkers(
  data: LandingZoneData,
): LandingZoneMarker[] {
  const fairway = (data.markers ?? []).filter(markerIsUsable);
  const edges = (data.greenEdges ?? [])
    .filter(greenEdgeIsUsable)
    .map((edge) => ({
      x: edge.x,
      y: edge.y,
      yards: edge.yards,
    }));
  return [...fairway, ...edges];
}

/** Width = left+right yards to center; depth = front+back. */
export function greenDimensions(
  edges: LandingZoneGreenEdge[] | null | undefined,
): { width: number; depth: number } | null {
  const list = (edges ?? []).filter(greenEdgeIsUsable);
  const bySide = new Map(list.map((edge) => [edge.side, edge] as const));
  const left = bySide.get("left");
  const right = bySide.get("right");
  const front = bySide.get("front");
  const back = bySide.get("back");

  const width =
    left && right ? Math.round(left.yards + right.yards) : null;
  const depth =
    front && back ? Math.round(front.yards + back.yards) : null;

  if (width == null && depth == null) return null;
  return {
    width: width ?? 0,
    depth: depth ?? 0,
  };
}

export function markerHasTeeYards(
  marker: LandingZoneMarker | null | undefined,
): marker is LandingZoneMarker & { yardsFromTee: number } {
  if (!markerIsUsable(marker)) return false;
  return Number.isFinite(marker.yardsFromTee) && (marker.yardsFromTee as number) >= 0;
}

export function landingZoneIsReady(
  data: LandingZoneData | null | undefined,
): data is LandingZoneData {
  if (!data || !isFinitePoint(data.green)) return false;
  const tees = (data.tees ?? []).filter(
    (tee) =>
      Number.isFinite(tee.teeIndex) &&
      Number.isFinite(tee.x) &&
      Number.isFinite(tee.y),
  );
  const markers = (data.markers ?? []).filter(markerIsUsable);
  return tees.length > 0 && markers.length > 0;
}

export function pointToMediaPx(
  point: LandingZonePoint,
  mediaWidth: number,
  mediaHeight: number,
): { x: number; y: number } {
  return {
    x: (point.x / 100) * mediaWidth,
    y: (point.y / 100) * mediaHeight,
  };
}

export function mediaPxDistance(
  a: LandingZonePoint,
  b: LandingZonePoint,
  mediaWidth: number,
  mediaHeight: number,
): number {
  const pa = pointToMediaPx(a, mediaWidth, mediaHeight);
  const pb = pointToMediaPx(b, mediaWidth, mediaHeight);
  return Math.hypot(pb.x - pa.x, pb.y - pa.y);
}

/** Prefer the selected tee; otherwise the nearest authored tee index. */
export function resolveLandingZoneTee(
  data: LandingZoneData,
  selectedTeeIndex: number,
): LandingZoneTeePoint {
  const tees = [...data.tees].filter(
    (tee) =>
      Number.isFinite(tee.teeIndex) &&
      Number.isFinite(tee.x) &&
      Number.isFinite(tee.y),
  );
  const exact = tees.find((tee) => tee.teeIndex === selectedTeeIndex);
  if (exact) return exact;
  tees.sort(
    (a, b) =>
      Math.abs(a.teeIndex - selectedTeeIndex) -
      Math.abs(b.teeIndex - selectedTeeIndex),
  );
  return tees[0]!;
}

/**
 * Furthest-back tee for marker calibration: authored tee farthest from the green
 * (percent-space). Ties keep the lower teeIndex.
 */
export function resolveFurthestBackTee(
  data: LandingZoneData,
): LandingZoneTeePoint | null {
  const green = data.green;
  const tees = (data.tees ?? []).filter(
    (tee) =>
      Number.isFinite(tee.teeIndex) &&
      Number.isFinite(tee.x) &&
      Number.isFinite(tee.y),
  );
  if (!green || tees.length === 0) return null;

  let best = tees[0]!;
  let bestDist = Math.hypot(best.x - green.x, best.y - green.y);

  for (let i = 1; i < tees.length; i += 1) {
    const tee = tees[i]!;
    const dist = Math.hypot(tee.x - green.x, tee.y - green.y);
    if (dist > bestDist || (dist === bestDist && tee.teeIndex < best.teeIndex)) {
      best = tee;
      bestDist = dist;
    }
  }

  return best;
}

/** Suggest the next common yardage not already used. */
export function suggestNextYardage(existing: number[]): number {
  const used = new Set(existing.filter((n) => Number.isFinite(n)));
  for (const yards of STANDARD_YARDAGES) {
    if (!used.has(yards)) return yards;
  }
  const max = existing.length ? Math.max(...existing) : 0;
  return Math.ceil((max + 50) / 50) * 50;
}

export function sortMarkersByYards(markers: LandingZoneMarker[]): LandingZoneMarker[] {
  return [...markers].sort((a, b) => a.yards - b.yards);
}

/**
 * Local yards-per-pixel at a point, from anchor→marker calibrations.
 * Inverse-distance weights are centered on `point`, so sitting on a marker
 * recovers that marker's scale.
 */
function localYardsPerPixelFromAnchor(
  point: LandingZonePoint,
  anchor: LandingZonePoint,
  markers: LandingZoneMarker[],
  yardsOf: (marker: LandingZoneMarker) => number | null | undefined,
  mediaWidth: number,
  mediaHeight: number,
): number | null {
  let weightSum = 0;
  let scaleSum = 0;

  for (const marker of markers) {
    if (!markerIsUsable(marker)) continue;
    const yards = yardsOf(marker);
    if (yards == null || !Number.isFinite(yards) || yards < 0) continue;

    const markerPx = mediaPxDistance(anchor, marker, mediaWidth, mediaHeight);
    if (markerPx < 0.5) continue;

    const scale = yards / markerPx;
    const dist = mediaPxDistance(point, marker, mediaWidth, mediaHeight);
    const weight = 1 / (dist * dist + 1);

    weightSum += weight;
    scaleSum += weight * scale;
  }

  if (weightSum <= 0) return null;
  return scaleSum / weightSum;
}

function yardsFromAnchorRaw(
  point: LandingZonePoint,
  anchor: LandingZonePoint,
  markers: LandingZoneMarker[],
  yardsOf: (marker: LandingZoneMarker) => number | null | undefined,
  mediaWidth: number,
  mediaHeight: number,
): number | null {
  const queryPx = mediaPxDistance(anchor, point, mediaWidth, mediaHeight);
  if (queryPx < 0.5) return 0;

  const scale = localYardsPerPixelFromAnchor(
    point,
    anchor,
    markers,
    yardsOf,
    mediaWidth,
    mediaHeight,
  );
  if (scale == null) return null;
  return queryPx * scale;
}

/**
 * Estimated yards from green center to `point`.
 * Authored markers are known distances from green — hovering on a marker
 * returns (approximately) that marker's yardage.
 */
export function yardsFromGreen(
  point: LandingZonePoint,
  green: LandingZonePoint,
  markers: LandingZoneMarker[],
  mediaWidth: number,
  mediaHeight: number,
): number | null {
  const raw = yardsFromAnchorRaw(
    point,
    green,
    markers,
    (marker) => marker.yards,
    mediaWidth,
    mediaHeight,
  );
  if (raw == null) return null;
  return Math.round(raw);
}

/**
 * Estimated yards from the calibration (furthest-back) tee to `point`,
 * using markers that include `yardsFromTee`.
 */
export function yardsFromCalibrationTee(
  point: LandingZonePoint,
  calibrationTee: LandingZonePoint,
  markers: LandingZoneMarker[],
  mediaWidth: number,
  mediaHeight: number,
): number | null {
  const usable = markers.filter(markerHasTeeYards);
  if (usable.length === 0) return null;

  const raw = yardsFromAnchorRaw(
    point,
    calibrationTee,
    usable,
    (marker) => marker.yardsFromTee,
    mediaWidth,
    mediaHeight,
  );
  if (raw == null) return null;
  return Math.round(raw);
}

/**
 * Yards from the selected tee to a landing point.
 * Prefers dual-authored tee distances: yardsFromTee(point) − yardsFromTee(selectedTee).
 * Falls back to green-distance difference when tee yards are not authored.
 */
export function yardsFromSelectedTee(
  selectedTee: LandingZonePoint,
  point: LandingZonePoint,
  green: LandingZonePoint,
  calibrationTee: LandingZonePoint | null,
  markers: LandingZoneMarker[],
  mediaWidth: number,
  mediaHeight: number,
): number | null {
  if (calibrationTee && markers.some(markerHasTeeYards)) {
    const pointFromBack = yardsFromAnchorRaw(
      point,
      calibrationTee,
      markers,
      (marker) => (markerHasTeeYards(marker) ? marker.yardsFromTee : null),
      mediaWidth,
      mediaHeight,
    );
    const teeFromBack = yardsFromAnchorRaw(
      selectedTee,
      calibrationTee,
      markers,
      (marker) => (markerHasTeeYards(marker) ? marker.yardsFromTee : null),
      mediaWidth,
      mediaHeight,
    );
    if (pointFromBack != null && teeFromBack != null) {
      return Math.max(0, Math.round(pointFromBack - teeFromBack));
    }
  }

  return yardsForSegment(
    selectedTee,
    point,
    green,
    markers,
    mediaWidth,
    mediaHeight,
  );
}

/**
 * Yards along a segment using green-centered marker calibrations.
 * Green→point uses interpolated distance-from-green; other segments use the
 * difference of each endpoint's distance-from-green.
 */
export function yardsForSegment(
  from: LandingZonePoint,
  to: LandingZonePoint,
  green: LandingZonePoint,
  markers: LandingZoneMarker[],
  mediaWidth: number,
  mediaHeight: number,
): number | null {
  const fromGreen = yardsFromAnchorRaw(
    from,
    green,
    markers,
    (marker) => marker.yards,
    mediaWidth,
    mediaHeight,
  );
  const toGreen = yardsFromAnchorRaw(
    to,
    green,
    markers,
    (marker) => marker.yards,
    mediaWidth,
    mediaHeight,
  );
  if (fromGreen == null || toGreen == null) return null;

  const toIsGreen = mediaPxDistance(to, green, mediaWidth, mediaHeight) < 0.5;
  const fromIsGreen = mediaPxDistance(from, green, mediaWidth, mediaHeight) < 0.5;
  if (toIsGreen) return Math.round(fromGreen);
  if (fromIsGreen) return Math.round(toGreen);

  return Math.max(0, Math.round(Math.abs(fromGreen - toGreen)));
}

export function midpointPercent(
  a: LandingZonePoint,
  b: LandingZonePoint,
): LandingZonePoint {
  return {
    x: Math.round(((a.x + b.x) / 2) * 10) / 10,
    y: Math.round(((a.y + b.y) / 2) * 10) / 10,
  };
}

/**
 * Find camera-path progress whose distance-to-green best matches the click point.
 * Prefer same yards-to-green over geometric nearest; on ties, prefer nearer to the click.
 */
export function progressAtMatchingGreenDistance(
  cameraPath: CameraPathPoint[] | null | undefined,
  click: LandingZonePoint,
  green: LandingZonePoint,
  markers: LandingZoneMarker[],
  mediaWidth: number,
  mediaHeight: number,
  { samples = 240 }: { samples?: number } = {},
): number | null {
  if (!cameraPathHasTrack(cameraPath)) return null;

  const targetYards = yardsFromAnchorRaw(
    click,
    green,
    markers,
    (marker) => marker.yards,
    mediaWidth,
    mediaHeight,
  );
  if (targetYards == null) return null;

  let bestProgress: number | null = null;
  let bestDiff = Infinity;
  let bestGeo = Infinity;

  for (let i = 0; i <= samples; i += 1) {
    const progress = i / samples;
    const sample = sampleCameraPathAtProgress(cameraPath, progress);
    if (!sample) continue;

    const yards = yardsFromAnchorRaw(
      { x: sample.x, y: sample.y },
      green,
      markers,
      (marker) => marker.yards,
      mediaWidth,
      mediaHeight,
    );
    if (yards == null) continue;

    const diff = Math.abs(yards - targetYards);
    const geo = Math.hypot(sample.x - click.x, sample.y - click.y);
    if (
      diff < bestDiff - 1e-6 ||
      (Math.abs(diff - bestDiff) <= 1e-6 && geo < bestGeo)
    ) {
      bestDiff = diff;
      bestGeo = geo;
      bestProgress = progress;
    }
  }

  return bestProgress;
}

/**
 * Normalize Sanity landingZone (or legacy yardageArcs pin/markers) into
 * runtime data. Returns null when not ready.
 */
export function resolveLandingZone(
  raw: unknown,
  legacyYardageArcs?: unknown,
): LandingZoneData | null {
  const source =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : null;
  const legacy =
    legacyYardageArcs && typeof legacyYardageArcs === "object"
      ? (legacyYardageArcs as Record<string, unknown>)
      : null;

  let green: LandingZonePoint | null = null;
  if (source?.green && isFinitePoint(source.green as LandingZonePoint)) {
    const g = source.green as LandingZonePoint;
    green = { x: Number(g.x), y: Number(g.y) };
  } else if (legacy?.pin && isFinitePoint(legacy.pin as LandingZonePoint)) {
    const pin = legacy.pin as LandingZonePoint;
    green = { x: Number(pin.x), y: Number(pin.y) };
  }

  const teesRaw = Array.isArray(source?.tees) ? source!.tees : [];
  const tees: LandingZoneTeePoint[] = [];
  for (const item of teesRaw) {
    if (!item || typeof item !== "object") continue;
    const tee = item as Partial<LandingZoneTeePoint>;
    if (
      !Number.isFinite(tee.teeIndex) ||
      !Number.isFinite(tee.x) ||
      !Number.isFinite(tee.y)
    ) {
      continue;
    }
    tees.push({
      teeIndex: Math.trunc(Number(tee.teeIndex)),
      x: Number(tee.x),
      y: Number(tee.y),
    });
  }

  const markersSource = Array.isArray(source?.markers)
    ? source!.markers
    : Array.isArray(legacy?.markers)
      ? legacy!.markers
      : [];
  const markers: LandingZoneMarker[] = [];
  for (const item of markersSource) {
    if (!item || typeof item !== "object") continue;
    const marker = item as Partial<LandingZoneMarker>;
    const next: LandingZoneMarker = {
      x: Number(marker.x),
      y: Number(marker.y),
      yards: Number(marker.yards),
    };
    if (Number.isFinite(Number(marker.yardsFromTee)) && Number(marker.yardsFromTee) >= 0) {
      next.yardsFromTee = Number(marker.yardsFromTee);
    }
    if (markerIsUsable(next)) markers.push(next);
  }

  const edgesRaw = Array.isArray(source?.greenEdges) ? source!.greenEdges : [];
  const greenEdges: LandingZoneGreenEdge[] = [];
  for (const item of edgesRaw) {
    if (!item || typeof item !== "object") continue;
    const edge = item as Partial<LandingZoneGreenEdge>;
    const side = edge.side as GreenEdgeSide;
    const next: LandingZoneGreenEdge = {
      side,
      x: Number(edge.x),
      y: Number(edge.y),
      yards: Number(edge.yards),
    };
    if (greenEdgeIsUsable(next)) greenEdges.push(next);
  }

  if (!green || tees.length === 0 || markers.length === 0) return null;
  return {
    green,
    tees,
    markers,
    ...(greenEdges.length > 0 ? { greenEdges } : {}),
  };
}
