import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/onboarding/", "/pricing", "/studio"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
