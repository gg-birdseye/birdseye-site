import "server-only";

import {
  arcClipIsReady,
  buildClippedCirclePath,
  pinToMediaPx,
  resolveArcAllowTest,
  sortMarkersByYards,
  yardageArcsAreReady,
  yardageMarkerRadiusPx,
} from "@/lib/yardage-arcs";
import {
  courseHoleGraphics,
  type CourseDoc,
  type HoleGraphicEntry,
  type YardageArcRender,
} from "@/lib/sanity/courses";
import { buildPlayableMaskFromSanityUrl } from "@/lib/yardage-mask-server";

function resolveSanityFileUrl(graphic: {
  src: string;
  cdnSrc?: string;
}): string | null {
  const direct = graphic.cdnSrc?.trim();
  if (direct) return direct;

  try {
    const parsed = new URL(graphic.src, "http://localhost");
    if (parsed.pathname.startsWith("/api/sanity-file")) {
      return parsed.searchParams.get("url");
    }
    if (
      parsed.hostname === "cdn.sanity.io" &&
      parsed.pathname.startsWith("/files/")
    ) {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Build clipped yardage arc SVG paths on the server (Sharp + green mask).
 * Client only renders the paths — no mask fetch required.
 */
export async function courseHoleGraphicsWithArcRenders(
  course: CourseDoc | null,
): Promise<HoleGraphicEntry[]> {
  const entries = courseHoleGraphics(course);
  if (entries.length === 0) return entries;

  await Promise.all(
    entries.map(async (entry) => {
      if (!yardageArcsAreReady(entry.yardageArcs)) return;

      try {
        const sanityUrl = resolveSanityFileUrl(entry.graphic);
        if (!sanityUrl) return;

        const mask = arcClipIsReady(entry.yardageArcs.arcClip)
          ? null
          : await buildPlayableMaskFromSanityUrl(sanityUrl);

        // If we needed a green mask and failed to build one, skip — client
        // would only draw full circles anyway.
        if (!arcClipIsReady(entry.yardageArcs.arcClip) && !mask) return;

        const width = mask?.width || 480;
        const height = mask?.height || 1080;
        const pin = entry.yardageArcs.pin;
        const center = pinToMediaPx(pin, width, height);
        const isAllowed = resolveArcAllowTest(
          entry.yardageArcs.arcClip,
          mask,
          width,
          height,
        );

        const paths = sortMarkersByYards(entry.yardageArcs.markers).map(
          (marker) => {
            const radius = yardageMarkerRadiusPx(pin, marker, width, height);
            return {
              yards: marker.yards,
              pathD: buildClippedCirclePath(
                center.x,
                center.y,
                radius,
                isAllowed,
                360,
              ),
              labelX: (marker.x / 100) * width,
              labelY: (marker.y / 100) * height,
            };
          },
        );

        const render: YardageArcRender = {
          width,
          height,
          pinX: center.x,
          pinY: center.y,
          paths,
        };
        entry.yardageArcRender = render;
      } catch (error) {
        console.error(
          "[courseHoleGraphicsWithArcRenders] hole",
          entry.holeNumber,
          error,
        );
      }
    }),
  );

  return entries;
}
