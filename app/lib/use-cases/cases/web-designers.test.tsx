// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { webDesignersUseCase } from "./web-designers";
import UseCaseDetailPage from "@/app/components/use-cases/use-case-detail-page";

/*
  2026-08-30 -- P2 Web Designers vs. Revisions Resource differentiation
  (SEO master blueprint, Section 13 -> Section 14 implementation record).
  Before this change, the Use Case's title/H1 led with "revision(s)" --
  the same narrow topic /resources/manage-client-revisions-web-designers
  already deeply owns. This suite protects the resulting invariants: the
  Use Case's identity is now broader (client requests -> organized website
  tasks, revisions as one part of that), it no longer echoes the Resource's
  H1, the existing bidirectional cross-link still exists, and no copy here
  implies automatic inbox/WhatsApp sync (Text2Task requires the user to
  paste/upload content -- it never connects to WhatsApp or monitors an
  inbox).
*/

const RESOURCE_H1 = "How Web Designers Can Manage Client Revisions Faster";

function renderUseCase() {
  return render(<UseCaseDetailPage useCase={webDesignersUseCase} />);
}

describe("web-designers Use Case - H1 identity after differentiation", () => {
  it("rendered H1 (hero.title + hero.highlight) reflects the broader client-request/task-workflow intent", () => {
    const { container } = renderUseCase();
    const h1 = container.querySelector("h1");

    expect(h1).not.toBeNull();
    expect(h1!.textContent).toBe("Turn client requests into organized website tasks.");
  });

  it("H1 does not lead with revision-only framing", () => {
    const { container } = renderUseCase();
    const h1 = container.querySelector("h1");

    expect(h1!.textContent?.toLowerCase().startsWith("revision")).toBe(false);
    expect(h1!.textContent?.toLowerCase()).not.toContain("revision email");
  });

  it("H1 is not near-identical to the Resource's H1", () => {
    const { container } = renderUseCase();
    const h1 = container.querySelector("h1");
    const useCaseH1 = (h1!.textContent ?? "").toLowerCase();

    expect(useCaseH1).not.toBe(RESOURCE_H1.toLowerCase());
    expect(useCaseH1).not.toContain("manage client revisions faster");
  });

  it("SEO title is distinct from the Resource's title and no longer narrows the page to revisions", () => {
    expect(webDesignersUseCase.seo.title).toBe(
      "Web Designer Task Management for Client Projects"
    );
    expect(webDesignersUseCase.seo.title.toLowerCase()).not.toContain("revision");
  });

  it("revision language still appears naturally (rebalanced, not erased)", () => {
    const { container } = renderUseCase();
    const text = (container.textContent ?? "").toLowerCase();

    expect(text).toContain("revision");
  });

  it("does not attempt to own \"freelancer project management software\" (no new cannibalization with the Solution page)", () => {
    const { container } = renderUseCase();
    const text = (container.textContent ?? "").toLowerCase();

    expect(text).not.toContain("freelancer project management software");
  });

  it("never implies automatic inbox monitoring or WhatsApp sync (product truth: paste/upload only)", () => {
    const { container } = renderUseCase();
    const text = (container.textContent ?? "").toLowerCase();

    for (const forbidden of [
      "connects to whatsapp",
      "syncs with whatsapp",
      "whatsapp integration",
      "monitors your inbox",
      "connects to your inbox",
      "automatically imports",
      "automatically saves",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("still links to the Revisions Resource (Use Case -> Resource relationship intact)", () => {
    const { container } = renderUseCase();
    const link = container.querySelector(
      'a[href="/resources/manage-client-revisions-web-designers"]'
    );

    expect(link).not.toBeNull();
  });
});
