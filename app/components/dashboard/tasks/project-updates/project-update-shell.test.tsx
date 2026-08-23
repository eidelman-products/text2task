// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import ProjectUpdateModalV2 from "./project-update-shell";
import type {
  AnalyzeProjectUpdateResult,
  ProjectUpdateFormState,
} from "./project-update-types";

/*
  Phase 6B correction (blocker fix) -- proves the smallest additive,
  source-aware canApply/read-only behavior in project-update-shell.tsx:
  a client_share analysis result must never expose Apply ("Save N
  changes") in this SAME existing review UI, while a normal text/image
  result is completely unaffected. This is the UI half of the Apply
  boundary; app/api/project-updates/apply/route.ts's own server-side
  guard is the actual authority (see its own test file).
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

describe("ProjectUpdateModalV2 - Phase 6B Apply boundary (client_share cannot Apply)", () => {
  it("a client_share result with a selected applyable item shows Close, never Save N changes", () => {
    renderModal("client_share");

    expect(screen.queryByText(/^Save \d+ changes?$/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("a text result with the identical selected item DOES show Save N changes (unaffected)", () => {
    renderModal("text");

    expect(screen.getByRole("button", { name: /^Save 1 change/ })).toBeInTheDocument();
  });

  it("an image result with the identical selected item DOES show Save N changes (unaffected)", () => {
    renderModal("image");

    expect(screen.getByRole("button", { name: /^Save 1 change/ })).toBeInTheDocument();
  });

  it("the review card still renders (suggested items visible) for client_share -- review remains visible, only Apply is unavailable", () => {
    renderModal("client_share");

    expect(screen.getByText("Add a footer to the homepage")).toBeInTheDocument();
  });
});
