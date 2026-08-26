import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "logo.clearbit.com",
      },
    ],
  },

  // 2026-08-26 -- Google Search Console reported a 404 for the legacy
  // static-site path /index.html (not referenced anywhere in this
  // codebase -- no internal link, sitemap entry, or canonical points to
  // it; a stale artifact from before this app existed, still crawled from
  // Google's historical index). This is the FIRST and only redirect
  // defined in this project -- no middleware.ts, no vercel.json redirect
  // rules, and no other redirects() entries exist, so this does not
  // create a second, competing redirect mechanism. Host/protocol
  // normalization (non-www -> www, HTTP -> HTTPS) is handled entirely by
  // Vercel's own domain configuration, outside this repository -- this
  // redirects() block only ever needs to resolve PATHS on whatever host
  // Vercel has already normalized the request to, so a relative
  // destination ("/") is correct and cannot itself introduce a redirect
  // chain or bypass that host-level normalization.
  async redirects() {
    return [
      {
        source: "/index.html",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
