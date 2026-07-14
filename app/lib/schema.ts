import { absoluteUrl } from "@/app/lib/site-config";

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
}>;

export type ArticleJsonLd = Readonly<{
  "@context": "https://schema.org";
  "@type": "Article";
  "@id": string;
  headline: string;
  description: string;
  url: string;
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
}: ArticleJsonLdInput): ArticleJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline,
    description,
    url,
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
