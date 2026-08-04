export type CameraPathPoint = {
  x: number;
  y: number;
  /**
   * How far through the flyover video this waypoint should be (0–100%).
   * Start is treated as 0 and end as 100. Midpoints should increase along the path.
   */
  videoProgress?: number;
};

export type CameraPathStop = CameraPathPoint & {
  progress: number;
};

export type CameraPathSample = {
  x: number;
  y: number;
  progress: number;
  angle: number;
};

const DEFAULT_STOP_INTERVAL = 0.1;
const SAMPLES_PER_SEGMENT = 12;

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

function parseVideoProgressPercent(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return Math.min(100, Math.max(0, raw));
}

/** Smooth curve through waypoints (Catmull-Rom, uniform t). */
function sampleSpline(
  points: CameraPathPoint[],
  samplesPerSegment = SAMPLES_PER_SEGMENT,
): Array<{ x: number; y: number }> {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ x: points[0].x, y: points[0].y }];
  if (points.length === 2) {
    const [a, b] = points;
    return Array.from({ length: samplesPerSegment + 1 }, (_, index) => {
      const t = index / samplesPerSegment;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    });
  }

  const samples: Array<{ x: number; y: number }> = [];
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
  samples.push({ x: points[points.length - 1].x, y: points[points.length - 1].y });
  return samples;
}

/**
 * Resolve absolute video progress (0–1) for each waypoint.
 * First = 0, last = 1. Midpoints use videoProgress % when set, otherwise even spacing.
 * Values are clamped so the sequence is non-decreasing.
 */
export function resolveWaypointProgresses(points: CameraPathPoint[]): number[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) return [0];

  const progresses = points.map((point, index) => {
    if (index === 0) return 0;
    if (index === n - 1) return 1;
    const percent = parseVideoProgressPercent(point.videoProgress);
    if (percent != null) return percent / 100;
    return index / (n - 1);
  });

  for (let i = 1; i < n; i += 1) {
    if (progresses[i] < progresses[i - 1]) {
      progresses[i] = progresses[i - 1];
    }
  }
  progresses[n - 1] = 1;
  progresses[0] = 0;

  return progresses;
}

type KeyframedPathTable = {
  samples: Array<{ x: number; y: number }>;
  samplesPerSegment: number;
  /** Absolute video progress (0–1) at each waypoint. */
  waypointProgresses: number[];
  segmentArcStarts: number[];
  segmentArcLengths: number[];
  sampleCumulative: number[];
  totalArc: number;
};

function buildKeyframedPathTable(points: CameraPathPoint[]): KeyframedPathTable {
  const samplesPerSegment = SAMPLES_PER_SEGMENT;
  const samples = sampleSpline(points, samplesPerSegment);
  const waypointProgresses = resolveWaypointProgresses(points);

  const sampleCumulative: number[] = [0];
  for (let i = 1; i < samples.length; i += 1) {
    sampleCumulative.push(
      sampleCumulative[i - 1] + dist(samples[i - 1], samples[i]),
    );
  }

  const segmentArcStarts: number[] = [];
  const segmentArcLengths: number[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const startIdx = i * samplesPerSegment;
    const endIdx = Math.min((i + 1) * samplesPerSegment, samples.length - 1);
    const startArc = sampleCumulative[startIdx] ?? 0;
    const endArc = sampleCumulative[endIdx] ?? startArc;
    segmentArcStarts.push(startArc);
    segmentArcLengths.push(Math.max(0, endArc - startArc));
  }

  return {
    samples,
    samplesPerSegment,
    waypointProgresses,
    segmentArcStarts,
    segmentArcLengths,
    sampleCumulative,
    totalArc: sampleCumulative[sampleCumulative.length - 1] ?? 0,
  };
}

