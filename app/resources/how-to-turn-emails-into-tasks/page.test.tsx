// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import HowToTurnEmailsIntoTasksPage, { metadata } from "./page";

/*
  2026-08-30 -- companion suite to the Email Feature H1 differentiation
  change (see app/features/email-to-tasks/page.test.tsx). This page itself
  was intentionally left unmodified; these assertions exist to prove that
  fact stays true over time -- its informational H1/title/canonical are
  unchanged, and its link back to the Feature page still exists.
*/

describe("HowToTurnEmailsIntoTasksPage - informational identity unchanged", () => {
  it("H1 is unchanged and remains informational (\"how to\" framing)", () => {
    const { container } = render(<HowToTurnEmailsIntoTasksPage />);
    const h1 = container.querySelector("h1");

    expect(h1).not.toBeNull();
    expect(h1!.textContent).toBe(
      "How to turn emails into tasks without losing project context"
    );
  });

  it("title and canonical are unchanged", () => {
    expect(metadata.title).toBe(
      "How to Turn Emails Into Tasks: A Practical Workflow"
    );
    expect(metadata.alternates?.canonical).toBe(
      "/resources/how-to-turn-emails-into-tasks"
    );
  });

  it("still links to the commercial Feature page (Resource <-> Feature relationship intact)", () => {
    const { container } = render(<HowToTurnEmailsIntoTasksPage />);
    const link = container.querySelector('a[href="/features/email-to-tasks"]');

    expect(link).not.toBeNull();
  });
});
