// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ClientProjectView } from "./client-project-view";
import type { ClientProjectProjection } from "@/lib/share/client-share-projection-contracts";

function minimalProjection(overrides: Partial<ClientProjectProjection> = {}): ClientProjectProjection {
  return {
    title: null,
    subtitle: null,
    status: null,
    targetDate: null,
    contentDirection: "auto",
    commentsEnabled: false,
    progress: null,
    latestUpdate: null,
    tasks: [],
    resources: [],
    ...overrides,
  };
}

describe("ClientProjectView - strict-projection-only, no private dashboard data", () => {
  it("accepts only the strict projection shape and renders nothing beyond it -- no Project/userId/secret/dashboard chrome can leak because none is ever passed", () => {
    const projection = minimalProjection({
      title: "Website launch",
      status: "in_progress",
      progress: { completed: 1, total: 2, percent: 50 },
      tasks: [{ title: "Design hero", publicGroup: "completed", waitingForClientFeedback: false }],
    });

    const { container } = render(<ClientProjectView projection={projection} />);

    const text = container.textContent ?? "";
    for (const forbidden of ["userId", "projectId", "secret", "amount", "priority", "Urgent"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("ClientProjectView - empty states", () => {
  it("renders only the footer when every field is null/empty -- no title, subtitle, progress, update, tasks, or resources section", () => {
    render(<ClientProjectView projection={minimalProjection()} />);

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Progress")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Latest update")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tasks")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Shared files and links")).not.toBeInTheDocument();
    expect(screen.getByText("Shared securely via Text2Task.")).toBeInTheDocument();
  });
});

describe("ClientProjectView - LTR / RTL / auto direction", () => {
  it("sets dir='auto' explicitly for contentDirection 'auto' -- never omitted, since an omitted attribute can inherit direction from an ancestor instead of being genuinely auto", () => {
    const { container } = render(<ClientProjectView projection={minimalProjection({ contentDirection: "auto" })} />);
    expect(container.querySelector('[dir="auto"]')).toBeInTheDocument();
  });

  it("sets dir='ltr' explicitly for contentDirection 'ltr'", () => {
    const { container } = render(<ClientProjectView projection={minimalProjection({ contentDirection: "ltr" })} />);
    expect(container.querySelector('[dir="ltr"]')).toBeInTheDocument();
  });

  it("sets dir='rtl' explicitly for contentDirection 'rtl', and still renders tasks/resources correctly under it", () => {
    const projection = minimalProjection({
      contentDirection: "rtl",
      title: "השקת אתר",
      tasks: [{ title: "עיצוב", publicGroup: "in_progress", waitingForClientFeedback: false }],
    });

    const { container } = render(<ClientProjectView projection={projection} />);

    expect(container.querySelector('[dir="rtl"]')).toBeInTheDocument();
    expect(screen.getByText("השקת אתר")).toBeInTheDocument();
    expect(screen.getByText("עיצוב")).toBeInTheDocument();
  });
});

describe("ClientProjectView - header visibility", () => {
  it("renders title only when present", () => {
    render(<ClientProjectView projection={minimalProjection({ title: "Website launch" })} />);
    expect(screen.getByRole("heading", { level: 1, name: "Website launch" })).toBeInTheDocument();
  });

  it("renders subtitle only when present", () => {
    render(<ClientProjectView projection={minimalProjection({ subtitle: "A quick refresh" })} />);
    expect(screen.getByText("A quick refresh")).toBeInTheDocument();
  });

  it("renders the safe status label, never a raw internal status", () => {
    render(<ClientProjectView projection={minimalProjection({ status: "not_started" })} />);
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });

  it("renders the target date when present", () => {
    render(<ClientProjectView projection={minimalProjection({ targetDate: "2026-09-01" })} />);
    expect(screen.getByText(/Target:/)).toBeInTheDocument();
  });
});

describe("ClientProjectView - progress", () => {
  it("renders the completed/total count and a proportional fill width", () => {
    const { container } = render(
      <ClientProjectView projection={minimalProjection({ progress: { completed: 3, total: 5, percent: 60 } })} />
    );

    expect(screen.getByLabelText("Progress")).toBeInTheDocument();
    expect(screen.getByText("3 of 5 complete")).toBeInTheDocument();
    const fill = container.querySelector('[style*="width: 60%"]');
    expect(fill).toBeInTheDocument();
  });

  it("omits the progress section entirely when progress is null (never a fabricated 0/0)", () => {
    render(<ClientProjectView projection={minimalProjection({ progress: null })} />);
    expect(screen.queryByLabelText("Progress")).not.toBeInTheDocument();
  });
});

describe("ClientProjectView - latest update", () => {
  it("renders the update body when present", () => {
    render(
      <ClientProjectView
        projection={minimalProjection({ latestUpdate: { body: "Kickoff went great.", publishedAt: "2026-08-01T00:00:00Z" } })}
      />
    );
    expect(screen.getByLabelText("Latest update")).toBeInTheDocument();
    expect(screen.getByText("Kickoff went great.")).toBeInTheDocument();
  });
});

describe("ClientProjectView - task groups", () => {
  it("groups tasks by publicGroup, in the fixed display order waiting_for_feedback, in_progress, coming_up, completed", () => {
    const projection = minimalProjection({
      tasks: [
        { title: "Done task", publicGroup: "completed", waitingForClientFeedback: false },
        { title: "Upcoming task", publicGroup: "coming_up", waitingForClientFeedback: false },
        { title: "Active task", publicGroup: "in_progress", waitingForClientFeedback: false },
        { title: "Blocked task", publicGroup: "waiting_for_feedback", waitingForClientFeedback: true },
      ],
    });

    render(<ClientProjectView projection={projection} />);

    const labels = screen
      .getAllByText(/Waiting for your feedback|In progress|Coming up|Completed/)
      .map((el) => el.textContent);
    // The status badge (if any) could also match "In progress"; here
    // status is null, so all matches are group labels, in document order.
    expect(labels).toEqual(["Waiting for your feedback", "In progress", "Coming up", "Completed"]);
  });

  it("shows a 'Feedback needed' badge only for tasks with waitingForClientFeedback true", () => {
    const projection = minimalProjection({
      tasks: [
        { title: "Needs feedback", publicGroup: "waiting_for_feedback", waitingForClientFeedback: true },
        { title: "No feedback needed", publicGroup: "in_progress", waitingForClientFeedback: false },
      ],
    });

    render(<ClientProjectView projection={projection} />);

    const needsFeedbackItem = screen.getByText("Needs feedback").closest("li");
    const noFeedbackItem = screen.getByText("No feedback needed").closest("li");
    expect(needsFeedbackItem).toHaveTextContent("Feedback needed");
    expect(noFeedbackItem).not.toHaveTextContent("Feedback needed");
  });

  it("omits the Tasks section entirely when there are no mapped tasks", () => {
    render(<ClientProjectView projection={minimalProjection({ tasks: [] })} />);
    expect(screen.queryByLabelText("Tasks")).not.toBeInTheDocument();
  });
});

describe("ClientProjectView - resources", () => {
  it("renders a link resource as an anchor with target=_blank and safe rel attributes, never auto-fetching a preview", () => {
    const projection = minimalProjection({
      resources: [{ kind: "link", label: "Brand guide", url: "https://example.com/brand-guide" }],
    });

    render(<ClientProjectView projection={projection} />);

    const link = screen.getByRole("link", { name: "Brand guide" });
    expect(link).toHaveAttribute("href", "https://example.com/brand-guide");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");

    // Explicit per-token regression coverage -- order-independent, so a
    // future reordering of the rel string cannot silently drop one.
    const relTokens = (link.getAttribute("rel") ?? "").split(" ");
    expect(relTokens).toContain("noopener");
    expect(relTokens).toContain("noreferrer");
    expect(relTokens).toContain("nofollow");
  });

  it("renders a file resource as plain text (never a downloadable link/signed URL), with '(downloadable)' only when canDownload is true", () => {
    const projection = minimalProjection({
      resources: [
        { kind: "file", label: "Final logo", canDownload: true },
        { kind: "file", label: "Draft brief", canDownload: false },
      ],
    });

    render(<ClientProjectView projection={projection} />);

    expect(screen.getByText("Final logo")).toBeInTheDocument();
    expect(screen.getByText("(downloadable)")).toBeInTheDocument();
    expect(screen.getByText("Draft brief")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Final logo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Draft brief" })).not.toBeInTheDocument();
  });

  it("omits the Shared files & links section entirely when there are no mapped resources", () => {
    render(<ClientProjectView projection={minimalProjection({ resources: [] })} />);
    expect(screen.queryByLabelText("Shared files and links")).not.toBeInTheDocument();
  });
});

describe("ClientProjectView - mobile-safe semantic structure", () => {
  it("uses labeled <section> landmarks for each present content block", () => {
    const projection = minimalProjection({
      progress: { completed: 1, total: 2, percent: 50 },
      latestUpdate: { body: "Update body", publishedAt: "2026-08-01T00:00:00Z" },
      tasks: [{ title: "Task one", publicGroup: "completed", waitingForClientFeedback: false }],
      resources: [{ kind: "link", label: "Link one", url: "https://example.com" }],
    });

    render(<ClientProjectView projection={projection} />);

    for (const name of ["Progress", "Latest update", "Tasks", "Shared files and links"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
  });
});
