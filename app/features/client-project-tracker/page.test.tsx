// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import ClientProjectTrackerPage, {
  metadata,
  webPageJsonLd,
} from "./page";
import { SITE_SCHEMA_ENTITY_IDS } from "@/app/lib/schema";

/*
  2026-08-29 P1A -- this is the first per-Feature-page test file in the
  codebase (see the SEO master blueprint, Section 11.12/12.12). It exists
  because this page introduces a real invariant no sibling Feature page
  needs: the "must never claim" product-truth boundary from the master
  blueprint's Section 4.2/11.6/12.6 (Client Share is not a client account/
  login/portal/CRM system). A prior turn in this project already had to
  correct one real overstated public claim in production
  (commit 0d0f99a), so this suite encodes that boundary as an automated
  guardrail rather than relying on manual review alone.

  These assertions check RENDERED page text (what a visitor/crawler
  actually sees), not source comments, so a future edit that accidentally
  reintroduces forbidden language will fail here even if the surrounding
  prose is otherwise rewritten.
*/

function getJsonLdScripts(container: HTMLElement): Record<string, unknown>[] {
  const scripts = Array.from(
    container.querySelectorAll('script[type="application/ld+json"]')
  );

  return scripts.map((script) => JSON.parse(script.innerHTML) as Record<string, unknown>);
}

describe("ClientProjectTrackerPage - metadata", () => {
  it("canonical points to the locked P1A route", () => {
    expect(metadata.alternates?.canonical).toBe("/features/client-project-tracker");
  });

  it("title and description are non-empty and keyword-relevant without being identical boilerplate", () => {
    expect(metadata.title).toContain("Client Project Tracker");
    expect(typeof metadata.description).toBe("string");
    expect((metadata.description as string).length).toBeGreaterThan(20);
  });
});

