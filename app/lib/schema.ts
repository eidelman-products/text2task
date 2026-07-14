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
