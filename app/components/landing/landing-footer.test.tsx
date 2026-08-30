// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import LandingFooter from "./landing-footer";

/*
  2026-08-30 -- P2 Project Deadline Calendar discovery reinforcement (SEO
  master blueprint, Section 15 -> Section 16 implementation record). First
  test file for this component. Project Deadline Calendar was the one
  sibling Feature page missing from the footer's Product links; this
  protects the resulting link, and that it appears exactly once alongside
  the other 5 Feature links this footer already carried.
*/

const FEATURE_HREFS = [
  "/features/email-to-tasks",
  "/features/screenshot-to-tasks",
  "/features/ai-task-extractor",
  "/features/client-feedback-to-tasks",
  "/features/client-project-tracker",
  "/features/project-deadline-calendar",
] as const;

describe("LandingFooter - Project Deadline Calendar discovery link", () => {
  it("renders \"Project deadline calendar\" with the exact href", () => {
    const { container } = render(<LandingFooter />);
    const link = container.querySelector(
      'a[href="/features/project-deadline-calendar"]'
    );

    expect(link).not.toBeNull();
    expect(link!.textContent).toBe("Project deadline calendar");
  });

  it("the Calendar footer link appears exactly once (no duplicate)", () => {
    const { container } = render(<LandingFooter />);
    const links = container.querySelectorAll(
      'a[href="/features/project-deadline-calendar"]'
    );

    expect(links).toHaveLength(1);
  });

  it("all 6 public Feature pages now have footer exposure, each exactly once", () => {
    const { container } = render(<LandingFooter />);

    for (const href of FEATURE_HREFS) {
      const links = container.querySelectorAll(`a[href="${href}"]`);
      expect(links).toHaveLength(1);
    }
  });
});
