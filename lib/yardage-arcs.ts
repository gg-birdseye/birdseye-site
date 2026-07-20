export type YardageArcPin = {
  x: number;
  y: number;
};

export type YardageArcMarker = {
  x: number;
  y: number;
  yards: number;
};

/** Percent coords (0–100) defining a custom arc clip polygon. */
export type YardageArcClipPoint = {
  x: number;
  y: number;
};

export type YardageArcsData = {
  pin: YardageArcPin;
  markers: YardageArcMarker[];
  /**
   * Optional override: when 3+ points are set, arcs are clipped to this
   * polygon instead of the auto-detected green mask (replace mode).
   */
  arcClip?: YardageArcClipPoint[];
};

/** Binary playable-area mask in source-image pixel space. */
export type HoleGraphicPlayableMask = {
  width: number;
  height: number;
  /** 1 = playable green, 0 = outside */
  data: Uint8Array;
};

export function yardageArcsAreReady(
  data: YardageArcsData | null | undefined,
): data is YardageArcsData {
  return Boolean(
    data?.pin &&
      Number.isFinite(data.pin.x) &&
      Number.isFinite(data.pin.y) &&
      Array.isArray(data.markers) &&
      data.markers.length > 0,
  );
}

/** Pixel radius from pin → marker inside a media box. */
export function yardageMarkerRadiusPx(
  pin: YardageArcPin,
  marker: YardageArcMarker,
  mediaWidth: number,
  mediaHeight: number,
): number {
  const dx = ((marker.x - pin.x) / 100) * mediaWidth;
  const dy = ((marker.y - pin.y) / 100) * mediaHeight;
  return Math.hypot(dx, dy);
}

export function pinToMediaPx(
  pin: YardageArcPin,
  mediaWidth: number,
  mediaHeight: number,
): { x: number; y: number } {
  return {
    x: (pin.x / 100) * mediaWidth,
    y: (pin.y / 100) * mediaHeight,
  };
}

const STANDARD_YARDAGES = [50, 100, 150, 200, 250, 300, 350, 400];

/** Suggest the next common yardage not already used. */
export function suggestNextYardage(existing: number[]): number {
  const used = new Set(existing.filter((n) => Number.isFinite(n)));
  for (const yards of STANDARD_YARDAGES) {
    if (!used.has(yards)) return yards;
  }
  const max = existing.length ? Math.max(...existing) : 0;
  return Math.ceil((max + 50) / 50) * 50;
}

export function sortMarkersByYards<T extends YardageArcMarker>(
  markers: T[],
): T[] {
  return [...markers].sort((a, b) => a.yards - b.yards);
}

export function arcClipIsReady(
  clip: YardageArcClipPoint[] | null | undefined,
): clip is YardageArcClipPoint[] {
  return Boolean(
    Array.isArray(clip) &&
      clip.length >= 3 &&
      clip.every(
        (point) =>
          Number.isFinite(point.x) &&
          Number.isFinite(point.y) &&
          point.x >= 0 &&
          point.x <= 100 &&
          point.y >= 0 &&
          point.y <= 100,
      ),
  );
}

/** Ray-casting point-in-polygon test using percent-space vertices. */
export function pointInPercentPolygon(
  xPct: number,
  yPct: number,
  polygon: YardageArcClipPoint[],
): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects =
      yi > yPct !== yj > yPct &&
      xPct < ((xj - xi) * (yPct - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Prefer a custom clip polygon when ready; otherwise sample the auto green mask.
 * Returns null when neither is available (caller may draw a full circle).
 */
export function resolveArcAllowTest(
  clip: YardageArcClipPoint[] | null | undefined,
  mask: HoleGraphicPlayableMask | null,
  displayWidth: number,
  displayHeight: number,
): ((x: number, y: number) => boolean) | null {
  if (arcClipIsReady(clip)) {
    return (x, y) =>
      pointInPercentPolygon(
        (x / displayWidth) * 100,
        (y / displayHeight) * 100,
        clip,
      );
  }
  if (!mask || displayWidth <= 0 || displayHeight <= 0) return null;
  return (x, y) => samplePlayableMask(mask, x, y, displayWidth, displayHeight);
}

export function clipPolygonToSvgPoints(
  clip: YardageArcClipPoint[],
  displayWidth: number,
  displayHeight: number,
): string {
  return clip
    .map(
      (point) =>
        `${((point.x / 100) * displayWidth).toFixed(2)},${((point.y / 100) * displayHeight).toFixed(2)}`,
    )
    .join(" ");
}

/**
 * True when a pixel looks like turf / playable green (not gray panel, sand-only, etc.).
 */
function isPlayableGreenPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 24) return false;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Neutral gray / charcoal panel backgrounds.
  if (chroma < 18 && luminance < 140) return false;
  // Near-black fills.
  if (luminance < 42) return false;

  // Prefer green-dominant turf (covers olive → bright fairway greens).
  const greenLead = g - Math.max(r, b);
  if (g >= 48 && greenLead >= 8) return true;
  // Softer olive / muted fairway tones still green-led.
  if (g >= 56 && g >= r && g >= b && greenLead >= 2 && chroma >= 12) return true;

  return false;
}

