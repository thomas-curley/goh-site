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
      // Admin panel restructure: pages that were merged or moved. Temporary
      // (307) so they can be repointed if the structure changes again.
      { source: "/admin/events/list", destination: "/admin/events", permanent: false },
      { source: "/admin/bingo/list", destination: "/admin/bingo", permanent: false },
      { source: "/admin/attendance-export", destination: "/admin/raffles", permanent: false },
      { source: "/admin/guides", destination: "/admin", permanent: false },
      { source: "/admin/tutorials", destination: "/admin", permanent: false },
    ];
  },
};

export default nextConfig;
