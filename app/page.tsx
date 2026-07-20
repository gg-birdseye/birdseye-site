import Link from "next/link";
import { GetInTouchButton } from "@/components/GetInTouchButton";
import { HomeClientsSection } from "@/components/HomeClientsSection";
import { JsonLd } from "@/components/JsonLd";
import { LaunchDemoButton } from "@/components/LaunchDemoButton";
import { ScrollyVideoSection } from "@/components/ScrollyVideoSection";
import { SiteLogoHeader } from "@/components/SiteLogoHeader";
import {
  LANDING_INTRO_FRAMES,
  LANDING_INTRO_POSTER,
  LANDING_INTRO_VIDEO_SRC,
} from "@/lib/flyover-frames";
import {
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
} from "@/lib/seo/course-json-ld";
import { getSiteUrl } from "@/lib/seo/site";

export default function Home() {
  const videoSrc = LANDING_INTRO_VIDEO_SRC;
  const poster = LANDING_INTRO_POSTER;
  const siteUrl = getSiteUrl();

  return (
    <div className="min-h-screen">
      <JsonLd
        data={[
          buildWebsiteJsonLd(siteUrl),
          buildOrganizationJsonLd(siteUrl),
        ]}
      />
      <SiteLogoHeader />

      <main>
        <ScrollyVideoSection
          src={videoSrc}
          poster={poster}
          frames={LANDING_INTRO_FRAMES}
          disableEndOverlay
        />

        <HomeClientsSection />

        <div
          data-launch-demo
          className="pointer-events-none invisible fixed inset-0 z-[35] flex items-center justify-center opacity-0"
          aria-hidden
        >
          <LaunchDemoButton />
        </div>

        <section
          id="contact"
          className="scroll-mt-24 bg-[var(--surface-elevated)]"
        >
          <div className="mx-auto max-w-3xl px-4 py-20 text-center md:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              Let&apos;s grow the game
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-stone-300">
              Like what you see? Help us get in touch with courses that would
              like to be featured on Birdseye and you could be eligible to earn
              up to $400.
            </p>
            <Link
              href="/refer"
              className="mt-8 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold text-stone-100 backdrop-blur-sm transition hover:border-white/35 hover:bg-white/10"
            >
              Refer a Course
            </Link>

            <div className="mt-16">
              <GetInTouchButton />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[var(--surface-elevated)] py-10">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm md:px-6">
          <nav
            aria-label="Footer"
            className="mb-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
          >
            <Link
              href="/courses"
              className="text-stone-300 transition hover:text-white"
            >
              Courses
            </Link>
            <Link
              href="/refer"
              className="text-stone-300 transition hover:text-white"
            >
              Refer a Course
            </Link>
          </nav>
          <p className="text-white">© {new Date().getFullYear()} Birdseye</p>
        </div>
      </footer>
    </div>
  );
}
