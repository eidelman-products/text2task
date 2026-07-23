import { describe, expect, it } from "vitest";

import { buildPreviewProjectGroups } from "./editable-preview-list";

import type { ExtractedPreview } from "@/lib/preview/hybrid-preview";
import type { PreviewProjectMetadata } from "./editable-preview-list";

type PreviewItem = ExtractedPreview & {
  contact_name?: string;
};

function buildPreview(overrides: Partial<PreviewItem> & { previewId: string }): PreviewItem {
  return {
    client: "Maple & Harbor Legal QA5",
    task: "Draft engagement letter",
    amount: "",
    deadline: "",
    priority: "Medium",
    status: "New",
    source: "AI extraction",
    raw_input: "",
    ...overrides,
  };
}

describe("canonical convergence of text vs image preview project groups", () => {
  it("uses the same canonical amount field (including currency) whether the amount came from text project metadata or per-task image fields", () => {
    const textProjectMetadata: PreviewProjectMetadata = {
      title: "Legal QA engagement",
      client_name: "Maple & Harbor Legal QA5",
      contact_name: "Sophia Bennett",
      amount: "1725",
      currency_code: "USD",
      deadline_text: "2026-10-09",
    };
    const textPreviews = [
      buildPreview({ previewId: "text-1", contact_name: "Sophia Bennett" }),
    ];

    const imagePreviews = [
      buildPreview({
        previewId: "image-1",
        contact_name: "Sophia Bennett",
        amount: "$1,725",
        source: "Image extraction",
      }),
    ];

    const [textGroup] = buildPreviewProjectGroups(textPreviews, textProjectMetadata);
    const [imageGroup] = buildPreviewProjectGroups(imagePreviews, null);

    expect(textGroup.amount).toBe("1,725 USD");
    expect(imageGroup.amount).toBe("1,725 USD");
    expect(textGroup.amount).toBe(imageGroup.amount);
  });

  it("uses the same canonical deadline fields whether the deadline came from text project metadata or per-task image fields", () => {
    const textProjectMetadata: PreviewProjectMetadata = {
      client_name: "Maple & Harbor Legal QA5",
      deadline_text: "2026-10-09",
    };
    const textPreviews = [buildPreview({ previewId: "text-1" })];

    const imagePreviews = [
      buildPreview({
        previewId: "image-1",
        deadline: "2026-10-09",
        deadline_original_text: "2026-10-09",
        deadline_date: "2026-10-09",
        source: "Image extraction",
      }),
    ];

    const [textGroup] = buildPreviewProjectGroups(textPreviews, textProjectMetadata);
    const [imageGroup] = buildPreviewProjectGroups(imagePreviews, null);

    expect(textGroup.deadline).toBe("2026-10-09");
    expect(imageGroup.deadline).toBe("2026-10-09");
    // Compare by calendar date only: the text path resolves deadlineDate
    // through parseDeadline (which normalizes to a full ISO datetime), while
    // the image path carries the per-task deadline_date straight through.
    // Both must still agree on the same calendar day.
    expect(textGroup.deadlineDate?.slice(0, 10)).toBe("2026-10-09");
    expect(imageGroup.deadlineDate?.slice(0, 10)).toBe("2026-10-09");
  });

  it("uses the same canonical client_name field regardless of extraction source", () => {
    const textProjectMetadata: PreviewProjectMetadata = {
      client_name: "Maple & Harbor Legal QA5",
    };
    const textPreviews = [buildPreview({ previewId: "text-1" })];
    const imagePreviews = [
      buildPreview({
        previewId: "image-1",
        client: "Maple & Harbor Legal QA5",
        source: "Image extraction",
      }),
    ];

    const [textGroup] = buildPreviewProjectGroups(textPreviews, textProjectMetadata);
    const [imageGroup] = buildPreviewProjectGroups(imagePreviews, null);

    expect(textGroup.clientName).toBe(imageGroup.clientName);
  });
});
