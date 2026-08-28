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
 * Server-rendered course copy for crawlers, assistive tech, and humans.
 * Lives below the interactive preview so Google gets real page content
 * without crowding the first viewport.
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
    <section
      className="border-t border-white/10 bg-[#1a1814] text-white"
      aria-label={`${title} course information`}
    >
      <div className="mx-auto max-w-3xl px-6 py-16 md:px-8 md:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
          Birdseye Golf
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          {title}
        </h1>
        {locationLabel ? (
          <p className="mt-2 text-base text-white/55 md:text-lg">
            {locationLabel}
          </p>
        ) : null}
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
          {description}
        </p>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
          Explore interactive aerial flyovers for all {holeCount} holes, with
          scorecard data and hole-by-hole preview powered by Birdseye.
        </p>

        <dl className="mt-10 space-y-3 text-sm text-white/65 md:text-base">
          {contact.addressLine ? (
            <div>
              <dt className="sr-only">Address</dt>
              <dd>
                {contact.mapsUrl || contact.appleMapsUrl ? (
                  <a
                    href={contact.mapsUrl || contact.appleMapsUrl || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-white/25 underline-offset-4 transition hover:text-white hover:decoration-white/60"
                  >
                    {contact.addressLine}
                  </a>
                ) : (
                  contact.addressLine
                )}
              </dd>
            </div>
          ) : null}
          {contact.phone && contact.phoneHref ? (
            <div>
              <dt className="sr-only">Phone</dt>
              <dd>
                <a
                  href={contact.phoneHref}
                  className="underline decoration-white/25 underline-offset-4 transition hover:text-white hover:decoration-white/60"
                >
                  {contact.phone}
                </a>
              </dd>
            </div>
          ) : null}
          {website ? (
            <div>
              <dt className="sr-only">Course website</dt>
              <dd>
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-white/25 underline-offset-4 transition hover:text-white hover:decoration-white/60"
                >
                  {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>

        <h2 className="mt-14 text-lg font-semibold tracking-tight text-white md:text-xl">
          Aerial flyovers for all {holeCount} holes
        </h2>
        {hasHoleBlurbs ? (
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-white/65 md:text-base">
            {holes.map((hole) => {
              const blurb = holeDescriptions[hole]?.trim();
              return (
                <li key={hole} className="pl-1">
                  <span className="font-medium text-white/80">Hole {hole}</span>
                  {blurb ? (
                    <span className="text-white/60"> — {blurb}</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-white/55 md:text-base">
            Use the interactive preview above to scrub through each hole’s
            aerial flyover before you tee off.
          </p>
        )}
      </div>
    </section>
  );
}
