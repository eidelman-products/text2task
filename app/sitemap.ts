import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/app/lib/site-config";
import { getAllUseCases } from "@/app/lib/use-cases";

const resourceRoutes = [
  {
    path: "/resources",
    priority: 0.82,
    changeFrequency: "weekly" as const,
  },
  {
    path: "/resources/how-to-turn-emails-into-tasks",
    priority: 0.78,
    changeFrequency: "monthly" as const,
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

const solutionRoutes = [
  {
    path: "/solutions/freelancer-project-management-software",
    priority: 0.86,
    changeFrequency: "monthly" as const,
  },
];

const featureRoutes = [
  {
    path: "/features/email-to-tasks",
    priority: 0.84,
    changeFrequency: "monthly" as const,
  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const publicRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/use-cases"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/contact"),
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: absoluteUrl("/about"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/privacy"),
      changeFrequency: "yearly",
      priority: 0.35,
    },
    {
      url: absoluteUrl("/terms"),
      changeFrequency: "yearly",
      priority: 0.35,
    },
  ];

  const useCaseRoutes: MetadataRoute.Sitemap = getAllUseCases().map(
    (useCase) => ({
      url: absoluteUrl(`/use-cases/${useCase.slug}`),
      changeFrequency: "monthly",
      priority: useCase.slug === "web-designers" ? 0.9 : 0.78,
    }),
  );

  const resources: MetadataRoute.Sitemap = resourceRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const solutions: MetadataRoute.Sitemap = solutionRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const features: MetadataRoute.Sitemap = featureRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  return [
    ...publicRoutes,
    ...useCaseRoutes,
    ...resources,
    ...solutions,
    ...features,
  ];
}
