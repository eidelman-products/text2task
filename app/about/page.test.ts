import { describe, expect, it } from "vitest";

import { aboutJsonLd, metadata } from "./page";
import { SITE_SCHEMA_ENTITY_IDS } from "../lib/schema";

describe("About page entity graph", () => {
  it("uses the canonical AboutPage id, URL, WebSite, and Organization references", () => {
    expect(aboutJsonLd["@context"]).toBe("https://schema.org");
    expect(aboutJsonLd["@type"]).toBe("AboutPage");
    expect(aboutJsonLd["@id"]).toBe("https://www.text2task.com/about#webpage");
    expect(aboutJsonLd.url).toBe("https://www.text2task.com/about");
    expect(aboutJsonLd.isPartOf).toEqual({ "@id": SITE_SCHEMA_ENTITY_IDS.website });
    expect(aboutJsonLd.publisher).toEqual({ "@id": SITE_SCHEMA_ENTITY_IDS.organization });
  });

  it("keeps the About metadata focused on the official Text2Task product", () => {
    expect(metadata.alternates?.canonical).toBe("/about");
    expect(metadata.description).toContain("official Text2Task product");
    expect(metadata.description).toContain("structured projects and tasks");
  });

  it("does not publish Person, founder, or personal-profile schema fields", () => {
    const serialized = JSON.stringify(aboutJsonLd);

    expect(serialized).not.toContain('"@type":"Person"');
    expect(serialized).not.toContain('"founder"');
    expect(serialized).not.toContain('"founders"');
    expect(serialized).not.toContain('"sameAs"');
  });

  it("does not reintroduce product or review schema on the About page", () => {
    const serialized = JSON.stringify(aboutJsonLd);

    for (const forbiddenField of [
      "SoftwareApplication",
      '"Product"',
      "aggregateRating",
      "reviewRating",
      '"review"',
    ]) {
      expect(serialized).not.toContain(forbiddenField);
    }
  });
});
