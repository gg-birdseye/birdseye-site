import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteLogoHeader } from "@/components/SiteLogoHeader";
import { CourseAnalyticsAdmin } from "@/components/admin/CourseAnalyticsAdmin";
import { getAdminSession, isAdminAuthConfigured } from "@/lib/admin-session";
import { isGa4Configured } from "@/lib/ga4/client";
import { listReportableCourses } from "@/lib/ga4/send-course-reports";

export const metadata: Metadata = {
  title: "Birdseye | Course analytics",
  robots: { index: false, follow: false },
};

export default async function AdminAnalyticsPage() {
  if (!isAdminAuthConfigured()) {
    return (
      <div className="min-h-screen bg-birdseye-950 px-4 py-24 text-center text-stone-300">
        Admin auth is not configured.
      </div>
    );
  }

  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    redirect("/admin/login");
  }

  let courses: { slug: string; title: string }[] = [];
  try {
    courses = await listReportableCourses();
  } catch (error) {
    console.error("Failed to list courses for analytics:", error);
  }

  return (
    <div className="min-h-screen bg-birdseye-950">
      <SiteLogoHeader />
      <main className="site-logo-page-content mx-auto max-w-4xl px-4 pb-24 md:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          COURSE ANALYTICS
        </h1>
        <p className="mt-3 max-w-2xl text-stone-300">
          Branded HTML reports pulled live from Google Analytics. Preview a
          course, then email it. Active clients are sent last month&apos;s
          report automatically on the 1st.
        </p>
        <CourseAnalyticsAdmin
          courses={courses}
          ga4Configured={isGa4Configured()}
        />
      </main>
    </div>
  );
}
