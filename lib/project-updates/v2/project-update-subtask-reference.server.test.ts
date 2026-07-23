import { describe, expect, it } from "vitest";

import { resolveSubtaskReference } from "./project-update-subtask-reference.server";

import type { ExistingProjectUpdateContext } from "@/lib/project-updates/project-update-types";

type Subtask = ExistingProjectUpdateContext["subtasks"][number];

function buildSubtask(overrides: Partial<Subtask> & { id: number; task_title: string }): Subtask {
  return {
    project_id: "project-1",
    status: "New",
    priority: "Medium",
    deadline_text: null,
    deadline_date: null,
    amount: null,
    subtask_order: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

describe("resolveSubtaskReference", () => {
  it("returns confident_match for an exact/near-exact title", () => {
    const subtasks = [
      buildSubtask({
        id: 1,
        task_title: "Design downloadable business planning checklist",
      }),
    ];

    const resolution = resolveSubtaskReference({
      candidateTitle: "Design downloadable business planning checklist",
      subtasks,
    });

    expect(resolution.outcome).toBe("confident_match");
    if (resolution.outcome === "confident_match") {
      expect(resolution.targetTaskId).toBe(1);
    }
  });

  it("returns confident_match for a short reference containing one distinctive term, when it uniquely identifies one task", () => {
    const subtasks = [
      buildSubtask({
        id: 1,
        task_title: "Create hero section for the new landing page",
      }),
    ];

    const resolution = resolveSubtaskReference({
      candidateTitle: "Hero section",
      subtasks,
    });

    expect(resolution.outcome).toBe("confident_match");
    if (resolution.outcome === "confident_match") {
      expect(resolution.targetTaskId).toBe(1);
    }
  });

  it("returns confident_match for a purely-generic-word reference when it is the only plausible task", () => {
    const subtasks = [
      buildSubtask({
        id: 1,
        task_title: "Create landing page for the checklist",
      }),
    ];

    const resolution = resolveSubtaskReference({
      candidateTitle: "Landing page",
      subtasks,
    });

    expect(resolution.outcome).toBe("confident_match");
    if (resolution.outcome === "confident_match") {
      expect(resolution.targetTaskId).toBe(1);
    }
  });

  it("returns ambiguous_match, never a silent pick, when two subtasks are comparably plausible", () => {
    const subtasks = [
      buildSubtask({
        id: 1,
        task_title: "Create hero section for the homepage",
      }),
      buildSubtask({
        id: 2,
        task_title: "Create hero section for the pricing page",
      }),
    ];

    const resolution = resolveSubtaskReference({
      candidateTitle: "Hero section",
      subtasks,
    });

    expect(resolution.outcome).toBe("ambiguous_match");
    if (resolution.outcome === "ambiguous_match") {
      expect([1, 2]).toContain(resolution.bestCandidateTaskId);
    }
  });

  it("returns confident_match for a paraphrase once evidence is sufficiently unique", () => {
    const subtasks = [
      buildSubtask({
        id: 1,
        task_title: "Create bathroom remodeling services section",
      }),
    ];

    const resolution = resolveSubtaskReference({
      candidateTitle: "Bathroom remodeling section",
      subtasks,
    });

    expect(resolution.outcome).toBe("confident_match");
    if (resolution.outcome === "confident_match") {
      expect(resolution.targetTaskId).toBe(1);
    }
  });

  it("returns no_match for clearly unrelated new work", () => {
    const subtasks = [
      buildSubtask({
        id: 1,
        task_title: "Create hero section for the new landing page",
      }),
      buildSubtask({
        id: 2,
        task_title: "Update service area section with new locations",
      }),
    ];

    const resolution = resolveSubtaskReference({
      candidateTitle: "Add View Our Recent Projects button",
      subtasks,
    });

    expect(resolution.outcome).toBe("no_match");
  });

  it("does not confidently match a partial reference against a larger existing deliverable", () => {
    const subtasks = [
      buildSubtask({
        id: 1,
        task_title: "Create 8 Instagram posts for the August social media campaign",
      }),
    ];

    const resolution = resolveSubtaskReference({
      candidateTitle: "First 4 Instagram posts",
      subtasks,
    });

    expect(resolution.outcome).not.toBe("confident_match");
  });

  it("returns no_match when the reference shares no identifying wording with any subtask", () => {
    const subtasks = [
      buildSubtask({
        id: 1,
        task_title: "Create hero section for the new landing page",
      }),
    ];

    const resolution = resolveSubtaskReference({
      candidateTitle: "Renew the domain registration",
      subtasks,
    });

    expect(resolution.outcome).toBe("no_match");
  });

  it("never returns a target id for no_match", () => {
    const resolution = resolveSubtaskReference({
      candidateTitle: "Completely unrelated request",
      subtasks: [],
    });

    expect(resolution.outcome).toBe("no_match");
    expect(resolution).not.toHaveProperty("targetTaskId");
    expect(resolution).not.toHaveProperty("bestCandidateTaskId");
  });

  // Runtime regression fixtures recovered from the production database for
  // three real client updates, following the live investigation of Cedar
  // Lane Renovations, Summit Growth Consulting, and Harbor Fitness Studio.

  it("Summit runtime regression: generic-only overlap must not match unrelated new work", () => {
    const subtasks = [
      buildSubtask({
        id: 571,
        task_title: "Design a downloadable business planning checklist",
      }),
      buildSubtask({
        id: 572,
        task_title: "Create a landing page for the checklist",
      }),
      buildSubtask({
        id: 573,
        task_title: "Write a four-email follow-up sequence",
      }),
    ];

    const resolution = resolveSubtaskReference({
      candidateTitle: "Add testimonial section to the landing page",
      subtasks,
    });

    expect(resolution.outcome).toBe("no_match");
    expect(resolution).not.toHaveProperty("bestCandidateTaskId");
    expect(resolution).not.toHaveProperty("targetTaskId");
  });

  it("Cedar runtime regression: confidently identifies the original hero task", () => {
    const subtasks = [
      buildSubtask({
        id: 566,
        task_title: "Create homepage hero section with a kitchen renovation image",
      }),
      buildSubtask({
        id: 567,
        task_title: "Create bathroom remodeling services section",
      }),
      buildSubtask({
        id: 568,
        task_title: "Add renovation project gallery with six photos",
      }),
    ];

    const resolution = resolveSubtaskReference({
      candidateTitle: "Homepage hero section",
      subtasks,
    });

    expect(resolution.outcome).toBe("confident_match");
    if (resolution.outcome === "confident_match") {
      expect(resolution.targetTaskId).toBe(566);
    }
  });

  it("Cedar runtime regression: a genuinely new gallery-button request is no_match, not ambiguous", () => {
    const subtasks = [
      buildSubtask({
        id: 566,
        task_title: "Create homepage hero section with a kitchen renovation image",
      }),
      buildSubtask({
        id: 567,
        task_title: "Create bathroom remodeling services section",
      }),
      buildSubtask({
        id: 568,
        task_title: "Add renovation project gallery with six photos",
      }),
    ];

    const resolution = resolveSubtaskReference({
      candidateTitle: "Add 'View Recent Projects' button below renovation gallery",
      subtasks,
    });

    expect(resolution.outcome).toBe("no_match");
    expect(resolution).not.toHaveProperty("bestCandidateTaskId");
    expect(resolution).not.toHaveProperty("targetTaskId");
  });

  it("Harbor runtime regression: never confidently matches a partial reference", () => {
    const subtasks = [
      buildSubtask({
        id: 574,
        task_title: "Create 8 Instagram posts for the August campaign",
      }),
      buildSubtask({
        id: 575,
        task_title: "Design 4 Instagram story graphics for the August campaign",
      }),
      buildSubtask({
        id: 576,
        task_title: "Create 2 short promotional videos for the August campaign",
      }),
    ];

    const resolution = resolveSubtaskReference({
      candidateTitle: "First 4 Instagram posts",
      subtasks,
    });

    expect(resolution.outcome).toBe("ambiguous_match");
    expect(resolution.outcome).not.toBe("confident_match");
  });

  it("Harbor runtime regression: a genuinely new video-color request is no_match, not ambiguous", () => {
    const subtasks = [
      buildSubtask({
        id: 574,
        task_title: "Create 8 Instagram posts for the August campaign",
      }),
      buildSubtask({
        id: 575,
        task_title: "Design 4 Instagram story graphics for the August campaign",
      }),
      buildSubtask({
        id: 576,
        task_title: "Create 2 short promotional videos for the August campaign",
      }),
    ];

    const resolution = resolveSubtaskReference({
      candidateTitle: "Change background color of promotional video 1 to dark blue",
      subtasks,
    });

    expect(resolution.outcome).toBe("no_match");
    expect(resolution).not.toHaveProperty("bestCandidateTaskId");
    expect(resolution).not.toHaveProperty("targetTaskId");
  });

  it("generic-only reference preservation: 'Landing page' still confidently matches the only plausible task", () => {
    const subtasks = [
      buildSubtask({
        id: 1,
        task_title: "Create a landing page for the checklist",
      }),
    ];

    const resolution = resolveSubtaskReference({
      candidateTitle: "Landing page",
      subtasks,
    });

    expect(resolution.outcome).toBe("confident_match");
    if (resolution.outcome === "confident_match") {
      expect(resolution.targetTaskId).toBe(1);
    }
  });

  it("competing generic-only tasks: 'Landing page' stays ambiguous rather than silently picking one", () => {
    const subtasks = [
      buildSubtask({
        id: 1,
        task_title: "Create a landing page for the checklist",
      }),
      buildSubtask({
        id: 2,
        task_title: "Create a landing page for the consultation offer",
      }),
    ];

    const resolution = resolveSubtaskReference({
      candidateTitle: "Landing page",
      subtasks,
    });

    expect(resolution.outcome).toBe("ambiguous_match");
    if (resolution.outcome === "ambiguous_match") {
      expect([1, 2]).toContain(resolution.bestCandidateTaskId);
    }
  });
});
