import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { SiteLogoHeader } from "@/components/SiteLogoHeader";
import { getAdminSession, isAdminAuthConfigured } from "@/lib/admin-session";

export const metadata: Metadata = {
  title: "Birdseye | Admin Login",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (!isAdminAuthConfigured()) {
    return (
      <div className="min-h-screen bg-birdseye-950 px-4 py-24 text-center text-stone-300">
        Admin auth is not configured.
      </div>
    );
  }

  const session = await getAdminSession();
  if (session.isLoggedIn) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-birdseye-950">
      <SiteLogoHeader />
      <div className="site-logo-page-content mx-auto max-w-xl px-4 pb-24 md:px-6">
        <h1 className="text-3xl font-bold text-white">Admin sign in</h1>
        <AdminLoginForm />
      </div>
    </div>
  );
}
