// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Homepage, { structuredData } from "@/app/page";
import AiTaskExtractorPage from "@/app/features/ai-task-extractor/page";
import ClientFeedbackToTasksPage from "@/app/features/client-feedback-to-tasks/page";
import EmailToTasksPage from "@/app/features/email-to-tasks/page";
import ScreenshotToTasksPage from "@/app/features/screenshot-to-tasks/page";
import OrganizeClientRequestsPage from "@/app/resources/how-to-organize-client-requests-as-a-freelancer/page";
import TurnClientFeedbackIntoTasksPage from "@/app/resources/how-to-turn-client-feedback-into-tasks/page";
import TurnEmailsIntoTasksPage from "@/app/resources/how-to-turn-emails-into-tasks/page";
import ManageClientRevisionsPage from "@/app/resources/manage-client-revisions-web-designers/page";
import FreelancerProjectManagementSoftwarePage from "@/app/solutions/freelancer-project-management-software/page";
import UseCaseDetailPage from "@/app/components/use-cases/use-case-detail-page";
import sitemap from "@/app/sitemap";
import { getAllUseCases } from "@/app/lib/use-cases";
import { freelanceDevelopersUseCase } from "@/app/lib/use-cases/cases/freelance-developers";
import { seoFreelancersUseCase } from "@/app/lib/use-cases/cases/seo-freelancers";
import { shopifyFreelancersUseCase } from "@/app/lib/use-cases/cases/shopify-freelancers";
import UseCasesPage from "./page";

function hrefs(container: HTMLElement) {
  return Array.from(container.querySelectorAll("a"))
    .map((link) => link.getAttribute("href"))
    .filter((href): href is string => Boolean(href));
}

function expectLinksTo(container: HTMLElement, expectedHrefs: string[]) {
  const pageHrefs = hrefs(container);

  for (const expectedHref of expectedHrefs) {
    expect(pageHrefs).toContain(expectedHref);
  }
}

describe("Milestone 3 internal authority links", () => {
  it("the Use Cases hub links to every indexed use-case route and gives category guidance", () => {
    const { container } = render(<UseCasesPage />);
    const allUseCaseHrefs = getAllUseCases().map(
      (useCase) => `/use-cases/${useCase.slug}`
    );

    expectLinksTo(container, allUseCaseHrefs);
    expect(container.textContent).toContain(
      "Choose this cluster when the client request is about a site, store, bug report, SEO update, CMS change, or launch task."
    );
    expect(container.textContent).toContain("SEO updates");
    expect(container.textContent).toContain("video edits");
  });

  it("the primary solution page points authority toward weak website-development use cases", () => {
    const { container } = render(<FreelancerProjectManagementSoftwarePage />);

    expectLinksTo(container, [
      "/use-cases/freelance-developers",
      "/use-cases/seo-freelancers",
      "/use-cases/shopify-freelancers",
    ]);
  });

  it("feature pages link to the most relevant weak use-case routes", () => {
    const featurePages = [
      {
        Component: EmailToTasksPage,
        expectedHrefs: [
          "/use-cases/seo-freelancers",
          "/use-cases/freelance-developers",
          "/use-cases/shopify-freelancers",
        ],
      },
      {
        Component: ScreenshotToTasksPage,
        expectedHrefs: [
          "/use-cases/freelance-developers",
          "/use-cases/shopify-freelancers",
          "/use-cases/video-editors",
        ],
      },
      {
        Component: AiTaskExtractorPage,
        expectedHrefs: [
          "/use-cases/seo-freelancers",
          "/use-cases/freelance-developers",
        ],
      },
      {
        Component: ClientFeedbackToTasksPage,
        expectedHrefs: [
          "/use-cases/video-editors",
          "/use-cases/seo-freelancers",
        ],
      },
    ];

    for (const { Component, expectedHrefs } of featurePages) {
      const { container } = render(<Component />);

      expectLinksTo(container, expectedHrefs);
    }
  });

  it("resource articles add contextual links without turning the Resources hub into a use-case index", () => {
    const resourcePages = [
      {
        Component: OrganizeClientRequestsPage,
        expectedHrefs: [
          "/use-cases/freelance-developers",
          "/use-cases/seo-freelancers",
          "/use-cases/shopify-freelancers",
        ],
      },
      {
        Component: TurnEmailsIntoTasksPage,
        expectedHrefs: [
          "/use-cases/seo-freelancers",
          "/use-cases/freelance-developers",
          "/use-cases/shopify-freelancers",
        ],
      },
      {
        Component: TurnClientFeedbackIntoTasksPage,
        expectedHrefs: [
          "/use-cases/video-editors",
          "/use-cases/seo-freelancers",
        ],
      },
      {
        Component: ManageClientRevisionsPage,
        expectedHrefs: [
          "/use-cases/freelance-developers",
          "/use-cases/shopify-freelancers",
        ],
      },
    ];

    for (const { Component, expectedHrefs } of resourcePages) {
      const { container } = render(<Component />);

      expectLinksTo(container, expectedHrefs);
    }
  });
});

