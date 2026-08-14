/** Percent coords (0–100) on the hole graphic. */
export type LandingZonePoint = {
  x: number;
  y: number;
};

export type LandingZoneTeePoint = LandingZonePoint & {
  teeIndex: number;
};

/**
 * Known distance from green center — click a point that is e.g. 100 yd from
 * the pin and enter that yardage. Used to calibrate px→yards on skewed aerials.
 */
export type LandingZoneMarker = LandingZonePoint & {
  yards: number;
};

export type LandingZoneData = {
  green: LandingZonePoint;
  tees: LandingZoneTeePoint[];
  markers: LandingZoneMarker[];
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

function unitVector(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number } | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  return { x: dx / len, y: dy / len };
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
 * Estimate yards for a query segment using green-centered markers.
 * Each marker's yards/px (green → marker) contributes with inverse-distance
 * and orientation weighting so fairway-aligned markers dominate.
 */
export function yardsForSegment(
  from: LandingZonePoint,
  to: LandingZonePoint,
  green: LandingZonePoint,
  markers: LandingZoneMarker[],
  mediaWidth: number,
  mediaHeight: number,
): number | null {
  const queryPx = mediaPxDistance(from, to, mediaWidth, mediaHeight);
  if (queryPx < 0.5) return 0;

  const queryUnit = unitVector(from.x, from.y, to.x, to.y);
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  let weightSum = 0;
  let scaleSum = 0;

  for (const marker of markers) {
    if (!markerIsUsable(marker)) continue;
    const markerPx = mediaPxDistance(green, marker, mediaWidth, mediaHeight);
    if (markerPx < 0.5) continue;

    const scale = marker.yards / markerPx;
    const dist = Math.hypot(midX - marker.x, midY - marker.y);
    const distanceWeight = 1 / (dist * dist + 4);

    const markerUnit = unitVector(green.x, green.y, marker.x, marker.y);
    let orientationWeight = 1;
    if (queryUnit && markerUnit) {
      const alignment = Math.abs(
        queryUnit.x * markerUnit.x + queryUnit.y * markerUnit.y,
      );
      orientationWeight = 0.35 + 0.65 * alignment;
    }

    const weight = distanceWeight * orientationWeight;
    weightSum += weight;
    scaleSum += weight * scale;
  }

  if (weightSum <= 0) return null;
  return Math.round(queryPx * (scaleSum / weightSum));
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
    if (markerIsUsable(next)) markers.push(next);
  }

  if (!green || tees.length === 0 || markers.length === 0) return null;
  return { green, tees, markers };
}
