import type { Metadata } from "next";
import { GetInTouchButton } from "@/components/GetInTouchButton";
import { PricingSection } from "@/components/PricingSection";
import { SiteLogoHeader } from "@/components/SiteLogoHeader";
import { parseHoleCount } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Birdseye | Pricing",
  description: "Birdseye pricing for golf courses.",
  robots: { index: false, follow: false },
};

const INCLUDED_FEATURES = [
  "Cinematic drone flyover video of every hole",
  "Interactive scroll-controlled flyover player",
  "Hole-by-hole layout graphics with live camera tracking",
  "Interactive aerial course map — zoom, pan, rotate, clickable hole markers",
  "Digital scorecard with yardage and handicap charts for every tee",
  "Instant hole selector across the full course",
  "Custom-branded course page with your logo",
  "Optimized layouts for desktop, tablet, and mobile",
  "Hosting, maintenance, and content updates included",
  "Easy content management",
  "Visitor analytics",
  "Shareable per-hole links (QR-code ready for on-course signage)",
];

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="mt-0.5 h-5 w-5 shrink-0 fill-birdseye-400"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.78-9.72a.75.75 0 0 0-1.06-1.06L9 10.94 7.28 9.22a.75.75 0 1 0-1.06 1.06l2.25 2.25c.3.3.77.3 1.06 0l4.25-4.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

type PricingPageProps = {
  searchParams: Promise<{ holes?: string }>;
};

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const { holes } = await searchParams;
  const holeCount = parseHoleCount(holes);

  return (
    <div className="min-h-screen bg-birdseye-950">
      <SiteLogoHeader />

      <div className="site-logo-page-content relative z-10 mx-auto max-w-5xl px-4 pb-24 md:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          PRICING
        </h1>
        <p className="mt-3 max-w-2xl text-stone-400">
          One plan, everything included. Give golfers a stunning preview of
          your course before they ever tee off.
        </p>

        <PricingSection holeCount={holeCount} />

        <div className="mt-14 rounded-2xl border border-white/10 bg-white/5 p-8 md:p-10">
          <h2 className="text-xl font-bold tracking-tight text-white md:text-2xl">
            Everything included
          </h2>
          <p className="mt-2 text-sm text-stone-400">
            Both plans come with the complete Birdseye experience for your
            course.
          </p>

          <ul className="mt-8 grid gap-x-8 gap-y-4 md:grid-cols-2">
            {INCLUDED_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-sm leading-relaxed text-stone-200">
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-16 text-center">
          <p className="mb-6 text-lg text-stone-300">
            Ready to bring your course to life?
          </p>
          <GetInTouchButton />
        </div>
      </div>
    </div>
  );
}
