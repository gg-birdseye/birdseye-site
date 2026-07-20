import type { Metadata } from "next";
import { ReferralForm } from "@/components/ReferralForm";
import { SiteLogoHeader } from "@/components/SiteLogoHeader";
import { REFERRAL_VERIFY_WINDOW_DAYS } from "@/lib/referrals/domain";

export const metadata: Metadata = {
  title: "Refer a Course | BirdsEye",
  description:
    "Refer a golf course to Birdseye and earn an e-gift card when they sign on.",
  alternates: { canonical: "/refer" },
  openGraph: {
    title: "Refer a Course | BirdsEye",
    description:
      "Refer a golf course to Birdseye and earn an e-gift card when they sign on.",
    type: "website",
    url: "/refer",
    siteName: "Birdseye",
  },
};

const REWARD_TIERS = [
  { holes: "9-hole course", amount: "$200" },
  { holes: "18-hole course", amount: "$300" },
  { holes: "27-hole course", amount: "$400" },
];

const HOW_IT_WORKS = [
  "Tell us about a course you'd love to see on Birdseye, including a club contact (head pro, GM, owner…) we can reach.",
  `We verify the contact and hold the course for you while we do — usually within ${REFERRAL_VERIFY_WINDOW_DAYS} days.`,
  "If the course signs on with Birdseye, you get an e-gift card to Titleist, PGA Superstore, or Amazon — your pick.",
];

export default function ReferPage() {
  return (
    <div className="min-h-screen bg-birdseye-950">
      <SiteLogoHeader />

      <div className="site-logo-page-content relative z-10 mx-auto max-w-3xl px-4 pb-24 md:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          REFER A COURSE
        </h1>
        <p className="mt-3 text-stone-400">
          Know a course that belongs on Birdseye? Be the first to refer it and
          earn an e-gift card when the course signs on.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {REWARD_TIERS.map((tier) => (
            <div
              key={tier.holes}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center"
            >
              <p className="text-2xl font-bold text-white">{tier.amount}</p>
              <p className="mt-1 text-sm text-stone-400">{tier.holes}</p>
            </div>
          ))}
        </div>

        <ol className="mt-8 space-y-3">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step} className="flex gap-3 text-stone-300">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-xs font-bold text-white">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-2xl border border-white/10 bg-[var(--surface)] p-6 md:p-8">
          <ReferralForm />
        </div>

        <p className="mt-6 text-sm text-stone-500">
          Only the first verified referral for a course is eligible for a
          reward. We hold a course while we verify the club contact. If
          we&apos;re unable to reach a valid contact, the referral is released
          and the course is reopen to referrals. Courses already featured on
          Birdseye or in our pipeline are not eligible. Rewards are paid when
          the referred course signs on.
        </p>
      </div>
    </div>
  );
}
