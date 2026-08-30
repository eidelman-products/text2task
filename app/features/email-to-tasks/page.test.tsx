// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import EmailToTasksPage, { metadata } from "./page";

/*
  2026-08-30 -- Email Feature H1 commercial-framing differentiation.
  First test file for this page. The Feature's H1 previously echoed the
  Resource's own informational primary keyword closely enough that the SEO
  master blueprint (Section 3A) flagged it as a low-grade cannibalization
  risk ("H1 phrasing softly echoes the Resource's phrase -- cosmetic
  only"). This suite protects the resulting invariants: the Feature's H1
  no longer duplicates the Resource's "turn emails into tasks" phrasing,
  the Feature <-> Resource link relationship still exists, and no copy on
  this page implies automatic mailbox sync/ingestion (Text2Task requires
  the user to paste email text -- it never connects to Gmail/Outlook or
  monitors an inbox).
*/

describe("EmailToTasksPage - H1 commercial-framing differentiation", () => {
  it("H1 no longer duplicates the Resource's informational phrase \"turn emails into tasks\"", () => {
    const { container } = render(<EmailToTasksPage />);
    const h1 = container.querySelector("h1");

    expect(h1).not.toBeNull();
    expect(h1!.textContent?.toLowerCase()).not.toContain(
      "turn emails into tasks"
    );
  });

  it("H1 still describes the email-to-task capability in a natural, product-accurate way", () => {
    const { container } = render(<EmailToTasksPage />);
    const h1 = container.querySelector("h1");

    expect(h1!.textContent).toMatch(/email/i);
    expect(h1!.textContent).toMatch(/project|task/i);
  });

  it("title and canonical are unchanged (no evidence justified a metadata change)", () => {
    expect(metadata.title).toBe("Email to Tasks: Turn Emails Into Projects");
    expect(metadata.alternates?.canonical).toBe("/features/email-to-tasks");
  });

  it("never implies automatic mailbox sync or inbox monitoring (product truth: paste-only, no Gmail/Outlook connection)", () => {
    const { container } = render(<EmailToTasksPage />);
    const text = (container.textContent ?? "").toLowerCase();

    expect(text).toMatch(/paste/);
    for (const forbidden of [
      "connects to gmail",
      "connects to outlook",
      "syncs with your inbox",
      "automatically imports",
      "monitors your inbox",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("still links to the informational Resource (Feature <-> Resource relationship intact)", () => {
    const { container } = render(<EmailToTasksPage />);
    const link = container.querySelector(
      'a[href="/resources/how-to-turn-emails-into-tasks"]'
    );

    expect(link).not.toBeNull();
  });
});
