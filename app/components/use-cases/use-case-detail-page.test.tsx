// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import UseCaseDetailPage from "./use-case-detail-page";
import { getAllUseCases } from "@/app/lib/use-cases";
import type { UseCase } from "@/app/lib/use-cases";
import { SITE_SCHEMA_ENTITY_IDS } from "@/app/lib/schema";

/*
  2026-08-26 structured-data fix -- regression coverage for the defect
  that produced 12 of SEMrush's 13 reported invalid "SoftwareApplication"
  items. Every one of these Use Case pages shares this ONE template
  component (app/use-cases/[slug]/page.tsx -> UseCaseDetailPage), so this
  file is the single point of coverage that protects all 12 real routes
  plus any future Use Case added through the same config/template -- no
  need to duplicate this suite per page.
*/

function getJsonLdScripts(container: HTMLElement): Record<string, unknown>[] {
  const scripts = Array.from(
    container.querySelectorAll('script[type="application/ld+json"]')
  );

  return scripts.map((script) => JSON.parse(script.innerHTML) as Record<string, unknown>);
}

/** A synthetic, template-shaped Use Case -- not one of the 12 real,
 * already-fixed entries -- proving the TEMPLATE itself cannot produce
 * SoftwareApplication for any Use Case, existing or future, not merely
 * that today's specific 12 configs happen not to trigger it. */
function buildSyntheticUseCase(): UseCase {
  const real = getAllUseCases()[0];
  return {
    ...real,
    slug: "synthetic-future-use-case",
    seo: {
      title: "Synthetic Future Use Case | Text2Task",
      description: "A hypothetical future Use Case page added through the normal template/config.",
    },
    hero: {
      ...real.hero,
      title: "Synthetic",
      highlight: "Future Use Case",
    },
    relatedSlugs: [],
  };
}

describe("UseCaseDetailPage - structured data (shared template, all 12 real Use Cases)", () => {
  for (const useCase of getAllUseCases()) {
    it(`${useCase.slug}: emits no SoftwareApplication anywhere in its JSON-LD`, () => {
      const { container } = render(<UseCaseDetailPage useCase={useCase} />);
      const payloads = getJsonLdScripts(container);

      expect(payloads.length).toBeGreaterThan(0);

      for (const payload of payloads) {
        expect(JSON.stringify(payload)).not.toContain("SoftwareApplication");
      }
    });

    it(`${useCase.slug}: introduces no fake aggregateRating, review, reviewRating, offers, or pricing`, () => {
      const { container } = render(<UseCaseDetailPage useCase={useCase} />);
      const payloads = getJsonLdScripts(container);
      const serialized = JSON.stringify(payloads);

      for (const forbiddenField of [
        "aggregateRating",
        "reviewRating",
        '"review"',
        '"offers"',
        "priceCurrency",
      ]) {
        expect(serialized).not.toContain(forbiddenField);
      }
    });

    it(`${useCase.slug}: WebPage JSON-LD is present, valid, and references the site-wide WebSite/Organization by @id rather than duplicating them`, () => {
      const { container } = render(<UseCaseDetailPage useCase={useCase} />);
      const payloads = getJsonLdScripts(container);
      const webPage = payloads.find((p) => p["@type"] === "WebPage");

      expect(webPage).toBeDefined();
      expect(webPage!["@context"]).toBe("https://schema.org");
      expect(webPage!.isPartOf).toEqual({ "@id": SITE_SCHEMA_ENTITY_IDS.website });
      expect(webPage!.publisher).toEqual({ "@id": SITE_SCHEMA_ENTITY_IDS.organization });
      expect(webPage!.about).toBeUndefined();
      expect(webPage!.mainEntity).toBeUndefined();
    });

    it(`${useCase.slug}: BreadcrumbList JSON-LD is present and valid`, () => {
      const { container } = render(<UseCaseDetailPage useCase={useCase} />);
      const payloads = getJsonLdScripts(container);
      const breadcrumb = payloads.find((p) => p["@type"] === "BreadcrumbList");

      expect(breadcrumb).toBeDefined();
      expect(Array.isArray(breadcrumb!.itemListElement)).toBe(true);
      expect((breadcrumb!.itemListElement as unknown[]).length).toBeGreaterThanOrEqual(3);
    });
  }

  it("every emitted JSON-LD <script> tag contains syntactically valid JSON (no malformed structured data introduced)", () => {
    const useCase = getAllUseCases()[0];
    const { container } = render(<UseCaseDetailPage useCase={useCase} />);
    const scripts = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    );

    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(() => JSON.parse(script.innerHTML)).not.toThrow();
    }
  });
});

describe("UseCaseDetailPage - structured data (synthetic future Use Case, template-level guarantee)", () => {
  it("a brand-new Use Case added through the normal template/config does NOT automatically inherit SoftwareApplication schema", () => {
    const syntheticUseCase = buildSyntheticUseCase();
    const { container } = render(<UseCaseDetailPage useCase={syntheticUseCase} />);
    const payloads = getJsonLdScripts(container);

    expect(payloads.length).toBeGreaterThan(0);
    for (const payload of payloads) {
      expect(JSON.stringify(payload)).not.toContain("SoftwareApplication");
    }
  });

  it("a brand-new Use Case still gets a valid WebPage entity referencing the shared site-wide entities", () => {
    const syntheticUseCase = buildSyntheticUseCase();
    const { container } = render(<UseCaseDetailPage useCase={syntheticUseCase} />);
    const payloads = getJsonLdScripts(container);
    const webPage = payloads.find((p) => p["@type"] === "WebPage");

    expect(webPage).toBeDefined();
    expect(webPage!.name).toBe(syntheticUseCase.seo.title);
    expect(webPage!.isPartOf).toEqual({ "@id": SITE_SCHEMA_ENTITY_IDS.website });
  });
});
