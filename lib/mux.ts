/** Mux playback + image URLs for stream.mux.com / image.mux.com */

export type MuxStaticRendition = "highest" | "1080p" | "1440p" | "2160p";

/**
 * Progressive MP4 for scroll-scrub players. HLS seeks poorly frame-by-frame;
 * a single MP4/WebM file matches local `public/` quality.
 * @see https://docs.mux.com/guides/video/enable-static-mp4-renditions
 */
export function muxStaticMp4Url(
  playbackId: string,
  rendition: MuxStaticRendition = "highest",
): string {
  return `https://stream.mux.com/${playbackId}/${rendition}.mp4`;
}

export function muxHlsUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}
export function muxPosterUrl(
  playbackId: string,
  thumbTimeSeconds: number | undefined,
): string {
  const t =
    thumbTimeSeconds != null &&
    Number.isFinite(thumbTimeSeconds) &&
    thumbTimeSeconds >= 0
      ? thumbTimeSeconds
      : 1;
  // Omit invalid fit values; `smart` is rejected by the Mux image API (use smartcrop if you need it).
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=1920&time=${t}`;
}

/** Short looping WebP clip for embed widgets (no autoplay policy, small payload). */
export function muxAnimatedPreviewUrl(
  playbackId: string,
  width = 960,
): string {
  const w = Math.min(1280, Math.max(320, Math.round(width)));
  return `https://image.mux.com/${playbackId}/animated.webp?width=${w}&fps=12`;
}
