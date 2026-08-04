import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["sanity-plugin-mux-input"],
  // Contract .docx files are read at runtime for DocuSign — include them in
  // serverless traces so Vercel deployments can find the templates.
  outputFileTracingIncludes: {
    "/*": ["./docs/legal/contracts/**/*"],
  },
  async redirects() {
    return [
      {
        source: "/example-course",
        destination: "/courses/example-course",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