function erodeBinaryMask(
  src: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  if (radius <= 0) return src;

  const dst = new Uint8Array(src.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!src[index]) {
        dst[index] = 0;
        continue;
      }

      let keep = 1;
      for (let dy = -radius; dy <= radius && keep; dy += 1) {
        for (let dx = -radius; dx <= radius && keep; dx += 1) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            keep = 0;
            break;
          }
          if (!src[ny * width + nx]) keep = 0;
        }
      }
      dst[index] = keep;
    }
  }
  return dst;
}

function samplePlayableMask(
  mask: HoleGraphicPlayableMask,
  displayX: number,
  displayY: number,
  displayWidth: number,
  displayHeight: number,
): boolean {
  if (displayWidth <= 0 || displayHeight <= 0) return false;
  const mx = Math.round((displayX / displayWidth) * (mask.width - 1));
  const my = Math.round((displayY / displayHeight) * (mask.height - 1));
  if (mx < 0 || my < 0 || mx >= mask.width || my >= mask.height) return false;
  return mask.data[my * mask.width + mx] === 1;
}

/**
 * Build a binary playable-area mask from raw RGBA (or RGB) pixel bytes.
 * Eroded slightly so arcs stop inside the green edge.
 * Safe for browser and Node (no DOM).
 */
export function buildPlayableMaskFromRgba(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  channels = 4,
): HoleGraphicPlayableMask | null {
  if (!width || !height || channels < 3) return null;
  if (pixels.length < width * height * channels) return null;

  const raw = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < raw.length; p += 1, i += channels) {
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const a = channels >= 4 ? (pixels[i + 3] ?? 255) : 255;
    raw[p] = isPlayableGreenPixel(r, g, b, a) ? 1 : 0;
  }

  const erodeRadius = Math.min(
    14,
    Math.max(3, Math.round(Math.min(width, height) * 0.006)),
  );

  return {
    width,
    height,
    data: erodeBinaryMask(raw, width, height, erodeRadius),
  };
}

/**
 * Build a binary playable-area mask from the hole graphic.
 * Eroded slightly so arcs stop inside the green edge.
 */
export function buildHoleGraphicPlayableMask(
  image: CanvasImageSource & { width?: number; height?: number },
  explicitWidth?: number,
  explicitHeight?: number,
): HoleGraphicPlayableMask | null {
  const width =
    explicitWidth ??
    (image instanceof HTMLImageElement
      ? image.naturalWidth
      : Number(image.width) || 0);
  const height =
    explicitHeight ??
    (image instanceof HTMLImageElement
      ? image.naturalHeight
      : Number(image.height) || 0);
  if (!width || !height) return null;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(image, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    return buildPlayableMaskFromRgba(
      imageData.data,
      width,
      height,
      4,
    );
  } catch {
    return null;
  }
}

export function deserializePlayableMask(payload: {
  width: number;
  height: number;
  data: string;
}): HoleGraphicPlayableMask | null {
  if (
    !payload ||
    !Number.isFinite(payload.width) ||
    !Number.isFinite(payload.height) ||
    payload.width < 1 ||
    payload.height < 1 ||
    typeof payload.data !== "string"
  ) {
    return null;
  }
  try {
    const binary = atob(payload.data);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      data[i] = binary.charCodeAt(i);
    }
    if (data.length < payload.width * payload.height) return null;
    return { width: payload.width, height: payload.height, data };
  } catch {
    return null;
  }
}

