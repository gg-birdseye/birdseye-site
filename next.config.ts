import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["sanity-plugin-mux-input"],
  // Contract .docx files are read at runtime for DocuSign — include them only
  // on the routes that load templates (not every serverless function).
  outputFileTracingIncludes: {
    "/api/onboarding/*/contract/docusign": ["./docs/legal/contracts/**/*"],
    "/api/onboarding/*/contract/sync": ["./docs/legal/contracts/**/*"],
  },
  async redirects() {
    return [
      {
        // Legacy course URLs → root slug pages
        source: "/courses/:slug",
        destination: "/:slug",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        // Course websites (e.g. Birch Creek) iframe this widget onto their own origin.
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
