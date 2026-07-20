import { SiteLogoHeader } from "@/components/SiteLogoHeader";

type CourseUnavailableProps = {
  reason: "inactive" | "past_due";
};

export function CourseUnavailable({ reason }: CourseUnavailableProps) {
  const message =
    reason === "past_due"
      ? "This course preview is temporarily unavailable while a billing issue is resolved."
      : "This course preview is temporarily unavailable.";

  return (
    <div className="min-h-screen bg-birdseye-950">
      <SiteLogoHeader />
      <div className="site-logo-page-content mx-auto flex max-w-2xl flex-col items-center px-4 pb-24 pt-16 text-center md:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          Temporarily unavailable
        </h1>
        <p className="mt-4 text-stone-400">{message}</p>
        <p className="mt-2 text-sm text-stone-500">
          If you manage this course, please contact Birdseye to restore access.
        </p>
      </div>
    </div>
  );
}
