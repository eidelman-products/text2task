// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import FreelancerProjectManagementSoftwarePage, {
  metadata,
} from "./page";

/*
  2026-08-30 P1B -- first test file for this page. Kept narrow: it protects
  the one new reciprocal link to Client Project Tracker added in this
  phase (SEO master blueprint, Section 11, P1B record) and the invariants
  P1B explicitly promised not to disturb -- this page's locked primary
  identity ("freelancer project management software") and its H1/canonical.
  Not a full content/snapshot suite.
*/

describe("FreelancerProjectManagementSoftwarePage - P1B link", () => {
  it("links to the Client Project Tracker feature page", () => {
    const { container } = render(<FreelancerProjectManagementSoftwarePage />);
    const link = container.querySelector(
      'a[href="/features/client-project-tracker"]'
    );

    expect(link).not.toBeNull();
  });
});

/*
  2026-08-30 -- P2 Project Deadline Calendar discovery reinforcement (SEO
  master blueprint, Section 15 -> Section 16 implementation record).
  Project Deadline Calendar was the one sibling Feature missing from this
  page's featureLinks grid; this closes that gap.
*/
describe("FreelancerProjectManagementSoftwarePage - Project Deadline Calendar discovery link", () => {
  it("links to the Project Deadline Calendar feature page", () => {
    const { container } = render(<FreelancerProjectManagementSoftwarePage />);
    const link = container.querySelector(
      'a[href="/features/project-deadline-calendar"]'
    );

    expect(link).not.toBeNull();
  });
});

describe("FreelancerProjectManagementSoftwarePage - identity unchanged by P1B", () => {
  it("canonical and title still point at the locked route/identity", () => {
    expect(metadata.alternates?.canonical).toBe(
      "/solutions/freelancer-project-management-software"
    );
    expect(metadata.title).toBe("Freelancer Project Management Software");
  });

  it("H1 still leads with the locked primary keyword, not repositioned around Client Project Tracker", () => {
    const { container } = render(<FreelancerProjectManagementSoftwarePage />);
    const h1 = container.querySelector("h1");

    expect(h1).not.toBeNull();
    expect(h1!.textContent).toMatch(/freelancer project management software/i);
  });

  it("\"client project tracker\" is not keyword-stuffed within this page's own content (the site-wide footer, rendered on every page since P1A, is excluded from this count)", () => {
    const { container } = render(<FreelancerProjectManagementSoftwarePage />);
    const main = container.querySelector("main");
    const text = (main?.textContent ?? "").toLowerCase();
    const occurrences = text.split("client project tracker").length - 1;

    expect(occurrences).toBe(1);
  });
});
