import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteLogoHeader } from "@/components/SiteLogoHeader";
import { getAdminSession, isAdminAuthConfigured } from "@/lib/admin-session";

export const metadata: Metadata = {
  title: "Birdseye | Admin",
  robots: { index: false, follow: false },
};

const adminSections = [
  {
    href: "/admin/onboarding",
    title: "Onboarding",
    description:
      "Manage client invitations, contracts, payments, and course setup.",
  },
  {
    href: "/admin/referrals",
    title: "Referrals",
    description:
      "Review referrals, verify contacts, release claims, and track rewards.",
  },
  {
    href: "/admin/analytics",
    title: "Course analytics",
    description:
      "Preview branded Google Analytics reports and email them to courses.",
  },
];

export default async function AdminPage() {
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

  return (
    <div className="min-h-screen bg-birdseye-950">
      <SiteLogoHeader />
      <main className="site-logo-page-content mx-auto max-w-4xl px-4 pb-24 md:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          ADMIN
        </h1>
        <p className="mt-3 text-stone-300">
          Choose an area to manage.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {adminSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group rounded-2xl border border-white/10 bg-black/20 p-6 transition hover:border-white/30 hover:bg-black/30"
            >
              <h2 className="text-xl font-semibold text-white">
                {section.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                {section.description}
              </p>
              <span className="mt-6 inline-flex text-sm font-semibold text-white">
                Open {section.title}
                <span
                  className="ml-2 transition-transform group-hover:translate-x-1"
                  aria-hidden
                >
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