describe("Milestone 3 thin use-case strengthening", () => {
  const strengthenedUseCases = [
    {
      useCase: seoFreelancersUseCase,
      transformationTitle: "From scattered SEO notes to page-level tasks.",
      relatedHrefs: [
        "/features/email-to-tasks",
        "/features/client-feedback-to-tasks",
        "/resources/how-to-turn-emails-into-tasks",
      ],
    },
    {
      useCase: freelanceDevelopersUseCase,
      transformationTitle: "From mixed client notes to development tasks.",
      relatedHrefs: [
        "/features/screenshot-to-tasks",
        "/features/email-to-tasks",
        "/resources/how-to-organize-client-requests-as-a-freelancer",
      ],
    },
    {
      useCase: shopifyFreelancersUseCase,
      transformationTitle: "From scattered store requests to Shopify tasks.",
      relatedHrefs: [
        "/features/screenshot-to-tasks",
        "/features/email-to-tasks",
        "/resources/how-to-organize-client-requests-as-a-freelancer",
      ],
    },
  ];

  for (const { useCase, transformationTitle, relatedHrefs } of strengthenedUseCases) {
    it(`${useCase.slug} has added transformation copy and rendered contextual links`, () => {
      expect(useCase.transformation?.title).toBe(transformationTitle);
      expect(useCase.relatedLinks?.links.map((link) => link.href)).toEqual(
        relatedHrefs
      );

      const { container } = render(<UseCaseDetailPage useCase={useCase} />);

      expect(container.textContent).toContain(transformationTitle);
      expectLinksTo(container, relatedHrefs);
    });
  }
});

describe("Milestone 3 discovery boundaries", () => {
  it("the strengthened use cases remain indexed via sitemap without changing route architecture", () => {
    const sitemapPaths = sitemap().map((entry) => new URL(entry.url).pathname);

    expect(sitemapPaths).toContain("/use-cases/seo-freelancers");
    expect(sitemapPaths).toContain("/use-cases/freelance-developers");
    expect(sitemapPaths).toContain("/use-cases/shopify-freelancers");
    expect(sitemapPaths).toContain("/use-cases/video-editors");
  });

  it("the homepage remains free of new direct weak-use-case links", () => {
    const { container } = render(<Homepage />);

    expect(hrefs(container)).not.toContain("/use-cases/seo-freelancers");
    expect(hrefs(container)).not.toContain("/use-cases/freelance-developers");
    expect(hrefs(container)).not.toContain("/use-cases/shopify-freelancers");
    expect(hrefs(container)).not.toContain("/use-cases/video-editors");
  });

  it("the entity graph still does not publish Person or SoftwareApplication schema", () => {
    const serialized = JSON.stringify(structuredData);

    expect(serialized).not.toContain('"@type":"Person"');
    expect(serialized).not.toContain('"founder"');
    expect(serialized).not.toContain("SoftwareApplication");
  });
});
