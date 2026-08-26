// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProjectUpdateInputCard from "./project-update-input-card";
import type {
  AnalyzeProjectUpdateResult,
  ProjectUpdateFormState,
} from "./project-update-types";

/*
  2026-08-26 defect fix -- for source_type === "client_share", the
  original editable TextUpdateInput must not render at all; a dedicated,
  read-only "Original client message" block must display the exact
  analysisResult.update.raw_input instead, regardless of form.rawInput
  (which stays at its own separate, unrelated "" for this source -- see
  project-update-input-card.tsx's own header comment on this branch).

  Every test below builds form.rawInput = "" for the client_share cases
  specifically, matching the REAL production defect shape exactly (the
  bug was never reproducible with a form that happened to already have
  rawInput populated) -- this is deliberately different from
  project-update-shell.test.tsx's own buildForm helper, which sets
  rawInput = raw_input and would not have caught this defect.
*/

function buildAnalysisResult(
  sourceType: "text" | "image" | "client_share",
  rawInput: string
): AnalyzeProjectUpdateResult {
  return {
    update: {
      id: "update-1",
      project_id: "project-1",
      client_id: null,
      source_type: sourceType,
      raw_input: rawInput,
      ai_summary: null,
      status: "analyzed",
      created_at: "2026-08-26T00:00:00Z",
      analyzed_at: "2026-08-26T00:00:00Z",
    },
    items: [],
    timelineEvent: null,
    analysis: {
      headline: "Everything is already handled.",
      reasoning: "",
      riskLevel: "low",
      detectedChanges: [],
    },
  };
}

function buildForm(
  overrides: Partial<ProjectUpdateFormState> = {}
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
    analysisResult: null,
    selectedItemIds: [],
    editedItemValues: {},
    applyPlaceholderMessage: null,
    ...overrides,
  };
}

function renderCard(
  form: ProjectUpdateFormState,
  overrides: Partial<{
    onRawInputChange: (value: string) => void;
    onInputMethodChange: (value: "text" | "image") => void;
  }> = {}
) {
  const onRawInputChange = overrides.onRawInputChange ?? vi.fn<(value: string) => void>();
  const onInputMethodChange = overrides.onInputMethodChange ?? vi.fn<(value: "text" | "image") => void>();

  const view = render(
    <ProjectUpdateInputCard
      form={form}
      isBusy={false}
      onRawInputChange={onRawInputChange}
      onInputMethodChange={onInputMethodChange}
      onImageSelected={vi.fn()}
      onRemoveImage={vi.fn()}
      onImageError={vi.fn()}
    />
  );

  return { ...view, onRawInputChange, onInputMethodChange };
}

describe("ProjectUpdateInputCard - client_share read-only source (2026-08-26 defect fix)", () => {
  it("renders the exact original client message, even though form.rawInput is empty (the real production bug's exact shape)", () => {
    const rawInput = "Hi, this is a production smoke test message from the client share view.";
    const form = buildForm({
      rawInput: "",
      analysisResult: buildAnalysisResult("client_share", rawInput),
    });

    renderCard(form);

    expect(screen.getByText("Original client message")).toBeInTheDocument();
    expect(screen.getByText(rawInput)).toBeInTheDocument();
  });

  it("does not render the editable text-update textarea or its character counter for client_share", () => {
    const form = buildForm({
      rawInput: "",
      analysisResult: buildAnalysisResult("client_share", "Please add a footer."),
    });

    renderCard(form);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(document.querySelector("textarea")).not.toBeInTheDocument();
    expect(screen.queryByText(/\/ 8000/)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/example: the client asked/i)).not.toBeInTheDocument();
  });

  it("does not render the Text update / Screenshot update source tabs for client_share (the source is already fixed, not owner-chosen)", () => {
    const form = buildForm({
      rawInput: "",
      analysisResult: buildAnalysisResult("client_share", "Please add a footer."),
    });

    renderCard(form);

    expect(screen.queryByRole("button", { name: /text update/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /screenshot update/i })).not.toBeInTheDocument();
  });

  it("the owner cannot edit the displayed message -- no onRawInputChange call occurs merely from rendering or attempting to interact with the block", async () => {
    const rawInput = "Please add a footer to the homepage.";
    const form = buildForm({
      rawInput: "",
      analysisResult: buildAnalysisResult("client_share", rawInput),
    });

    const { onRawInputChange } = renderCard(form);

    const block = screen.getByRole("group", { name: "Original client message" });
    await userEvent.click(block);
    // A read-only <div> has no keyboard-input semantics to type into (no
    // contentEditable, no textbox role) -- this click is the strongest
    // "attempt to interact" a real user could make against this element.

    expect(onRawInputChange).not.toHaveBeenCalled();
  });

  it("multiline client message: line breaks are visibly preserved (pre-wrap, not collapsed to a single line)", () => {
    const rawInput = "Line one.\nLine two.\n\nLine four after a blank line.";
    const form = buildForm({
      rawInput: "",
      analysisResult: buildAnalysisResult("client_share", rawInput),
    });

    renderCard(form);

    const block = screen.getByRole("group", { name: "Original client message" });
    expect(block.textContent).toBe(rawInput);
    expect(block).toHaveStyle({ whiteSpace: "pre-wrap" });
  });

  it("does not copy the client_share raw_input into form.rawInput -- onRawInputChange is never invoked as a side effect of rendering", () => {
    const rawInput = "Please add a footer to the homepage.";
    const form = buildForm({
      rawInput: "",
      analysisResult: buildAnalysisResult("client_share", rawInput),
    });

    const { onRawInputChange } = renderCard(form);

    expect(onRawInputChange).not.toHaveBeenCalled();
  });
});

