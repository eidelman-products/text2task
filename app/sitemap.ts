import type { MetadataRoute } from "next";
import { getAllUseCases } from "@/app/lib/seo/use-cases";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://text2task.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const publicRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/use-cases`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.35,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.35,
    },
  ];

  const useCaseRoutes: MetadataRoute.Sitemap = getAllUseCases().map(
    (useCase) => ({
      url: `${siteUrl}/use-cases/${useCase.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: useCase.slug === "web-designers" ? 0.9 : 0.78,
    }),
  );

  return [...publicRoutes, ...useCaseRoutes];
}