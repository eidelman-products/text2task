// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import ProjectUpdateModalV2 from "./project-update-shell";
import type {
  AnalyzeProjectUpdateResult,
  ProjectUpdateFormState,
} from "./project-update-types";

/*
  Phase 6C correction (Apply re-enable) -- the Phase 6B temporary
  source-aware canApply exclusion (client_share could never show "Save N
  changes") has been removed now that Phase 6C's atomic conversion
  closure exists. client_share now behaves identically to text/image in
  this SAME existing review UI -- no second review UI, no remaining
  source-type special-casing in canApply at all.
*/

function buildAnalysisResult(
  sourceType: "text" | "image" | "client_share"
): AnalyzeProjectUpdateResult {
  return {
    update: {
      id: "update-1",
      project_id: "project-1",
      client_id: null,
      source_type: sourceType,
      raw_input: "Please add a footer to the homepage.",
      ai_summary: null,
      status: "analyzed",
      created_at: "2026-08-21T00:00:00Z",
      analyzed_at: "2026-08-21T00:00:00Z",
    },
    items: [
      {
        id: "item-1",
        project_update_id: "update-1",
        project_id: "project-1",
        target_task_id: null,
        type: "new_subtask",
        title: "Add a footer to the homepage",
        description: null,
        target_field: null,
        old_value: null,
        new_value: { task_title: "Add a footer to the homepage" },
        confidence: 0.9,
        status: "suggested",
        ai_reason: null,
        created_at: "2026-08-21T00:00:00Z",
      },
    ],
    timelineEvent: null,
    analysis: {
      headline: "1 change found.",
      reasoning: "",
      riskLevel: "low",
      detectedChanges: ["Add a footer to the homepage"],
    },
  };
}

function buildForm(
  sourceType: "text" | "image" | "client_share"
): ProjectUpdateFormState {
  const analysisResult = buildAnalysisResult(sourceType);

  return {
    rawInput: analysisResult.update.raw_input,
    inputMethod: "text",
    selectedImage: null,
    imageError: null,
    isAnalyzing: false,
    isApplying: false,
    analysisError: null,
    applyError: null,
    applyDuplicate: null,
    applySuccessMessage: null,
    analysisResult,
    selectedItemIds: ["item-1"],
    editedItemValues: {},
    applyPlaceholderMessage: null,
  };
}

function renderModal(sourceType: "text" | "image" | "client_share") {
  return render(
    <ProjectUpdateModalV2
      isOpen
      project={null}
      form={buildForm(sourceType)}
      isBusy={false}
      onClose={vi.fn()}
      onAnalyzeUpdate={vi.fn()}
      onApplySelectedChanges={vi.fn()}
      onRawInputChange={vi.fn()}
      onInputMethodChange={vi.fn()}
      onImageSelected={vi.fn()}
      onRemoveImage={vi.fn()}
      onImageError={vi.fn()}
      onToggleSuggestedItem={vi.fn()}
      onUpdateSuggestedItemValue={vi.fn()}
    />
  );
}

describe("ProjectUpdateModalV2 - Phase 6C Apply re-enable (client_share can Apply, inverse of the retired Phase 6B guard)", () => {
  it("a client_share result with a selected applyable item now DOES show Save N changes (inverse of the retired Phase 6B guard)", () => {
    renderModal("client_share");

    expect(screen.getByRole("button", { name: /^Save 1 change/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("a text result with the identical selected item still shows Save N changes (unaffected, direct regression)", () => {
    renderModal("text");

    expect(screen.getByRole("button", { name: /^Save 1 change/ })).toBeInTheDocument();
  });

  it("an image result with the identical selected item still shows Save N changes (unaffected, direct regression)", () => {
    renderModal("image");

    expect(screen.getByRole("button", { name: /^Save 1 change/ })).toBeInTheDocument();
  });

  it("the review card renders identically (suggested items visible) for client_share, text, and image alike", () => {
    for (const sourceType of ["client_share", "text", "image"] as const) {
      const { unmount } = renderModal(sourceType);
      expect(screen.getByText("Add a footer to the homepage")).toBeInTheDocument();
      unmount();
    }
  });

  it("no second review UI/modal/state machine exists -- the exact same ProjectUpdateModalV2 component renders client_share and text/image alike", () => {
    const { unmount: unmountClientShare } = renderModal("client_share");
    const clientShareDialog = screen.getByRole("dialog");
    unmountClientShare();

    const { unmount: unmountText } = renderModal("text");
    const textDialog = screen.getByRole("dialog");
    unmountText();

    expect(clientShareDialog.getAttribute("aria-label")).toBe(
      textDialog.getAttribute("aria-label")
    );
  });
});
