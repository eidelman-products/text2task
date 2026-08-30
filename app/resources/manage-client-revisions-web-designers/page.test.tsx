// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import ManageClientRevisionsWebDesignersPage, { metadata } from "./page";

/*
  2026-08-30 -- companion suite to the Web Designers Use Case
  differentiation (see app/lib/use-cases/cases/web-designers.test.tsx).
  This page itself was intentionally left unmodified (SEO master
  blueprint, Section 13.6/13.7: NO CHANGE). These assertions exist to
  prove that fact stays true over time -- its H1/title/description are
  unchanged, and its link back to the Use Case still exists.
*/

describe("ManageClientRevisionsWebDesignersPage - unchanged by the P2 differentiation", () => {
  it("H1 is unchanged", () => {
    const { container } = render(<ManageClientRevisionsWebDesignersPage />);
    const h1 = container.querySelector("h1");

    expect(h1).not.toBeNull();
    expect(h1!.textContent).toBe("How Web Designers Can Manage Client Revisions Faster");
  });

  it("title and canonical are unchanged", () => {
    expect(metadata.title).toBe("How Web Designers Can Manage Client Revisions Faster");
    expect(metadata.alternates?.canonical).toBe(
      "/resources/manage-client-revisions-web-designers"
    );
  });

  it("still links to the Web Designers Use Case (Resource -> Use Case relationship intact)", () => {
    const { container } = render(<ManageClientRevisionsWebDesignersPage />);
    const link = container.querySelector('a[href="/use-cases/web-designers"]');

    expect(link).not.toBeNull();
  });
});
