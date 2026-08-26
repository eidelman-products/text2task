import { absoluteUrl } from "@/app/lib/site-config";

export const SITE_SCHEMA_ENTITY_IDS = {
  organization: absoluteUrl("/#organization"),
  website: absoluteUrl("/#website"),
  // 2026-08-26 -- softwareApplication removed. No page declares a
  // SoftwareApplication @type any more (removed from app/page.tsx for
  // lacking legitimate, publicly-visible aggregateRating/review data),
  // and the last remaining dangling @id references to this id (in
  // solutions/features/about) have been removed too -- this constant had
  // zero remaining references anywhere in the codebase. If Text2Task
  // later launches genuine, publicly-displayed customer ratings, re-add
  // a fresh id here alongside a truthful SoftwareApplication entity.
} as const;

export function buildWebPageEntityId(canonicalUrl: string): string {
  return `${canonicalUrl}#webpage`;
}

export type BreadcrumbListItemInput = Readonly<{
  name: string;
  url: string;
}>;

export type BreadcrumbListJsonLd = Readonly<{
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  "@id": string;
  itemListElement: ReadonlyArray<
    Readonly<{
      "@type": "ListItem";
      position: number;
      name: string;
      item: string;
    }>
  >;
}>;

export function buildBreadcrumbListJsonLd({
  currentCanonicalUrl,
  items,
}: Readonly<{
  currentCanonicalUrl: string;
  items: readonly BreadcrumbListItemInput[];
}>): BreadcrumbListJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${currentCanonicalUrl}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export type ArticleJsonLdInput = Readonly<{
  headline: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
}>;

export type ArticleJsonLd = Readonly<{
  "@context": "https://schema.org";
  "@type": "Article";
  "@id": string;
  headline: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  mainEntityOfPage: Readonly<{
    "@type": "WebPage";
    "@id": string;
    url: string;
  }>;
  publisher: Readonly<{
    "@id": string;
  }>;
}>;

export function buildArticleJsonLd({
  headline,
  description,
  url,
  datePublished,
  dateModified,
}: ArticleJsonLdInput): ArticleJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline,
    description,
    url,
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
    },
    publisher: {
      "@id": absoluteUrl("/#organization"),
    },
  };
}
