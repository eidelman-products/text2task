// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import HomepagePostExtractionSection from "./homepage-post-extraction-section";

/*
  2026-08-30 P1B -- protects the one homepage link to the Client Project
  Tracker Feature page added in this phase (SEO master blueprint, Section
  11, P1B record). This is the first test file for this component; kept
  minimal (href correctness only), not a full render/snapshot suite.
*/

describe("HomepagePostExtractionSection - P1B link", () => {
  it("links to the Client Project Tracker feature page", () => {
    const { container } = render(<HomepagePostExtractionSection />);
    const link = container.querySelector(
      'a[href="/features/client-project-tracker"]'
    );

    expect(link).not.toBeNull();
  });

  it("still links to the existing Work Calendar feature (P1B did not remove or alter prior capability links)", () => {
    const { container } = render(<HomepagePostExtractionSection />);
    const link = container.querySelector(
      'a[href="/features/project-deadline-calendar"]'
    );

    expect(link).not.toBeNull();
  });
});
