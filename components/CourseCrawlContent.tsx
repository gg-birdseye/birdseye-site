import type {
  CourseContactInfo,
  CourseHoleDescriptions,
} from "@/lib/sanity/courses";

type CourseCrawlContentProps = {
  title: string;
  description: string;
  holeCount: number;
  locationLabel?: string | null;
  contact: CourseContactInfo;
  websiteUrl?: string | null;
  holeDescriptions: CourseHoleDescriptions;
};

/**
 * Server-rendered course copy for crawlers. The interactive preview is a
 * client app with almost no HTML text; this summary gives Google real page
 * content to evaluate for indexing without affecting scroll or layout.
 */
export function CourseCrawlContent({
  title,
  description,
  holeCount,
  locationLabel,
  contact,
  websiteUrl,
  holeDescriptions,
}: CourseCrawlContentProps) {
  const holes = Array.from({ length: holeCount }, (_, index) => index + 1);
  const website = websiteUrl?.trim() || null;
  const hasHoleBlurbs = holes.some((hole) => holeDescriptions[hole]?.trim());

  return (
    <article className="sr-only" aria-label={`${title} course information`}>
      <h1>{title}</h1>
      {locationLabel ? <p>{locationLabel}</p> : null}
      <p>{description}</p>
      <p>
        Explore interactive aerial flyovers for all {holeCount} holes, with
        scorecard data and hole-by-hole preview powered by Birdseye.
      </p>

      {contact.addressLine ? <p>Address: {contact.addressLine}</p> : null}
      {contact.phone ? <p>Phone: {contact.phone}</p> : null}
      {website ? (
        <p>
          Course website:{" "}
          <a href={website} rel="noopener noreferrer">
            {website}
          </a>
        </p>
      ) : null}
      {contact.mapsUrl ? (
        <p>
          <a href={contact.mapsUrl} rel="noopener noreferrer">
            View on Google Maps
          </a>
        </p>
      ) : null}

      <h2>Aerial flyovers for all {holeCount} holes</h2>
      {hasHoleBlurbs ? (
        <ol>
          {holes.map((hole) => {
            const blurb = holeDescriptions[hole]?.trim();
            return (
              <li key={hole}>
                Hole {hole}
                {blurb ? `: ${blurb}` : ""}
              </li>
            );
          })}
        </ol>
      ) : (
        <p>
          Interactive aerial flyover preview for each hole before you tee off.
        </p>
      )}
    </article>
  );
}
