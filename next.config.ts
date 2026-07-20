import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["sanity-plugin-mux-input"],
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
