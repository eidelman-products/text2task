import type { MetadataRoute } from "next";

const siteUrl = "https://www.text2task.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/contact",
          "/privacy",
          "/terms",
          "/signup",
          "/login",
          "/robots.txt",
          "/sitemap.xml",
        ],
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard",
          "/dashboard/",
          "/dashboard/*",
          "/check-email",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}