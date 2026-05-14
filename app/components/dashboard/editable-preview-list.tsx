"use client";

import AiProjectReviewPanel from "./extract/ai-project-review-panel";
import type {
  ExtractedPreview,
  HybridAppliedChange,
  HybridPreviewMeta,
} from "@/lib/preview/hybrid-preview";

type PreviewItem = ExtractedPreview & {
  contact_name?: string;
  contactName?: string;
  contact_person?: string;
  contactPerson?: string;
  client_phone?: string;
  client_email?: string;
  client_notes?: string;
  raw_input?: string;
};

type PreviewFieldName = keyof Omit<PreviewItem, "previewId">;

type LegacyDuplicateWarning = {
  existingTaskId: number;
  existingTask: string;
  existingClient: string;
  existingDeadline: string;
  existingCreatedAt: string;
  reason: string;
};

export type PreviewProjectGroup = {
  key: string;
  clientName: string;
  contactName: string;
  projectTitle: string;
  projectSummary: string;
  amount: string;
  deadline: string;
  priority: "Low" | "Medium" | "High";
  source: string;
  client_phone: string;
  client_email: string;
  client_notes: string;
  items: Array<{
    preview: PreviewItem;
    originalIndex: number;
  }>;
};

type EditablePreviewListProps = {
  previewItems: PreviewItem[];
  aiMetaByPreviewId: Record<string, HybridPreviewMeta>;
  onChange: (index: number, field: PreviewFieldName, value: string) => void;
  onUndoChange?: (previewId: string, change: HybridAppliedChange) => void;

  duplicateWarnings?: Record<string, LegacyDuplicateWarning>;
  savingPreviewIds?: Record<string, boolean>;
  onSaveDuplicateAnyway?: (previewId: string) => void;
  onSkipDuplicate?: (previewId: string) => void;
};

