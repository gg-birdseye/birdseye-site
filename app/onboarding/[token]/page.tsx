import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { SiteLogoHeader } from "@/components/SiteLogoHeader";
import { isDatabaseConfigured } from "@/lib/db";
import { getClientByTokenWithCourses } from "@/lib/onboarding/clients";

export const metadata: Metadata = {
  title: "Birdseye | Onboarding",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ checkout?: string; docusign?: string }>;
};

export default async function OnboardingPage({ params, searchParams }: Props) {
  if (!isDatabaseConfigured()) {
    return (
      <div className="min-h-screen bg-birdseye-950 px-4 py-24 text-center text-stone-300">
        Onboarding is not configured yet.
      </div>
    );
  }

  const { token } = await params;
  const { checkout, docusign } = await searchParams;

  let client;
  try {
    client = await getClientByTokenWithCourses(token);
  } catch (error) {
    console.error("Failed to load onboarding client:", error);
    return (
      <div className="min-h-screen bg-birdseye-950 px-4 py-24 text-center text-stone-300">
        <p>Unable to load onboarding right now. Please refresh and try again.</p>
      </div>
    );
  }

  if (!client) notFound();

  if (checkout === "success") {
    try {
      client = (await getClientByTokenWithCourses(token)) ?? client;
    } catch {
      // Keep the last loaded client if refresh fails after checkout.
    }
  }

  return (
    <div className="min-h-screen bg-birdseye-950">
      <SiteLogoHeader />
      <div className="site-logo-page-content relative z-10 mx-auto max-w-3xl px-4 pb-24 md:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          WELCOME TO BIRDSEYE
        </h1>
        <p className="mt-3 text-stone-400">
          Complete the steps below to activate your{" "}
          {client.courses && client.courses.length > 1 ? "course previews" : "course preview"}.
        </p>
        <OnboardingFlow
          client={client}
          checkoutStatus={checkout ?? null}
          docusignStatus={docusign ?? null}
        />
      </div>
    </div>
  );
}
