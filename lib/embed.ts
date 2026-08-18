import type { LandingZoneData } from "@/lib/landing-zone";
import type { CameraPathPoint, HoleGraphic } from "@/lib/sanity/courses";
import { absoluteUrl } from "@/lib/seo/site";

/** Showcase hole for course-website embeds (Birch Creek hole 16). */
export const EMBED_FEATURED_HOLE = 16;

export type CourseEmbedHole = {
  holeNumber: number;
  posterUrl: string;
  playbackId: string;
  previewSrc: string;
  par: number;
  holeGraphic?: HoleGraphic;
  cameraPath?: CameraPathPoint[];
  landingZone?: LandingZoneData;
};

export function pickEmbedHole<T extends { holeNumber: number }>(
  holes: T[],
  hasGraphic: (hole: T) => boolean,
): T | undefined {
  const featured = holes.find((hole) => hole.holeNumber === EMBED_FEATURED_HOLE);
  if (featured && hasGraphic(featured)) return featured;
  const withGraphic = holes.find(hasGraphic);
  return withGraphic ?? featured ?? holes[0];
}

/** Full interactive flyover URL, tagged so GA4 attributes visits from the iframe. */
export function courseFlyoverUrl(
  slug: string,
  hole?: number,
): string {
  const url = new URL(absoluteUrl(`/${slug}`));
  if (hole && hole > 0) {
    url.searchParams.set("hole", String(hole));
  }
  url.searchParams.set("utm_source", "course_website");
  url.searchParams.set("utm_medium", "iframe");
  url.searchParams.set("utm_campaign", slug);
  if (hole && hole > 0) {
    url.searchParams.set("utm_content", `hole-${hole}`);
  }
  return url.toString();
}

export function courseEmbedUrl(slug: string): string {
  return absoluteUrl(`/embed/${slug}`);
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Responsive iframe snippet a course can paste into WordPress / their CMS. */
export function courseEmbedSnippet(slug: string, courseTitle: string): string {
  const src = courseEmbedUrl(slug);
  const title = escapeHtmlAttr(`${courseTitle} interactive hole flyovers`);
  return `<div style="position:relative;width:100%;max-width:960px;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;background:#0a120e;">
  <iframe src="${src}" title="${title}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" loading="lazy" allow="autoplay; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>
</div>`;
}
