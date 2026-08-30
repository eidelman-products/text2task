// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import ProjectDeadlineCalendarPage, { metadata } from "./page";

/*
  2026-08-30 -- Final SEO Package Audit blocker fix (SEO master blueprint,
  Section 19 audit -> Section 20 resolution record). First test file for
  this page. The root layout applies title.template: "%s | Text2Task" to
  any plain-string page title. This page's own local title used to already
  contain "| Text2Task", so the rendered browser title doubled it to
  "... | Text2Task | Text2Task". These tests protect the fix: the page's
  own metadata.title must never itself carry the site suffix, and the
  composed final title (this page's title + the root template) must
  resolve to exactly one suffix. The root template string itself is
  duplicated here deliberately (not imported) so this test fails loudly if
  either side of the composition drifts, rather than passing by
  construction.
*/

const ROOT_TITLE_TEMPLATE = "%s | Text2Task";

function applyRootTitleTemplate(pageTitle: string): string {
  return ROOT_TITLE_TEMPLATE.replace("%s", pageTitle);
}

describe("ProjectDeadlineCalendarPage - title-template doubling fix", () => {
  it("the page's own local title does not itself end with the site suffix", () => {
    expect(metadata.title).not.toMatch(/\| Text2Task$/);
  });

  it("the page's own local title is exactly the unsuffixed string", () => {
    expect(metadata.title).toBe(
      "Project Deadline Calendar for Freelancers & Small Teams"
    );
  });

  it("composing the local title with the root template resolves to exactly one suffix", () => {
    const composed = applyRootTitleTemplate(metadata.title as string);

    expect(composed).toBe(
      "Project Deadline Calendar for Freelancers & Small Teams | Text2Task"
    );
    expect(composed).not.toMatch(/Text2Task.*Text2Task/);
  });

  it("OpenGraph and Twitter titles carry the full suffixed string exactly once (they do not inherit title.template)", () => {
    const expected =
      "Project Deadline Calendar for Freelancers & Small Teams | Text2Task";

    expect(metadata.openGraph?.title).toBe(expected);
    expect(metadata.twitter?.title).toBe(expected);
  });
});

describe("ProjectDeadlineCalendarPage - identity unchanged by the fix", () => {
  it("keeps the existing H1", () => {
    const { container } = render(<ProjectDeadlineCalendarPage />);
    const h1 = container.querySelector("h1");

    expect(h1).not.toBeNull();
    expect(h1!.textContent).toBe("A Project Deadline Calendar Built for Client Work");
  });

  it("keeps the existing canonical", () => {
    expect(metadata.alternates?.canonical).toBe(
      "/features/project-deadline-calendar"
    );
  });

  it("keeps the existing meta description", () => {
    expect(metadata.description).toBe(
      "Plan project deadlines, client work, and manual events in one clear calendar. Keep projects, clients, and scheduled work organized with Text2Task."
    );
  });
});
