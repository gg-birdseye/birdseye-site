import type { CourseDoc } from "@/lib/sanity/courses";

type JsonLd = Record<string, unknown>;

/** schema.org GolfCourse payload for course detail pages. */
export function buildGolfCourseJsonLd(options: {
  course: CourseDoc;
  url: string;
  image?: string;
  description: string;
}): JsonLd {
  const { course, url, image, description } = options;
  const name = course.title?.trim() || "Golf Course";
  const address = course.address;

  const postalAddress =
    address &&
    (address.line1 || address.city || address.state || address.postalCode)
      ? {
          "@type": "PostalAddress",
          ...(address.line1?.trim()
            ? { streetAddress: address.line1.trim() }
            : {}),
          ...(address.city?.trim()
            ? { addressLocality: address.city.trim() }
            : {}),
          ...(address.state?.trim()
            ? { addressRegion: address.state.trim() }
            : {}),
          ...(address.postalCode?.trim()
            ? { postalCode: address.postalCode.trim() }
            : {}),
          addressCountry: "US",
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "GolfCourse",
    name,
    description,
    url,
    ...(image ? { image } : {}),
    ...(course.phone?.trim() ? { telephone: course.phone.trim() } : {}),
    ...(course.websiteUrl?.trim()
      ? { sameAs: [course.websiteUrl.trim()] }
      : {}),
    ...(postalAddress ? { address: postalAddress } : {}),
    ...(typeof course.holeCount === "number"
      ? {
          amenityFeature: {
            "@type": "LocationFeatureSpecification",
            name: "Holes",
            value: course.holeCount,
          },
        }
      : {}),
  };
}

export function buildWebsiteJsonLd(siteUrl: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Birdseye",
    url: siteUrl,
    description:
      "Interactive aerial golf course previews golfers can explore before they tee off.",
  };
}

export function buildOrganizationJsonLd(siteUrl: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Birdseye",
    url: siteUrl,
    logo: `${siteUrl}/logo1.svg`,
  };
}
