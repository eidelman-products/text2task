import { describe, expect, it } from "vitest";

import { judgeProjectUpdateFacts } from "./project-update-judge.server";

import type { ExistingProjectUpdateContext } from "@/lib/project-updates/project-update-types";
import type { ProjectUpdateExtractedFacts } from "@/lib/project-updates/v2/project-update-facts.types";

// Focused regression coverage for `normalizeDeadlineDateKey` /
// `areSameDeadlineDate` inside project-update-judge.server.ts. That function
// used to build its comparison key via `new Date(raw).toISOString().slice(0,
// 10)` for anything that wasn't already a `YYYY-MM-DD`-prefixed string — a
// UTC-naive pattern that could misjudge whether a suggested deadline is
// actually a change. It now goes through the validated `DateOnly` parser
// first, falling back to the shared `parseDeadline` natural-language
// resolver (which itself now returns a clean DateOnly), and only returns ""
// for genuinely unparseable input.
//
// The existing project-update-judge.server.test.ts covers subtask-matching
// flows exclusively and has zero deadline-comparison coverage today (see
// mapping report §3.6), so this is a new, narrowly-scoped test file rather
// than an addition to that one.

function buildContext(
  overrides: Partial<ExistingProjectUpdateContext["project"]> = {}
): ExistingProjectUpdateContext {
  return {
    project: {
      id: "project-1",
      user_id: "user-1",
      client_id: null,
      title: "Test project",
      summary: null,
      client_name: "Acme",
      contact_name: null,
      amount: null,
      amount_value: null,
      currency_code: null,
      deadline_text: null,
      deadline_date: null,
      priority: null,
      priority_source: "unknown",
      status: null,
      created_at: null,
      updated_at: null,
      ...overrides,
    },
    client: null,
    subtasks: [],
  };
}

function buildFacts(deadlineText: string | null): ProjectUpdateExtractedFacts {
  return {
    summary: "test",
    requestedSubtasks: [],
    projectChanges: {
      deadlineText,
      amount: null,
      priority: null,
      status: null,
    },
    clientChanges: {
      clientName: null,
      contactName: null,
      phone: null,
      email: null,
      notes: null,
    },
    notes: [],
    confidence: 0.9,
  };
}

describe("normalizeDeadlineDateKey via judgeProjectDeadlineChange: already-canonical dates", () => {
  it("treats an identical canonical current/requested deadline as no_change", () => {
    const context = buildContext({ deadline_date: "2027-01-20" });
    const facts = buildFacts("2027-01-20");

    const result = judgeProjectUpdateFacts({ facts, context });
    const decision = result.decisions.find((d) => d.id === "project-deadline");

    expect(decision?.kind).toBe("no_change");
    expect(decision?.itemType).toBe("no_action");
  });

  it("treats a different canonical requested deadline as an applicable change", () => {
    const context = buildContext({ deadline_date: "2027-01-20" });
    const facts = buildFacts("2027-02-15");

    const result = judgeProjectUpdateFacts({ facts, context });
    const decision = result.decisions.find((d) => d.id === "project-deadline");

    expect(decision?.kind).toBe("apply");
    expect(decision?.itemType).toBe("deadline_change");
  });
});

describe("normalizeDeadlineDateKey via judgeProjectDeadlineChange: natural-language fallback", () => {
  it("resolves a non-canonical current deadline_date (legacy/dirty data) through the parseDeadline fallback, correctly detecting no real change", () => {
    // context.project.deadline_date is not guaranteed to already be a clean
    // YYYY-MM-DD in every historical row (see mapping report §5's data
    // quality caveat). When it isn't, normalizeDeadlineDateKey must resolve
    // it via parseDeadline instead of silently failing.
    const context = buildContext({ deadline_date: "next friday" });
    const facts = buildFacts("next friday");

    const result = judgeProjectUpdateFacts({ facts, context });
    const decision = result.decisions.find((d) => d.id === "project-deadline");

    // Both sides resolve to the same real "next Friday" calendar date, so
    // this must be recognized as no meaningful change. Before the fix, the
    // unsafe `new Date("next friday")` branch produced an Invalid Date,
    // normalizeDeadlineDateKey returned "", and this would have incorrectly
    // been judged as a deadline change every time.
    expect(decision?.kind).toBe("no_change");
    expect(decision?.itemType).toBe("no_action");
  });

  it("falls back to an applicable change when genuinely unparseable current deadline text cannot be normalized", () => {
    const context = buildContext({ deadline_date: "asdkjhasdkjh not a date" });
    const facts = buildFacts("2027-03-10");

    const result = judgeProjectUpdateFacts({ facts, context });
    const decision = result.decisions.find((d) => d.id === "project-deadline");

    // normalizeDeadlineDateKey("asdkjhasdkjh not a date") must return ""
    // rather than throwing, and the judge must treat that as "no reliable
    // current value to compare against" -> apply the requested change.
    expect(decision?.kind).toBe("apply");
    expect(decision?.itemType).toBe("deadline_change");
  });
});
