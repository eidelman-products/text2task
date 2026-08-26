import { describe, expect, it } from "vitest";

import { SITE_SCHEMA_ENTITY_IDS } from "./schema";
import { webPageJsonLd as solutionsFreelancerPmWebPageJsonLd } from "@/app/solutions/freelancer-project-management-software/page";
import { webPageJsonLd as aiTaskExtractorWebPageJsonLd } from "@/app/features/ai-task-extractor/page";
import { webPageJsonLd as screenshotToTasksWebPageJsonLd } from "@/app/features/screenshot-to-tasks/page";
import { webPageJsonLd as projectDeadlineCalendarWebPageJsonLd } from "@/app/features/project-deadline-calendar/page";
import { webPageJsonLd as emailToTasksWebPageJsonLd } from "@/app/features/email-to-tasks/page";
import { webPageJsonLd as clientFeedbackToTasksWebPageJsonLd } from "@/app/features/client-feedback-to-tasks/page";
import { aboutJsonLd } from "@/app/about/page";

/*
  2026-08-26 structured-data follow-up fix -- after removing the
  homepage's own invalid SoftwareApplication entity (see app/page.test.ts),
  six OTHER pages were left holding a dangling
  `{"@id": SITE_SCHEMA_ENTITY_IDS.softwareApplication}` reference in their
  own WebPage's `mainEntity` (or AboutPage's `about`) -- pointing at an
  entity no page declares a @type for any more. This suite protects
  against that class of defect returning: every page that previously held
  such a reference is asserted to no longer carry ANY mainEntity/about
  field at all (not replaced with a different schema merely to fill the
  field -- WebPage/AboutPage do not require either), and the underlying
  SITE_SCHEMA_ENTITY_IDS.softwareApplication constant itself is confirmed
  gone, so no future page can accidentally reintroduce a reference to it.
*/

const fixedPageWebPageJsonLds: ReadonlyArray<
  readonly [name: string, jsonLd: Record<string, unknown>]
> = [
  ["solutions/freelancer-project-management-software", solutionsFreelancerPmWebPageJsonLd],
  ["features/ai-task-extractor", aiTaskExtractorWebPageJsonLd],
  ["features/screenshot-to-tasks", screenshotToTasksWebPageJsonLd],
  ["features/project-deadline-calendar", projectDeadlineCalendarWebPageJsonLd],
  ["features/email-to-tasks", emailToTasksWebPageJsonLd],
  ["features/client-feedback-to-tasks", clientFeedbackToTasksWebPageJsonLd],
];

describe("SITE_SCHEMA_ENTITY_IDS - softwareApplication is fully removed", () => {
  it("SITE_SCHEMA_ENTITY_IDS no longer has a softwareApplication key at runtime", () => {
    expect(SITE_SCHEMA_ENTITY_IDS).not.toHaveProperty("softwareApplication");
  });

  it("SITE_SCHEMA_ENTITY_IDS retains its legitimate organization and website ids, unchanged", () => {
    expect(SITE_SCHEMA_ENTITY_IDS.organization).toContain("#organization");
    expect(SITE_SCHEMA_ENTITY_IDS.website).toContain("#website");
  });
});

describe.each(fixedPageWebPageJsonLds)(
  "%s - WebPage no longer references the removed SoftwareApplication entity",
  (_name, webPageJsonLd) => {
    it("has no mainEntity field at all (not replaced with a different schema merely to fill it)", () => {
      expect(webPageJsonLd).not.toHaveProperty("mainEntity");
    });

    it("has no about field at all", () => {
      expect(webPageJsonLd).not.toHaveProperty("about");
    });

    it("emits no SoftwareApplication type anywhere in its own JSON-LD", () => {
      expect(JSON.stringify(webPageJsonLd)).not.toContain("SoftwareApplication");
    });

    it("still emits no dangling reference to the removed softwareApplication id string", () => {
      expect(JSON.stringify(webPageJsonLd)).not.toContain("#softwareapplication");
    });

    it("still references the legitimate, real site-wide WebSite and Organization entities by @id", () => {
      expect(webPageJsonLd.isPartOf).toEqual({ "@id": SITE_SCHEMA_ENTITY_IDS.website });
      expect(webPageJsonLd.publisher).toEqual({ "@id": SITE_SCHEMA_ENTITY_IDS.organization });
    });

    it("is still a valid, well-typed WebPage entity", () => {
      expect(webPageJsonLd["@type"]).toBe("WebPage");
      expect(webPageJsonLd["@context"]).toBe("https://schema.org");
      expect(typeof webPageJsonLd.name).toBe("string");
      expect(typeof webPageJsonLd.url).toBe("string");
    });

    it("round-trips through JSON.stringify/parse as valid JSON", () => {
      expect(() => JSON.parse(JSON.stringify(webPageJsonLd))).not.toThrow();
    });
  }
);

describe("about/page.tsx - AboutPage no longer references the removed SoftwareApplication entity", () => {
  it("has no about field at all (not replaced with a different schema merely to fill it)", () => {
    expect(aboutJsonLd).not.toHaveProperty("about");
  });

  it("has no mainEntity field either", () => {
    expect(aboutJsonLd).not.toHaveProperty("mainEntity");
  });

  it("emits no SoftwareApplication type anywhere in its own JSON-LD", () => {
    expect(JSON.stringify(aboutJsonLd)).not.toContain("SoftwareApplication");
  });

  it("still references the legitimate, real site-wide WebSite and Organization entities by @id", () => {
    expect(aboutJsonLd.isPartOf).toEqual({ "@id": SITE_SCHEMA_ENTITY_IDS.website });
    expect(aboutJsonLd.publisher).toEqual({ "@id": SITE_SCHEMA_ENTITY_IDS.organization });
  });

  it("is still a valid, well-typed AboutPage entity", () => {
    expect(aboutJsonLd["@type"]).toBe("AboutPage");
    expect(aboutJsonLd["@context"]).toBe("https://schema.org");
  });

  it("round-trips through JSON.stringify/parse as valid JSON", () => {
    expect(() => JSON.parse(JSON.stringify(aboutJsonLd))).not.toThrow();
  });
});
