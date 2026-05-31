import type { MetadataRoute } from "next";
import { getAllUseCases } from "@/app/lib/seo/use-cases";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.text2task.com";

const resourceRoutes = [
  {
    path: "/resources",
    priority: 0.82,
    changeFrequency: "weekly" as const,
  },
  {
    path: "/resources/how-to-organize-client-requests-as-a-freelancer",
    priority: 0.78,
    changeFrequency: "monthly" as const,
  },
  {
    path: "/resources/manage-client-revisions-web-designers",
    priority: 0.76,
    changeFrequency: "monthly" as const,
  },
  {
    path: "/resources/turn-client-messages-into-tasks",
    priority: 0.76,
    changeFrequency: "monthly" as const,
  },
];

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
      url: `${siteUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
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

  const resources: MetadataRoute.Sitemap = resourceRoutes.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  return [...publicRoutes, ...useCaseRoutes, ...resources];
}