describe("ProjectUpdateInputCard - normal text flow is unchanged", () => {
  it("still renders the editable textarea, wired to form.rawInput and onRawInputChange, for a plain manual entry (no analysisResult yet)", async () => {
    const form = buildForm({ rawInput: "", analysisResult: null, inputMethod: "text" });
    const { onRawInputChange } = renderCard(form);

    const textarea = screen.getByLabelText("Message");
    expect(textarea.tagName).toBe("TEXTAREA");

    await userEvent.type(textarea, "a");
    expect(onRawInputChange).toHaveBeenCalled();
  });

  it("still renders the editable textarea, still shows the 0/8000 counter, for a completed text-source analysis result (unaffected regression)", () => {
    const rawInput = "Please add a footer to the homepage.";
    const form = buildForm({
      rawInput,
      analysisResult: buildAnalysisResult("text", rawInput),
    });

    renderCard(form);

    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.value).toBe(rawInput);
    expect(screen.getByText(`${rawInput.length} / 8000`)).toBeInTheDocument();
    expect(screen.queryByText("Original client message")).not.toBeInTheDocument();
  });

  it("still renders the Text update / Screenshot update tabs for a text-source result", () => {
    const form = buildForm({
      rawInput: "Please add a footer.",
      analysisResult: buildAnalysisResult("text", "Please add a footer."),
    });

    renderCard(form);

    expect(screen.getByRole("button", { name: /text update/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /screenshot update/i })).toBeInTheDocument();
  });
});

describe("ProjectUpdateInputCard - image/screenshot flow is unchanged", () => {
  it("still renders the upload/paste screenshot UI, not the read-only block, for an image-source analysis result", () => {
    const form = buildForm({
      rawInput: "",
      inputMethod: "image",
      analysisResult: buildAnalysisResult("image", "Extracted from screenshot."),
    });

    renderCard(form);

    expect(screen.getByText(/paste a screenshot/i)).toBeInTheDocument();
    expect(screen.queryByText("Original client message")).not.toBeInTheDocument();
    expect(document.querySelector("textarea")).not.toBeInTheDocument();
  });

  it("still renders the Text update / Screenshot update tabs for an image-source result", () => {
    const form = buildForm({
      rawInput: "",
      inputMethod: "image",
      analysisResult: buildAnalysisResult("image", "Extracted from screenshot."),
    });

    renderCard(form);

    expect(screen.getByRole("button", { name: /text update/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /screenshot update/i })).toBeInTheDocument();
  });
});

describe("ProjectUpdateInputCard - Apply-payload isolation (client_share source display cannot influence Apply)", () => {
  it("the read-only client_share block exposes no editable control of any kind that could feed into any onChange-shaped callback -- structurally incapable of affecting form state, and therefore the Apply payload use-project-update.ts builds from form state", () => {
    const form = buildForm({
      rawInput: "",
      analysisResult: buildAnalysisResult("client_share", "Please add a footer."),
    });

    const { container } = renderCard(form);

    // No <textarea>, no <input>, no [contenteditable] anywhere in the
    // rendered card -- the ONLY way form.rawInput or any other form field
    // could change is through this card's own onChange-wired controls,
    // and for client_share this card renders none.
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("[contenteditable='true']")).toBeNull();
  });
});
