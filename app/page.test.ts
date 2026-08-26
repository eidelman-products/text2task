import { describe, expect, it } from "vitest";

import {
  organizationJsonLd,
  websiteJsonLd,
  homepageWebPageJsonLd,
  structuredData,
} from "./page";
import { SITE_SCHEMA_ENTITY_IDS } from "./lib/schema";

/*
  2026-08-26 structured-data fix -- regression coverage for SEMrush's
  homepage-level invalid "SoftwareApplication" item: the object was
  emitted with no `aggregateRating`/`review`, and Text2Task has no
  legitimate, publicly-visible rating/review data to truthfully populate
  either field (see app/page.tsx's own header comment on this const block
  for the full trace through the customer-stories pipeline). The homepage
  now intentionally stops asserting SoftwareApplication entirely rather
  than emitting an incomplete or fabricated one.
*/

describe("Homepage structured data", () => {
  it("does not emit a SoftwareApplication entity anywhere in the homepage's JSON-LD graph", () => {
    const serialized = JSON.stringify(structuredData);
    expect(serialized).not.toContain("SoftwareApplication");
  });

  it("introduces no fake aggregateRating, review, reviewRating, offers, or pricing", () => {
    const serialized = JSON.stringify(structuredData);

    for (const forbiddenField of [
      "aggregateRating",
      "reviewRating",
      '"review"',
      '"offers"',
      "priceCurrency",
      "featureList",
    ]) {
      expect(serialized).not.toContain(forbiddenField);
    }
  });

  it("still emits a valid Organization entity", () => {
    expect(organizationJsonLd["@type"]).toBe("Organization");
    expect(organizationJsonLd["@id"]).toBe(SITE_SCHEMA_ENTITY_IDS.organization);
    expect(organizationJsonLd.name).toBe("Text2Task");
    expect(typeof organizationJsonLd.url).toBe("string");
  });

  it("still emits a valid WebSite entity, publishing to the same Organization", () => {
    expect(websiteJsonLd["@type"]).toBe("WebSite");
    expect(websiteJsonLd["@id"]).toBe(SITE_SCHEMA_ENTITY_IDS.website);
    expect(websiteJsonLd.publisher).toEqual({ "@id": SITE_SCHEMA_ENTITY_IDS.organization });
  });

  it("still emits a valid WebPage entity, no longer referencing a mainEntity/about SoftwareApplication", () => {
    expect(homepageWebPageJsonLd["@type"]).toBe("WebPage");
    expect(homepageWebPageJsonLd.isPartOf).toEqual({ "@id": SITE_SCHEMA_ENTITY_IDS.website });
    expect(homepageWebPageJsonLd.publisher).toEqual({ "@id": SITE_SCHEMA_ENTITY_IDS.organization });
    expect(homepageWebPageJsonLd).not.toHaveProperty("mainEntity");
    expect(homepageWebPageJsonLd).not.toHaveProperty("about");
  });

  it("the entity graph contains exactly Organization, WebSite, and WebPage -- no more, no fewer", () => {
    const graph = structuredData["@graph"] as ReadonlyArray<{ "@type": string }>;
    const types = graph.map((entity) => entity["@type"]).sort();

    expect(types).toEqual(["Organization", "WebPage", "WebSite"]);
  });

  it("the full structured-data payload is valid JSON (round-trips through JSON.stringify/parse unchanged)", () => {
    const serialized = JSON.stringify(structuredData);
    expect(() => JSON.parse(serialized)).not.toThrow();
    expect(JSON.parse(serialized)).toEqual(JSON.parse(JSON.stringify(structuredData)));
  });

  it("the graph's @context is schema.org", () => {
    expect(structuredData["@context"]).toBe("https://schema.org");
  });
});
