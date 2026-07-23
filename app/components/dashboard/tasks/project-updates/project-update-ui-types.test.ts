import { describe, expect, it } from "vitest";

import {
  buildProjectUpdateReviewModel,
  isAlreadyExistsProjectUpdateItem,
  isAlreadyMatchesProjectUpdateItem,
  isApplyableProjectUpdateItem,
  isNeedsReviewProjectUpdateItem,
  resolveProjectUpdateSummaryVariant,
} from "./project-update-ui-types";

import type {
  AnalyzeProjectUpdateResult,
  ProjectUpdateFormState,
  SuggestedProjectUpdateItem,
} from "./project-update-types";

function buildItem(
  overrides: Partial<SuggestedProjectUpdateItem> & {
    id: string;
    type: SuggestedProjectUpdateItem["type"];
  }
): SuggestedProjectUpdateItem {
  return {
    project_update_id: "update-1",
    project_id: "project-1",
    target_task_id: null,
    title: "Test item",
    description: null,
    target_field: null,
    old_value: null,
    new_value: null,
    confidence: null,
    status: "suggested",
    ai_reason: null,
    created_at: new Date(0).toISOString(),
    ...overrides,
  };
}

function buildAnalysisResult(
  items: SuggestedProjectUpdateItem[]
): AnalyzeProjectUpdateResult {
  return {
    update: {
      id: "update-1",
      project_id: "project-1",
      client_id: null,
      source_type: "text",
      raw_input: "test",
      ai_summary: null,
      status: "analyzed",
      created_at: new Date(0).toISOString(),
      analyzed_at: new Date(0).toISOString(),
    },
    items,
    timelineEvent: null,
    analysis: { headline: "test" },
  };
}

function buildForm(
  items: SuggestedProjectUpdateItem[],
  selectedItemIds: string[]
): ProjectUpdateFormState {
  return {
    rawInput: "",
    inputMethod: "text",
    selectedImage: null,
    imageError: null,
    isAnalyzing: false,
    isApplying: false,
    analysisError: null,
    applyError: null,
    applyDuplicate: null,
    applySuccessMessage: null,
    analysisResult: buildAnalysisResult(items),
    selectedItemIds,
    editedItemValues: {},
    applyPlaceholderMessage: null,
  };
}

describe("needs_review item classification", () => {
  it("classifies a needs_review item into needsReviewItems, not readyItems", () => {
    const item = buildItem({ id: "item-1", type: "needs_review" });
    const form = buildForm([item], []);

    const model = buildProjectUpdateReviewModel(form);

    expect(model.needsReviewItems.map((i) => i.id)).toEqual(["item-1"]);
    expect(model.readyItems).toHaveLength(0);
    expect(isApplyableProjectUpdateItem(item)).toBe(false);
    expect(isNeedsReviewProjectUpdateItem(item)).toBe(true);
  });

  it("never classifies a needs_review item as Already handled (alreadyExists or alreadyMatches)", () => {
    const item = buildItem({ id: "item-1", type: "needs_review" });
    const form = buildForm([item], []);

    const model = buildProjectUpdateReviewModel(form);

    expect(model.alreadyExistsItems).toHaveLength(0);
    expect(model.alreadyMatchesItems).toHaveLength(0);
    expect(isAlreadyExistsProjectUpdateItem(item)).toBe(false);
    expect(isAlreadyMatchesProjectUpdateItem(item)).toBe(false);
  });

  it("mixed result of one needs_review and one new_subtask: exactly one applicable/default-selectable item, needs-review count 1, already-handled count 0", () => {
    const readyItem = buildItem({
      id: "item-ready",
      type: "new_subtask",
      new_value: { task_title: "New work" },
    });
    const reviewItem = buildItem({
      id: "item-review",
      type: "needs_review",
      target_task_id: 42,
    });
    const form = buildForm([readyItem, reviewItem], []);

    const model = buildProjectUpdateReviewModel(form);

    // readyItems is exactly the set that use-project-update.ts's
    // getDefaultSelectedItemIds/isApplyableSuggestedItem select by default --
    // both apply the identical duplicate_warning/no_action/needs_review
    // exclusion. Asserting on readyItems here proves default selection
    // includes exactly the new_subtask item and excludes needs_review.
    expect(model.readyItems.map((i) => i.id)).toEqual(["item-ready"]);
    expect(model.needsReviewItems.map((i) => i.id)).toEqual(["item-review"]);
    expect(model.alreadyExistsItems).toHaveLength(0);
    expect(model.alreadyMatchesItems).toHaveLength(0);
  });
});

describe("resolveProjectUpdateSummaryVariant", () => {
  it("a needs-review-only result (zero ready items) resolves to needsReview, never handled", () => {
    const variant = resolveProjectUpdateSummaryVariant({
      readyCount: 0,
      needsReviewCount: 1,
    });

    expect(variant).toBe("needsReview");
    expect(variant).not.toBe("handled");
  });

  it("a true duplicate/no-change-only result (zero ready, zero needs-review) resolves to handled", () => {
    const variant = resolveProjectUpdateSummaryVariant({
      readyCount: 0,
      needsReviewCount: 0,
    });

    expect(variant).toBe("handled");
  });

  it("any ready items present resolves to ready, regardless of needs-review count", () => {
    const variant = resolveProjectUpdateSummaryVariant({
      readyCount: 1,
      needsReviewCount: 1,
    });

    expect(variant).toBe("ready");
  });
});