export default function EditablePreviewList({
  previewItems,
  aiMetaByPreviewId,
  onChange,
}: EditablePreviewListProps) {
  const previewGroups = buildPreviewProjectGroups(previewItems);

  return (
    <div
      className="editable-preview-project-list"
      style={{
        display: "grid",
        gap: 14,
      }}
    >
      {previewGroups.map((group, groupIndex) => (
        <AiProjectReviewPanel
          key={group.key}
          groupIndex={groupIndex}
          group={group}
          aiMetaByPreviewId={aiMetaByPreviewId}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

export function buildPreviewProjectGroups(
  previewItems: PreviewItem[]
): PreviewProjectGroup[] {
  const grouped = new Map<
    string,
    Array<{
      preview: PreviewItem;
      originalIndex: number;
    }>
  >();

  previewItems.forEach((preview, originalIndex) => {
    const key = getPreviewProjectKey(preview);
    const existing = grouped.get(key) || [];

    existing.push({ preview, originalIndex });
    grouped.set(key, existing);
  });

  return Array.from(grouped.entries()).map(([key, items]) => {
    const previews = items.map((item) => item.preview);
    const primary = previews[0];

    const clientName = primary?.client?.trim() || "Unassigned";
    const contactName = getFirstFilled(
      previews.flatMap((preview) => [
        preview.contact_name,
        preview.contactName,
        preview.contact_person,
        preview.contactPerson,
      ])
    );

    const projectTitle = inferProjectTitle(previews);
    const projectSummary = buildProjectSummary(previews);

    return {
      key,
      clientName,
      contactName,
      projectTitle,
      projectSummary,
      amount: getGroupAmount(previews),
      deadline: getGroupDeadline(previews),
      priority: getGroupPriority(previews),
      source: primary?.source || "Project extraction",
      client_phone: getFirstFilled(
        previews.map((preview) => preview.client_phone)
      ),
      client_email: getFirstFilled(
        previews.map((preview) => preview.client_email)
      ),
      client_notes: getFirstFilled(
        previews.map((preview) => preview.client_notes)
      ),
      items,
    };
  });
}

export function getPreviewProjectStats(previewItems: PreviewItem[]) {
  const groups = buildPreviewProjectGroups(previewItems);
  const projectCount = groups.length;
  const taskCount = previewItems.length;

  return {
    groups,
    projectCount,
    taskCount,
    projectLabel: `${projectCount} project${projectCount === 1 ? "" : "s"}`,
    taskLabel: `${taskCount} task${taskCount === 1 ? "" : "s"}`,
    detectedLabel: `${projectCount} project${
      projectCount === 1 ? "" : "s"
    } · ${taskCount} task${taskCount === 1 ? "" : "s"} detected`,
    saveLabel: `Save ${projectCount} project${
      projectCount === 1 ? "" : "s"
    } to CRM`,
  };
}

function getPreviewProjectKey(preview: PreviewItem) {
  const client = normalize(preview.client || "Unassigned");
  const rawInput = normalize(preview.raw_input || "");

  if (rawInput) {
    return `${client}::${hashString(rawInput)}`;
  }

  const source = normalize(preview.source || "");
  const deadline = normalize(
    preview.deadline_original_text || preview.deadline || ""
  );
  const email = normalize(preview.client_email || "");
  const phone = normalize(preview.client_phone || "");

  return `${client}::${source}::${deadline}::${email}::${phone}`;
}

function normalize(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function hashString(value: string) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function getFirstFilled(values: Array<string | undefined>) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function inferProjectTitle(previews: PreviewItem[]) {
  if (previews.length === 1) {
    return cleanTitle(previews[0].task) || "Client project";
  }

  const combined = previews
    .map((preview) => preview.task || "")
    .join(" ")
    .toLowerCase();

  if (
    combined.includes("social") ||
    combined.includes("post") ||
    combined.includes("posts") ||
    combined.includes("reel") ||
    combined.includes("reels") ||
    combined.includes("story") ||
    combined.includes("stories") ||
    combined.includes("caption") ||
    combined.includes("hashtag")
  ) {
    return "Social media content package";
  }

  if (
    combined.includes("video") ||
    combined.includes("clip") ||
    combined.includes("clips") ||
    combined.includes("facebook ad") ||
    combined.includes("product video") ||
    combined.includes("transitions")
  ) {
    return "Video editing package";
  }

  if (
    combined.includes("logo") ||
    combined.includes("linkedin") ||
    combined.includes("banner") ||
    combined.includes("brand")
  ) {
    return "Brand assets package";
  }

  if (
    combined.includes("homepage") ||
    combined.includes("website") ||
    combined.includes("contact form") ||
    combined.includes("testimonials") ||
    combined.includes("service area") ||
    combined.includes("header")
  ) {
    return "Website updates project";
  }

  if (
    combined.includes("follow") ||
    combined.includes("follow-up") ||
    combined.includes("spreadsheet") ||
    combined.includes("reply") ||
    combined.includes("admin") ||
    combined.includes("records") ||
    combined.includes("invoice") ||
    combined.includes("client")
  ) {
    return "Admin support package";
  }

  return "Client project";
}

function cleanTitle(value: string) {
  const clean = String(value || "").trim();

  if (!clean) return "";

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function buildProjectSummary(previews: PreviewItem[]) {
  if (previews.length === 1) {
    return previews[0].task || "";
  }

  const titles = previews
    .map((preview) => preview.task?.trim())
    .filter(Boolean)
    .slice(0, 3);

  const suffix =
    previews.length > titles.length
      ? `, +${previews.length - titles.length} more`
      : "";

  return `${titles.join(", ")}${suffix}`;
}

function getGroupDeadline(previews: PreviewItem[]) {
  const firstOriginalDeadline = previews
    .map((preview) => preview.deadline_original_text?.trim())
    .filter(Boolean)[0];

  if (firstOriginalDeadline) return firstOriginalDeadline;

  return (
    previews.map((preview) => preview.deadline?.trim()).filter(Boolean)[0] || ""
  );
}

function getGroupAmount(previews: PreviewItem[]) {
  if (previews.length === 1) {
    return normalizeAmountDisplay(previews[0].amount || "");
  }

  const normalizedValues = previews
    .map((preview) => normalizeAmountDisplay(preview.amount || ""))
    .filter(Boolean);

  if (!normalizedValues.length) {
    return normalizeAmountDisplay(previews[0].amount || "");
  }

  const uniqueRawValues = Array.from(new Set(normalizedValues));

  if (uniqueRawValues.length === 1) {
    return uniqueRawValues[0];
  }

  const parsed = normalizedValues
    .map((value) => parseAmountLikeValue(value))
    .filter((item): item is { value: number; suffix: string; raw: string } =>
      Boolean(item)
    );

  if (!parsed.length) {
    return normalizedValues[0] || "";
  }

  const total = parsed.reduce((sum, item) => sum + item.value, 0);
  const suffix = parsed.find((item) => item.suffix)?.suffix || "";

  return `${formatNumber(total)}${suffix ? ` ${suffix}` : ""}`;
}

function parseAmountLikeValue(value: string) {
  const clean = String(value || "").trim();
  if (!clean) return null;

  const normalized = clean.replace(/,/g, "");
  const numberMatch = normalized.match(/-?\d+(\.\d+)?/);
  if (!numberMatch) return null;

  const numberValue = Number(numberMatch[0]);
  if (Number.isNaN(numberValue)) return null;

  let suffix = clean.replace(numberMatch[0], "").replace(/[$,]/g, "").trim();

  if (clean.includes("$")) {
    suffix = "USD";
  }

  return {
    value: numberValue,
    suffix,
    raw: normalizeAmountDisplay(clean),
  };
}

function normalizeAmountDisplay(value: string) {
  const clean = String(value || "").trim();

  if (!clean) return "";

  const numberMatch = clean.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!numberMatch) return clean;

  const numberValue = Number(numberMatch[0]);
  const formattedNumber = formatNumber(numberValue);

  if (clean.includes("$")) {
    return `${formattedNumber} USD`;
  }

  const suffix = clean
    .replace(numberMatch[0], "")
    .replace(/[$,]/g, "")
    .trim();

  return `${formattedNumber}${suffix ? ` ${suffix}` : ""}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function getGroupPriority(previews: PreviewItem[]): "Low" | "Medium" | "High" {
  const priorities = previews.map((preview) =>
    String(preview.priority || "").trim().toLowerCase()
  );

  if (priorities.includes("high")) return "High";
  if (priorities.includes("medium")) return "Medium";
  return "Low";
}