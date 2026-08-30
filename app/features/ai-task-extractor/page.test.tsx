// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import AiTaskExtractorPage, { metadata } from "./page";

/*
  2026-08-30 P3 -- first test file for this page. Protects the outcome of
  the AI Task Extractor copy-emphasis rebalance (SEO master blueprint,
  Section 17 audit -> Section 18 implementation record): the four required
  supporting-copy sentences (plus the optional FAQ answer) no longer lead
  with "client message(s)" as the default input example, while the page's
  locked identity (title, H1, worked example, review-before-save model)
  stays exactly as it was. Not a full content/snapshot suite.
*/

describe("AiTaskExtractorPage - locked identity unchanged by P3", () => {
  it("keeps the existing generic title", () => {
    expect(metadata.title).toBe(
      "AI Task Extractor: Extract Tasks and Action Items From Text"
    );
  });

  it("keeps the existing generic H1", () => {
    const { container } = render(<AiTaskExtractorPage />);
    const h1 = container.querySelector("h1");

    expect(h1).not.toBeNull();
    expect(h1!.textContent).toBe("Extract tasks and action items from text");
  });

  it("keeps the existing channel-neutral worked example", () => {
    const { container } = render(<AiTaskExtractorPage />);
    const example = container.querySelector("#example");

    expect(example?.textContent ?? "").toContain(
      "Website refresh for Acme."
    );
  });
});

describe("AiTaskExtractorPage - P3 copy-emphasis rebalance", () => {
  it("does not lead any supporting-copy sentence with \"client message(s)\" as the first word", () => {
    const { container } = render(<AiTaskExtractorPage />);
    const main = container.querySelector("main");
    const text = main?.textContent ?? "";

    // Every sentence boundary (start of string or after ./!/?) followed
    // immediately by "client message" or "client messages" would indicate
    // the pattern this phase exists to fix has regressed.
    const leadingClientMessage = /(^|[.!?]\s+)client messages?\b/i;
    expect(leadingClientMessage.test(text)).toBe(false);
  });

  it("still allows \"client message\" to appear, just not as the default leading example", () => {
    const { container } = render(<AiTaskExtractorPage />);
    const main = container.querySelector("main");
    const text = (main?.textContent ?? "").toLowerCase();
    const occurrences = text.split("client message").length - 1;

    expect(occurrences).toBeGreaterThan(0);
  });

  it("workflow step 1 leads with a neutral term, not \"client message\"", () => {
    const { container } = render(<AiTaskExtractorPage />);
    const stepText = Array.from(container.querySelectorAll("p")).find((p) =>
      p.textContent?.startsWith("Add the")
    );

    expect(stepText).toBeDefined();
    expect(stepText!.textContent).toBe(
      "Add the notes, brief, client message, or other text you want to organize."
    );
  });
});

describe("AiTaskExtractorPage - no unsafe product claims", () => {
  it("does not claim automatic inbox, email, or WhatsApp sync", () => {
    const { container } = render(<AiTaskExtractorPage />);
    const text = (container.textContent ?? "").toLowerCase();

    expect(text).not.toMatch(/inbox (monitoring|sync)/);
    expect(text).not.toMatch(/automatically (sync|connect)/);
    expect(text).not.toContain("whatsapp");
  });

  it("does not claim automatic saving without review", () => {
    const { container } = render(<AiTaskExtractorPage />);
    const text = (container.textContent ?? "").toLowerCase();

    expect(text).toContain("save or assign tasks automatically");
    expect(text).toContain("no. text2task creates a reviewable draft.");
  });
});

describe("AiTaskExtractorPage - related links unchanged", () => {
  it("still links to Email to Tasks", () => {
    const { container } = render(<AiTaskExtractorPage />);
    const link = container.querySelector('a[href="/features/email-to-tasks"]');

    expect(link).not.toBeNull();
  });

  it("still links to Screenshot to Tasks", () => {
    const { container } = render(<AiTaskExtractorPage />);
    const links = container.querySelectorAll(
      'a[href="/features/screenshot-to-tasks"]'
    );

    expect(links.length).toBeGreaterThan(0);
  });

  it("still links to the informational Resources it owns", () => {
    const { container } = render(<AiTaskExtractorPage />);

    expect(
      container.querySelector(
        'a[href="/resources/how-to-organize-client-requests-as-a-freelancer"]'
      )
    ).not.toBeNull();
    expect(
      container.querySelector(
        'a[href="/resources/how-to-extract-action-items-from-text"]'
      )
    ).not.toBeNull();
  });
});
