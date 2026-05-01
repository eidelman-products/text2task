import type { MetadataRoute } from "next";

const siteUrl = "https://www.text2task.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/login",
          "/signup",
          "/contact",
          "/privacy",
          "/terms",
        ],
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/dashboard/profile",
          "/dashboard/billing",
          "/api/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}