export type CourseSeoSource = {
  title?: string | null;
  city?: string | null;
  state?: string | null;
};

export type CourseSeoDefaults = {
  metaTitle: string;
  metaDescription: string;
};

/** Shared defaults used by Studio autofill and the public site fallback. */
export function buildCourseSeoDefaults(
  source: CourseSeoSource,
): CourseSeoDefaults {
  const title = source.title?.trim() || "Golf Course";
  const locationBits = [source.city?.trim(), source.state?.trim()].filter(
    Boolean,
  );
  const locationSuffix =
    locationBits.length > 0 ? ` in ${locationBits.join(", ")}` : "";

  return {
    metaTitle: `${title} | BirdsEye`,
    metaDescription: `Explore ${title}${locationSuffix} with Birdseye — interactive aerial flyovers, scorecard data, and hole-by-hole preview before you tee off.`,
  };
}

export function resolveCourseSeo(options: {
  title?: string | null;
  city?: string | null;
  state?: string | null;
  seo?: {
    metaTitle?: string | null;
    metaDescription?: string | null;
  } | null;
}): CourseSeoDefaults {
  const defaults = buildCourseSeoDefaults({
    title: options.title,
    city: options.city,
    state: options.state,
  });

  return {
    metaTitle: options.seo?.metaTitle?.trim() || defaults.metaTitle,
    metaDescription:
      options.seo?.metaDescription?.trim() || defaults.metaDescription,
  };
}
