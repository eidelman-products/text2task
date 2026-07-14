import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_ORIGIN } from "@/app/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/use-cases",
          "/use-cases/",
          "/contact",
          "/about",
          "/privacy",
          "/terms",
        ],
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard",
          "/dashboard/",
          "/admin/",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_ORIGIN,
  };
}