/** Pull the underlying Sanity CDN file URL out of a graphic src (proxy or direct). */
export function sanityFileUrlFromGraphicSrc(src: string): string | null {
  try {
    const parsed = new URL(
      src,
      typeof window !== "undefined" ? window.location.href : "http://localhost",
    );
    if (parsed.pathname.startsWith("/api/sanity-file")) {
      const nested = parsed.searchParams.get("url")?.trim();
      return nested || null;
    }
    if (
      parsed.hostname === "cdn.sanity.io" &&
      parsed.pathname.startsWith("/files/")
    ) {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Load the playable-area mask via a server API (Sharp rasterize).
 * Avoids browser CORS / Deployment Protection / SVG-canvas issues on Vercel.
 */
export async function buildHoleGraphicPlayableMaskFromUrl(
  src: string,
): Promise<HoleGraphicPlayableMask | null> {
  if (!src || typeof fetch === "undefined") return null;

  try {
    const sanityUrl = sanityFileUrlFromGraphicSrc(src);
    const endpoint = sanityUrl
      ? `/api/hole-graphic-mask?url=${encodeURIComponent(sanityUrl)}`
      : null;

    if (endpoint) {
      const response = await fetch(endpoint, {
        credentials: "same-origin",
      });
      if (response.ok) {
        const json = (await response.json()) as {
          width?: number;
          height?: number;
          data?: string;
        };
        if (
          typeof json.width === "number" &&
          typeof json.height === "number" &&
          typeof json.data === "string"
        ) {
          const mask = deserializePlayableMask({
            width: json.width,
            height: json.height,
            data: json.data,
          });
          if (mask) return mask;
        }
      }
    }

    // Local / fallback path: decode via blob when server mask is unavailable.
    return await buildHoleGraphicPlayableMaskFromBlobFetch(src);
  } catch {
    return null;
  }
}

async function buildHoleGraphicPlayableMaskFromBlobFetch(
  src: string,
): Promise<HoleGraphicPlayableMask | null> {
  try {
    const fetchUrl = toSameOriginSanityProxyUrl(src);
    const isSameOrigin =
      fetchUrl.startsWith("/") ||
      (typeof window !== "undefined" &&
        fetchUrl.startsWith(`${window.location.origin}/`));

    const response = await fetch(fetchUrl, {
      mode: "cors",
      credentials: isSameOrigin ? "same-origin" : "omit",
    });
    if (!response.ok) return null;

    const blob = await response.blob();

    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(blob);
        try {
          const mask = buildHoleGraphicPlayableMask(
            bitmap,
            bitmap.width,
            bitmap.height,
          );
          if (mask) return mask;
        } finally {
          bitmap.close();
        }
      } catch {
        // SVG blobs are not always supported by createImageBitmap.
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to decode hole graphic"));
        img.src = objectUrl;
      });
      return buildHoleGraphicPlayableMask(image);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

/** Rewrite Sanity CDN file URLs through our proxy when needed (client-side). */
function toSameOriginSanityProxyUrl(src: string): string {
  try {
    if (src.startsWith("/api/sanity-file?")) return src;
    const parsed = new URL(
      src,
      typeof window !== "undefined" ? window.location.href : "http://localhost",
    );
    if (parsed.pathname.startsWith("/api/sanity-file")) {
      return `${parsed.pathname}${parsed.search}`;
    }
    if (
      parsed.hostname === "cdn.sanity.io" &&
      parsed.pathname.startsWith("/files/")
    ) {
      return `/api/sanity-file?url=${encodeURIComponent(parsed.toString())}`;
    }
    return src;
  } catch {
    return src;
  }
}

/**
 * Trace a circle in display pixels and keep only segments allowed by `isAllowed`.
 * Hard on/off — no soft fade. When `isAllowed` is null, draws a full circle.
 */
export function buildClippedCirclePath(
  cx: number,
  cy: number,
  radius: number,
  isAllowed: ((x: number, y: number) => boolean) | null,
  sampleCount = 720,
): string {
  if (radius < 2) return "";

  if (!isAllowed) {
    // Fallback: full circle if clip/mask unavailable (e.g. CORS).
    return [
      `M ${cx + radius} ${cy}`,
      `A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy}`,
      `A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy}`,
    ].join(" ");
  }

  const points: { x: number; y: number; on: boolean }[] = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const angle = (i / sampleCount) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    points.push({
      x,
      y,
      on: isAllowed(x, y),
    });
  }

  const parts: string[] = [];
  let runStart: number | null = null;

  const flushRun = (start: number, endExclusive: number) => {
    if (endExclusive - start < 2) return;
    const first = points[start];
    const cmds = [`M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`];
    for (let i = start + 1; i < endExclusive; i += 1) {
      cmds.push(`L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`);
    }
    // Close wrap-around run that spans the seam.
    if (start === 0 && endExclusive === sampleCount && points[0].on) {
      cmds.push(`L ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`);
    }
    parts.push(cmds.join(" "));
  };

  for (let i = 0; i < sampleCount; i += 1) {
    if (points[i].on) {
      if (runStart == null) runStart = i;
    } else if (runStart != null) {
      flushRun(runStart, i);
      runStart = null;
    }
  }

  if (runStart != null) {
    // Merge wrap-around: if the circle starts "on", prepend into the first run.
    if (points[0].on && parts.length > 0) {
      const firstRunMatch = parts[0].match(/^M [\d.-]+ [\d.-]+(.*)$/);
      const wrapCmds = [`M ${points[runStart].x.toFixed(2)} ${points[runStart].y.toFixed(2)}`];
      for (let i = runStart + 1; i < sampleCount; i += 1) {
        wrapCmds.push(`L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`);
      }
      if (firstRunMatch) {
        parts[0] = `${wrapCmds.join(" ")}${firstRunMatch[1]}`;
      } else {
        flushRun(runStart, sampleCount);
      }
    } else {
      flushRun(runStart, sampleCount);
    }
  }

  return parts.join(" ");
}
