import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_ORIGIN } from "@/app/lib/site-config";

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
          "/about",
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
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_ORIGIN,
  };
}
