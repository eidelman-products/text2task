import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://text2task.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/pricing",
          "/use-cases",
          "/use-cases/",
          "/contact",
          "/privacy",
          "/terms",
        ],
        disallow: [
          "/api/",
          "/dashboard/",
          "/auth/",
          "/login",
          "/signup",
          "/check-email",
          "/reset-password",
          "/update-password",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}