import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "wiseoldman.net",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/guides/tools",
        destination: "/tools",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