describe("ClientProjectTrackerPage - rendered content", () => {
  it("renders an H1 aligned with the locked page-content blueprint intent", () => {
    const { container } = render(<ClientProjectTrackerPage />);
    const h1 = container.querySelector("h1");

    expect(h1).not.toBeNull();
    expect(h1!.textContent).toMatch(/share|status|progress/i);
  });

  it("never claims a client account, client login, client dashboard, or full client portal (Section 4.2 / 11.6 boundary)", () => {
    const { container } = render(<ClientProjectTrackerPage />);
    const text = (container.textContent ?? "").toLowerCase();

    for (const forbidden of [
      "client account",
      "client login",
      "client dashboard",
      "full client portal",
      "client portal",
      "crm",
      "helpdesk",
      "help desk",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("explicitly states no Text2Task account is required for the client (a safe claim the audit confirms)", () => {
    const { container } = render(<ClientProjectTrackerPage />);
    const text = container.textContent ?? "";

    expect(text).toMatch(/no text2task account|without a text2task account/i);
  });

  it("includes the required direction-explicit link to Client Feedback to Tasks (P1A-required per Cannibalization Rule 4)", () => {
    const { container } = render(<ClientProjectTrackerPage />);
    const link = container.querySelector(
      'a[href="/features/client-feedback-to-tasks"]'
    );

    expect(link).not.toBeNull();
  });

  it("renders visible FAQ content matching the FAQPage JSON-LD entry count (schema/content parity)", () => {
    const { container } = render(<ClientProjectTrackerPage />);
    const visibleFaqItems = container.querySelectorAll("details");
    const [faqPayload] = getJsonLdScripts(container).filter(
      (payload) => payload["@type"] === "FAQPage"
    );

    expect(visibleFaqItems.length).toBeGreaterThan(0);
    expect(Array.isArray(faqPayload.mainEntity)).toBe(true);
    expect((faqPayload.mainEntity as unknown[]).length).toBe(
      visibleFaqItems.length
    );
  });
});

/*
  2026-08-29 P1C -- these assertions were added when the two approved
  Client Share marketing visuals were integrated into the page. The
  expected alt text is hardcoded here (not imported from ./page) so that
  an accidental future change to either string is actually caught rather
  than compared against itself.
*/
const PRIMARY_IMAGE_FILENAME =
  "client-project-tracker-share-progress-with-clients.png";
const PRIMARY_IMAGE_ALT =
  "Client project tracker showing how project progress is shared with a client";
const SECONDARY_IMAGE_FILENAME = "client-share-project-link-management.png";
const SECONDARY_IMAGE_ALT =
  "Text2Task Client Share controls for managing a shared project link";

describe("ClientProjectTrackerPage - P1C visuals", () => {
  it("renders the primary showcase image from the correct relocated asset path with the required alt text", () => {
    const { container } = render(<ClientProjectTrackerPage />);
    const img = Array.from(container.querySelectorAll("img")).find(
      (el) => el.getAttribute("alt") === PRIMARY_IMAGE_ALT
    );

    expect(img).toBeDefined();
    expect(img!.getAttribute("src") ?? "").toContain(PRIMARY_IMAGE_FILENAME);
  });

  it("renders the secondary detail image from the correct relocated asset path with the required alt text", () => {
    const { container } = render(<ClientProjectTrackerPage />);
    const img = Array.from(container.querySelectorAll("img")).find(
      (el) => el.getAttribute("alt") === SECONDARY_IMAGE_ALT
    );

    expect(img).toBeDefined();
    expect(img!.getAttribute("src") ?? "").toContain(SECONDARY_IMAGE_FILENAME);
  });

  it("renders each P1C visual exactly once (no accidental duplicate)", () => {
    const { container } = render(<ClientProjectTrackerPage />);
    const images = Array.from(container.querySelectorAll("img"));

    expect(
      images.filter((el) => el.getAttribute("alt") === PRIMARY_IMAGE_ALT)
    ).toHaveLength(1);
    expect(
      images.filter((el) => el.getAttribute("alt") === SECONDARY_IMAGE_ALT)
    ).toHaveLength(1);
  });

  it("OpenGraph metadata references the primary showcase image (re-evaluated in P1C now that a real asset exists)", () => {
    const ogImages = metadata.openGraph?.images;
    const [ogImage] = Array.isArray(ogImages) ? ogImages : [ogImages];

    expect(JSON.stringify(ogImage)).toContain(PRIMARY_IMAGE_FILENAME);
    expect(JSON.stringify(ogImage)).toContain(PRIMARY_IMAGE_ALT);
  });

  it("Twitter metadata uses summary_large_image now that a real image is available", () => {
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(JSON.stringify(metadata.twitter)).toContain(PRIMARY_IMAGE_FILENAME);
  });
});

describe("ClientProjectTrackerPage - schema", () => {
  it("emits no SoftwareApplication type anywhere in its JSON-LD", () => {
    const { container } = render(<ClientProjectTrackerPage />);
    const payloads = getJsonLdScripts(container);

    for (const payload of payloads) {
      expect(JSON.stringify(payload)).not.toContain("SoftwareApplication");
    }
  });

  it("introduces no fake aggregateRating, review, reviewRating, offers, or pricing", () => {
    const { container } = render(<ClientProjectTrackerPage />);
    const serialized = JSON.stringify(getJsonLdScripts(container));

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

  it("webPageJsonLd has no mainEntity/about field and references the real site-wide entities by @id", () => {
    expect(webPageJsonLd).not.toHaveProperty("mainEntity");
    expect(webPageJsonLd).not.toHaveProperty("about");
    expect(webPageJsonLd.isPartOf).toEqual({ "@id": SITE_SCHEMA_ENTITY_IDS.website });
    expect(webPageJsonLd.publisher).toEqual({ "@id": SITE_SCHEMA_ENTITY_IDS.organization });
    expect(webPageJsonLd["@type"]).toBe("WebPage");
  });

  it("renders a 2-level BreadcrumbList (Home -> Client Project Tracker), matching the majority sibling pattern", () => {
    const { container } = render(<ClientProjectTrackerPage />);
    const [breadcrumb] = getJsonLdScripts(container).filter(
      (payload) => payload["@type"] === "BreadcrumbList"
    );

    expect(breadcrumb).toBeDefined();
    const items = breadcrumb.itemListElement as Array<{ name: string }>;
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe("Home");
    expect(items[1].name).toBe("Client Project Tracker");
  });

  it("round-trips through JSON.stringify/parse as valid JSON", () => {
    const { container } = render(<ClientProjectTrackerPage />);
    const payloads = getJsonLdScripts(container);

    expect(payloads.length).toBeGreaterThan(0);
    for (const payload of payloads) {
      expect(() => JSON.parse(JSON.stringify(payload))).not.toThrow();
    }
  });
});
