export type CameraPathPoint = {
  x: number;
  y: number;
};

export type CameraPathStop = CameraPathPoint & {
  progress: number;
};

export type CameraPathSample = CameraPathPoint & {
  progress: number;
  angle: number;
};

const DEFAULT_STOP_INTERVAL = 0.1;

function dist(a: CameraPathPoint, b: CameraPathPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

/** Smooth curve through waypoints (Catmull-Rom, uniform t). */
function sampleSpline(points: CameraPathPoint[], samplesPerSegment = 12): CameraPathPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [points[0]];
  if (points.length === 2) {
    const [a, b] = points;
    return Array.from({ length: samplesPerSegment + 1 }, (_, index) => {
      const t = index / samplesPerSegment;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    });
  }

  const samples: CameraPathPoint[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    for (let step = 0; step < samplesPerSegment; step += 1) {
      const t = step / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      samples.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  samples.push(points[points.length - 1]);
  return samples;
}

function buildArcTable(points: CameraPathPoint[]): {
  samples: CameraPathPoint[];
  cumulative: number[];
  total: number;
} {
  const samples = sampleSpline(points);
  const cumulative: number[] = [0];
  for (let i = 1; i < samples.length; i += 1) {
    cumulative.push(cumulative[i - 1] + dist(samples[i - 1], samples[i]));
  }
  return { samples, cumulative, total: cumulative[cumulative.length - 1] ?? 0 };
}

export function normalizeCameraPathPoints(
  points: CameraPathPoint[] | null | undefined,
): CameraPathPoint[] {
  if (!Array.isArray(points)) return [];
  return points
    .map((point) => ({
      x: typeof point.x === "number" ? point.x : NaN,
      y: typeof point.y === "number" ? point.y : NaN,
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function cameraPathHasTrack(points: CameraPathPoint[] | null | undefined): boolean {
  return normalizeCameraPathPoints(points).length >= 2;
}

export function sampleCameraPathAtProgress(
  points: CameraPathPoint[] | null | undefined,
  progress: number,
): CameraPathSample | null {
  const normalized = normalizeCameraPathPoints(points);
  if (normalized.length === 0) return null;

  const clamped = Math.min(1, Math.max(0, progress));
  if (normalized.length === 1) {
    return { ...normalized[0], progress: clamped, angle: 0 };
  }

  const { samples, cumulative, total } = buildArcTable(normalized);
  if (total <= 0) {
    return { ...normalized[0], progress: clamped, angle: 0 };
  }

  const target = clamped * total;
  let index = cumulative.findIndex((length) => length >= target);
  if (index <= 0) {
    const next = samples[1] ?? samples[0];
    const angle = Math.atan2(next.y - samples[0].y, next.x - samples[0].x) * (180 / Math.PI);
    return { ...samples[0], progress: clamped, angle };
  }
  if (index === -1) index = samples.length - 1;

  const lengthBefore = cumulative[index - 1];
  const lengthAfter = cumulative[index];
  const span = lengthAfter - lengthBefore;
  const localT = span > 0 ? (target - lengthBefore) / span : 0;
  const a = samples[index - 1];
  const b = samples[index];
  const x = a.x + (b.x - a.x) * localT;
  const y = a.y + (b.y - a.y) * localT;
  const angle = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);

  return { x, y, progress: clamped, angle };
}

export function buildAutoCameraPathStops(
  points: CameraPathPoint[] | null | undefined,
  interval = DEFAULT_STOP_INTERVAL,
): CameraPathStop[] {
  if (!cameraPathHasTrack(points)) return [];

  const stops: CameraPathStop[] = [];
  for (let progress = interval; progress < 1; progress += interval) {
    const rounded = Math.round(progress * 1000) / 1000;
    const sample = sampleCameraPathAtProgress(points, rounded);
    if (sample) stops.push({ progress: rounded, x: sample.x, y: sample.y });
  }

  const end = sampleCameraPathAtProgress(points, 1);
  if (end) stops.push({ progress: 1, x: end.x, y: end.y });

  return stops;
}

export function buildCameraPathPolyline(
  points: CameraPathPoint[] | null | undefined,
): string {
  const samples = sampleSpline(normalizeCameraPathPoints(points));
  if (samples.length === 0) return "";
  return samples
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function projectPointOntoSegment(
  point: CameraPathPoint,
  a: CameraPathPoint,
  b: CameraPathPoint,
): CameraPathPoint {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0) return a;
  const t = Math.min(
    1,
    Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq),
  );
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** Map a click (% coords on the hole graphic) to the nearest progress along the path. */
export function progressAtClosestPathPoint(
  points: CameraPathPoint[] | null | undefined,
  x: number,
  y: number,
  { maxDistance = 20 }: { maxDistance?: number } = {},
): number | null {
  const normalized = normalizeCameraPathPoints(points);
  if (normalized.length < 2) return null;

  const click = { x, y };
  const { samples, cumulative, total } = buildArcTable(normalized);
  if (total <= 0) return 0;

  let bestDistance = Infinity;
  let bestProgress = 0;

  for (let i = 0; i < samples.length - 1; i += 1) {
    const a = samples[i];
    const b = samples[i + 1];
    const projected = projectPointOntoSegment(click, a, b);
    const distance = dist(click, projected);
    if (distance >= bestDistance) continue;

    bestDistance = distance;
    const segmentLength = cumulative[i + 1] - cumulative[i];
    const alongSegment = segmentLength > 0 ? dist(a, projected) / segmentLength : 0;
    bestProgress = (cumulative[i] + alongSegment * segmentLength) / total;
  }

  if (bestDistance > maxDistance) return null;

  return Math.min(1, Math.max(0, bestProgress));
}
