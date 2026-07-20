import "server-only";

import {
  arcClipIsReady,
  yardageArcsAreReady,
} from "@/lib/yardage-arcs";
import {
  courseHoleGraphics,
  type CourseDoc,
  type HoleGraphicEntry,
} from "@/lib/sanity/courses";
import { buildSerializedPlayableMaskForGraphicSrc } from "@/lib/yardage-mask-server";

/**
 * Like courseHoleGraphics, but embeds Sharp-built playable masks for holes
 * that have yardage arcs (so production clipping does not need a client fetch).
 *
 * Server-only: must not be imported from Client Components.
 */
export async function courseHoleGraphicsWithMasks(
  course: CourseDoc | null,
): Promise<HoleGraphicEntry[]> {
  const entries = courseHoleGraphics(course);
  if (entries.length === 0) return entries;

  await Promise.all(
    entries.map(async (entry) => {
      if (!yardageArcsAreReady(entry.yardageArcs)) return;
      if (arcClipIsReady(entry.yardageArcs.arcClip)) return;
      try {
        const mask = await buildSerializedPlayableMaskForGraphicSrc(
          entry.graphic.src,
        );
        if (mask) entry.playableMask = mask;
      } catch (error) {
        console.error(
          "[courseHoleGraphicsWithMasks] hole",
          entry.holeNumber,
          error,
        );
      }
    }),
  );

  return entries;
}
