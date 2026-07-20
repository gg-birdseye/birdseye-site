/** Frame sequence manifest + helpers for scroll-scrub canvas playback. */

export type FlyoverFrameSequence = {
  status?: "processing" | "ready" | "failed";
  manifestUrl?: string;
  frameCount?: number;
  fps?: number;
  version?: number;
} | null;

export type FrameManifest = {
  version: number;
  playbackId: string;
  fps: number;
  frameCount: number;
  width: number;
  height: number;
  format: "webp" | "jpeg" | "jpg" | "png";
  baseUrl: string;
};

export function framesAreReady(
  frames: FlyoverFrameSequence | undefined | null,
): frames is FlyoverFrameSequence & {
  status: "ready";
  manifestUrl: string;
} {
  return (
    frames?.status === "ready" &&
    typeof frames.manifestUrl === "string" &&
    frames.manifestUrl.length > 0
  );
}

/** Map scroll progress 0–1 to a frame index. */
export function progressToFrameIndex(
  progress: number,
  frameCount: number,
): number {
  if (frameCount <= 1) return 0;
  return Math.min(
    frameCount - 1,
    Math.max(0, Math.round(progress * (frameCount - 1))),
  );
}

/** Clamp a target frame index to the highest frame that has loaded. */
export function clampToLoadedFrameIndex(
  index: number,
  loadedCount: number,
): number {
  if (loadedCount <= 0) return 0;
  return Math.min(index, loadedCount - 1);
}

/** Map scroll progress to the best available loaded frame index. */
export function progressToLoadedFrameIndex(
  progress: number,
  frameCount: number,
  loadedCount: number,
): number {
  return clampToLoadedFrameIndex(
    progressToFrameIndex(progress, frameCount),
    loadedCount,
  );
}

/** Build frame URL from manifest (1-based frame numbers in filenames). */
export function frameUrl(manifest: FrameManifest, index: number): string {
  const n = index + 1;
  const pad = String(n).padStart(5, "0");
  const ext =
    manifest.format === "jpg" || manifest.format === "jpeg"
      ? "jpg"
      : manifest.format;
  const base = manifest.baseUrl.replace(/\/$/, "");
  return `${base}/${pad}.${ext}`;
}

/** Local / CDN manifest path for a Mux playback id. */
export function flyoverManifestUrl(playbackId: string): string {
  return `/frames/${playbackId}/manifest.json`;
}

/** Landing page hero — local MP4 + pre-extracted frame sequence. */
export const LANDING_INTRO_VIDEO_SRC = "/introvid.mp4";
export const LANDING_INTRO_FRAMES: FlyoverFrameSequence = {
  manifestUrl: flyoverManifestUrl("introvid"),
  /** Bump when re-running extract-frames for introvid.mp4 */
  version: 3,
};
export const LANDING_INTRO_POSTER = "/frames/introvid/00001.webp";

/** @deprecated Use flyoverManifestUrl */
export function devManifestUrl(playbackId: string): string {
  return flyoverManifestUrl(playbackId);
}

/** Resolve manifest URL from Sanity fields or the Mux video src. */
export function resolveFlyoverManifestUrl(
  frames: FlyoverFrameSequence | undefined | null,
  videoSrc?: string,
): string | null {
  const playbackId = videoSrc ? playbackIdFromVideoSrc(videoSrc) : null;
  const stored = frames?.manifestUrl;

  // Prefer stored URL only when it still matches the current Mux asset.
  if (stored && (!playbackId || stored.includes(playbackId))) {
    if (frames?.version != null && !stored.includes("?")) {
      return `${stored}?v=${frames.version}`;
    }
    return stored;
  }

  if (!playbackId) return null;
  return flyoverManifestUrl(playbackId);
}

/** Parse Mux static MP4 URL → playback id. */
export function playbackIdFromVideoSrc(src: string): string | null {
  const match = src.match(/stream\.mux\.com\/([^/.]+)/i);
  return match?.[1] ?? null;
}

export async function fetchFrameManifest(
  manifestUrl: string,
): Promise<FrameManifest> {
  const res = await fetch(manifestUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load frame manifest (${res.status})`);
  }
  const data = (await res.json()) as FrameManifest;
  if (
    !data.baseUrl ||
    !Number.isFinite(data.frameCount) ||
    data.frameCount < 1
  ) {
    throw new Error("Invalid frame manifest");
  }
  return data;
}