function sampleAtArcLength(
  table: KeyframedPathTable,
  targetArc: number,
): { x: number; y: number; angle: number } {
  const { samples, sampleCumulative, totalArc } = table;
  if (samples.length === 0) return { x: 0, y: 0, angle: 0 };
  if (totalArc <= 0 || samples.length === 1) {
    return { x: samples[0].x, y: samples[0].y, angle: 0 };
  }

  const clampedArc = Math.min(totalArc, Math.max(0, targetArc));
  let index = sampleCumulative.findIndex((length) => length >= clampedArc);
  if (index <= 0) {
    const next = samples[1] ?? samples[0];
    const angle =
      Math.atan2(next.y - samples[0].y, next.x - samples[0].x) * (180 / Math.PI);
    return { x: samples[0].x, y: samples[0].y, angle };
  }
  if (index === -1) index = samples.length - 1;

  const lengthBefore = sampleCumulative[index - 1];
  const lengthAfter = sampleCumulative[index];
  const span = lengthAfter - lengthBefore;
  const localT = span > 0 ? (clampedArc - lengthBefore) / span : 0;
  const a = samples[index - 1];
  const b = samples[index];
  const x = a.x + (b.x - a.x) * localT;
  const y = a.y + (b.y - a.y) * localT;
  const angle = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
  return { x, y, angle };
}

function progressToTargetArc(table: KeyframedPathTable, progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  const { waypointProgresses, segmentArcStarts, segmentArcLengths } = table;
  if (waypointProgresses.length < 2) return 0;

  for (let i = 0; i < waypointProgresses.length - 1; i += 1) {
    const startP = waypointProgresses[i];
    const endP = waypointProgresses[i + 1];
    const span = endP - startP;

    if (clamped <= endP || i === waypointProgresses.length - 2) {
      const localU =
        span > 1e-9
          ? Math.min(1, Math.max(0, (clamped - startP) / span))
          : clamped >= endP
            ? 1
            : 0;
      return (segmentArcStarts[i] ?? 0) + localU * (segmentArcLengths[i] ?? 0);
    }
  }

  return table.totalArc;
}

function arcLengthToProgress(table: KeyframedPathTable, arcLength: number): number {
  if (table.totalArc <= 0 || table.waypointProgresses.length < 2) return 0;

  const clampedArc = Math.min(table.totalArc, Math.max(0, arcLength));

  for (let i = 0; i < table.segmentArcLengths.length; i += 1) {
    const segStart = table.segmentArcStarts[i] ?? 0;
    const segLen = table.segmentArcLengths[i] ?? 0;
    const segEnd = segStart + segLen;
    const startP = table.waypointProgresses[i] ?? 0;
    const endP = table.waypointProgresses[i + 1] ?? 1;

    if (clampedArc <= segEnd || i === table.segmentArcLengths.length - 1) {
      const localU =
        segLen > 0 ? Math.min(1, Math.max(0, (clampedArc - segStart) / segLen)) : 1;
      return Math.min(1, Math.max(0, startP + localU * (endP - startP)));
    }
  }

  return 1;
}

export function normalizeCameraPathPoints(
  points: CameraPathPoint[] | null | undefined,
): CameraPathPoint[] {
  if (!Array.isArray(points)) return [];
  return points
    .map((point) => {
      const videoProgress = parseVideoProgressPercent(point.videoProgress);
      return {
        x: typeof point.x === "number" ? point.x : NaN,
        y: typeof point.y === "number" ? point.y : NaN,
        ...(videoProgress != null ? { videoProgress } : {}),
      };
    })
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function cameraPathHasTrack(
  points: CameraPathPoint[] | null | undefined,
): boolean {
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
    return { x: normalized[0].x, y: normalized[0].y, progress: clamped, angle: 0 };
  }

  const table = buildKeyframedPathTable(normalized);
  const targetArc = progressToTargetArc(table, clamped);
  const sample = sampleAtArcLength(table, targetArc);
  return { x: sample.x, y: sample.y, progress: clamped, angle: sample.angle };
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
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
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
  const table = buildKeyframedPathTable(normalized);
  if (table.totalArc <= 0) return 0;

  let bestDistance = Infinity;
  let bestArc = 0;

  for (let i = 0; i < table.samples.length - 1; i += 1) {
    const a = table.samples[i];
    const b = table.samples[i + 1];
    const projected = projectPointOntoSegment(click, a, b);
    const distance = dist(click, projected);
    if (distance >= bestDistance) continue;

    bestDistance = distance;
    const segmentLength =
      table.sampleCumulative[i + 1] - table.sampleCumulative[i];
    const alongSegment =
      segmentLength > 0 ? dist(a, projected) / segmentLength : 0;
    bestArc = table.sampleCumulative[i] + alongSegment * segmentLength;
  }

  if (bestDistance > maxDistance) return null;

  return arcLengthToProgress(table, bestArc);
}
