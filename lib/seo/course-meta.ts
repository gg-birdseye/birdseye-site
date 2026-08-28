import { US_STATES } from "@/lib/geo/us-states";

export type CourseSeoSource = {
  title?: string | null;
  city?: string | null;
  state?: string | null;
  holeCount?: number | null;
};

export type CourseSeoDefaults = {
  metaTitle: string;
  metaDescription: string;
};

/** Prefer full state names in public copy ("Utah") over abbreviations ("UT"). */
export function formatCourseLocationLabel(
  city?: string | null,
  state?: string | null,
): string | null {
  const cityLabel = city?.trim() || "";
  const rawState = state?.trim() || "";
  if (!cityLabel && !rawState) return null;

  const stateCode = rawState.toUpperCase();
  const stateName =
    US_STATES.find((entry) => entry.code === stateCode)?.name ||
    US_STATES.find(
      (entry) => entry.name.toLowerCase() === rawState.toLowerCase(),
    )?.name ||
    rawState;

  if (cityLabel && stateName) return `${cityLabel}, ${stateName}`;
  return cityLabel || stateName;
}

/** Shared defaults used by Studio autofill and the public site fallback. */
export function buildCourseSeoDefaults(
  source: CourseSeoSource,
): CourseSeoDefaults {
  const title = source.title?.trim() || "Golf Course";
  const location = formatCourseLocationLabel(source.city, source.state);
  const locationSuffix = location ? ` in ${location}` : "";
  const holeCount =
    typeof source.holeCount === "number" && source.holeCount > 0
      ? source.holeCount
      : 18;

  return {
    metaTitle: `${title} - Birdseye Golf`,
    metaDescription: `Take an interactive course preview of ${title}${locationSuffix}, complete with aerial hole flyovers of each of the ${holeCount} holes.`,
  };
}

export function resolveCourseSeo(options: {
  title?: string | null;
  city?: string | null;
  state?: string | null;
  holeCount?: number | null;
  seo?: {
    metaTitle?: string | null;
    metaDescription?: string | null;
  } | null;
}): CourseSeoDefaults {
  const defaults = buildCourseSeoDefaults({
    title: options.title,
    city: options.city,
    state: options.state,
    holeCount: options.holeCount,
  });

  return {
    metaTitle: options.seo?.metaTitle?.trim() || defaults.metaTitle,
    metaDescription:
      options.seo?.metaDescription?.trim() || defaults.metaDescription,
  };
}
