"use client";

import AiProjectReviewPanel from "./extract/ai-project-review-panel";
import type {
  ExtractedPreview,
  ExtractedPreviewPriority,
  HybridAppliedChange,
  HybridPreviewMeta,
} from "@/lib/preview/hybrid-preview";
import type { TextExtractedProjectMetadata } from "@/lib/extraction/schemas";
import { parseAmount } from "@/lib/tasks/parse-amount";
import { parseDeadline } from "@/lib/tasks/parse-deadline";

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

export type PreviewProjectMetadata = TextExtractedProjectMetadata;
export type PreviewProjectPriority = ExtractedPreviewPriority;

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
  deadlineDate?: string | null;
  priority: PreviewProjectPriority | "";
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
  projectMetadata?: PreviewProjectMetadata | null;
  projectPriorityOverride?: PreviewProjectPriority | null;
  onChange: (index: number, field: PreviewFieldName, value: string) => void;
  onProjectPriorityChange?: (priority: PreviewProjectPriority) => void;
  onUndoChange?: (previewId: string, change: HybridAppliedChange) => void;
  onRemovePreviewItem: (previewId: string) => void;

  duplicateWarnings?: Record<string, LegacyDuplicateWarning>;
  savingPreviewIds?: Record<string, boolean>;
  onSaveDuplicateAnyway?: (previewId: string) => void;
  onSkipDuplicate?: (previewId: string) => void;
};

export default function EditablePreviewList({
  previewItems,
  aiMetaByPreviewId,
  projectMetadata = null,
  projectPriorityOverride = null,
  onChange,
  onProjectPriorityChange,
  onRemovePreviewItem,
}: EditablePreviewListProps) {
  const previewGroups = buildPreviewProjectGroups(
    previewItems,
    projectMetadata,
    projectPriorityOverride
  );

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
          onProjectPriorityChange={onProjectPriorityChange}
          onRemovePreviewItem={onRemovePreviewItem}
        />
      ))}
    </div>
  );
}

export function buildPreviewProjectGroups(
  previewItems: PreviewItem[],
  projectMetadata: PreviewProjectMetadata | null = null,
  projectPriorityOverride: PreviewProjectPriority | null = null
): PreviewProjectGroup[] {
  const grouped = new Map<
    string,
    Array<{
      preview: PreviewItem;
      originalIndex: number;
    }>
  >();

  previewItems.forEach((preview, originalIndex) => {
    const key = getPreviewProjectKey(preview, projectMetadata);
    const existing = grouped.get(key) || [];

    existing.push({ preview, originalIndex });
    grouped.set(key, existing);
  });

  return Array.from(grouped.entries()).map(([key, items]) => {
    const previews = items.map((item) => item.preview);
    const primary = previews[0];

    const clientName =
      getProjectMetadataText(projectMetadata, "client_name") ||
      primary?.client?.trim() ||
      "Unassigned";
    const contactName =
      getProjectMetadataText(projectMetadata, "contact_name") ||
      getFirstFilled(
        previews.flatMap((preview) => [
          preview.contact_name,
          preview.contactName,
          preview.contact_person,
          preview.contactPerson,
        ])
      );

    const projectTitle =
      getProjectMetadataText(projectMetadata, "title") ||
      inferProjectTitle(previews);
    const projectSummary =
      getProjectMetadataText(projectMetadata, "summary") ||
      buildProjectSummary(previews);

    return {
      key,
      clientName,
      contactName,
      projectTitle,
      projectSummary,
      amount: getGroupAmount(previews, projectMetadata),
      deadline: getGroupDeadline(previews, projectMetadata),
      deadlineDate: getGroupDeadlineDate(previews, projectMetadata),
      priority: getGroupPriority(
        previews,
        projectMetadata,
        projectPriorityOverride
      ),
      source: primary?.source || "Project extraction",
      client_phone:
        getProjectMetadataText(projectMetadata, "client_phone") ||
        getFirstFilled(previews.map((preview) => preview.client_phone)),
      client_email:
        getProjectMetadataText(projectMetadata, "client_email") ||
        getFirstFilled(previews.map((preview) => preview.client_email)),
      client_notes:
        getProjectMetadataText(projectMetadata, "client_notes") ||
        getFirstFilled(previews.map((preview) => preview.client_notes)),
      items,
    };
  });
}

export function getPreviewProjectStats(
  previewItems: PreviewItem[],
  projectMetadata: PreviewProjectMetadata | null = null,
  projectPriorityOverride: PreviewProjectPriority | null = null
) {
  const groups = buildPreviewProjectGroups(
    previewItems,
    projectMetadata,
    projectPriorityOverride
  );
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

type ProjectMetadataTextField = keyof Pick<
  PreviewProjectMetadata,
  | "amount"
  | "client_email"
  | "client_name"
  | "client_notes"
  | "client_phone"
  | "contact_name"
  | "currency_code"
  | "deadline_text"
  | "summary"
  | "title"
>;

function hasProjectMetadata(
  projectMetadata: PreviewProjectMetadata | null | undefined
): projectMetadata is PreviewProjectMetadata {
  return projectMetadata !== null && projectMetadata !== undefined;
}

function getProjectMetadataText(
  projectMetadata: PreviewProjectMetadata | null | undefined,
  field: ProjectMetadataTextField
) {
  if (!hasProjectMetadata(projectMetadata)) {
    return "";
  }

  const value = projectMetadata[field];

  return typeof value === "string" ? value.trim() : "";
}

function getPreviewProjectKey(
  preview: PreviewItem,
  projectMetadata: PreviewProjectMetadata | null
) {
  const client = normalize(
    getProjectMetadataText(projectMetadata, "client_name") ||
      preview.client ||
      "Unassigned"
  );
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

function extractExplicitProjectTitle(
  rawInput: string | null | undefined
): string | null {
  const text = String(rawInput || "");
  if (!text.trim()) return null;

  const labelPattern =
    /^\s*(project|project\s+name|project\s+title|job|job\s+name|job\s+title)\s*:\s*(.+?)\s*$/i;

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(labelPattern);
    const value = match?.[2]?.trim() || "";

    if (!value) continue;

    return cleanTitle(value.slice(0, 90));
  }

  return null;
}

function inferCampaignLandingPageTitle(
  rawInput: string | null | undefined
): string | null {
  const text = String(rawInput || "");
  if (!text.trim()) return null;

  const match = text.match(
    /\b(?:new[ \t]+)?landing[ \t]+page[ \t]+for[ \t]+(?:(?:our|the)[ \t]+)?([a-z0-9][a-z0-9'&-]*(?:[ \t]+[a-z0-9][a-z0-9'&-]*){0,2})[ \t]+campaign\b/i
  );
  const campaignName = match?.[1]?.trim() || "";

  if (!campaignName) return null;

  const genericWords = new Set([
    "advertising",
    "brand",
    "business",
    "client",
    "current",
    "digital",
    "latest",
    "marketing",
    "new",
    "next",
    "upcoming",
  ]);
  const campaignWords = campaignName.toLowerCase().split(/\s+/);

  if (campaignWords.some((word) => genericWords.has(word))) {
    return null;
  }

  return `${toTitleCase(campaignName)} campaign landing page`;
}

function inferProjectTitle(previews: PreviewItem[]) {
  const explicitTitle = previews
    .map((preview) => extractExplicitProjectTitle(preview.raw_input))
    .find(Boolean);

  if (explicitTitle) {
    return explicitTitle;
  }

  if (previews.length === 1) {
    return cleanTitle(previews[0].task) || "Client project";
  }

  const campaignLandingPageTitle = previews
    .map((preview) => inferCampaignLandingPageTitle(preview.raw_input))
    .find(Boolean);

  if (campaignLandingPageTitle) {
    return campaignLandingPageTitle;
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

function toTitleCase(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
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

function getGroupDeadline(
  previews: PreviewItem[],
  projectMetadata: PreviewProjectMetadata | null
) {
  if (hasProjectMetadata(projectMetadata)) {
    return getProjectMetadataText(projectMetadata, "deadline_text");
  }

  const firstOriginalDeadline = previews
    .map((preview) => preview.deadline_original_text?.trim())
    .filter(Boolean)[0];

  if (firstOriginalDeadline) return firstOriginalDeadline;

  return (
    previews.map((preview) => preview.deadline?.trim()).filter(Boolean)[0] || ""
  );
}

function getGroupDeadlineDate(
  previews: PreviewItem[],
  projectMetadata: PreviewProjectMetadata | null
) {
  if (hasProjectMetadata(projectMetadata)) {
    const deadlineText = getProjectMetadataText(
      projectMetadata,
      "deadline_text"
    );

    return deadlineText ? parseDeadline(deadlineText).deadlineDate : null;
  }

  return (
    previews.map((preview) => preview.deadline_date?.trim()).filter(Boolean)[0] ||
    null
  );
}

function extractExplicitBudgetAmount(
  rawInput: string | null | undefined
): string | null {
  const text = String(rawInput || "");
  if (!text.trim()) return null;

  const budgetLinePattern =
    /^\s*(total\s+budget|project\s+budget|budget|amount)\b\s*(?::|-|=|is)?\s*(.+?)\s*$/i;

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(budgetLinePattern);
    const value = match?.[2]?.trim() || "";

    if (!value || !hasMoneyEvidence(value)) continue;

    const normalized = normalizeExplicitMoneyValue(value);
    if (normalized) return normalized;
  }

  return null;
}

function getGroupAmount(
  previews: PreviewItem[],
  projectMetadata: PreviewProjectMetadata | null
) {
  if (hasProjectMetadata(projectMetadata)) {
    return getProjectMetadataAmount(projectMetadata);
  }

  const explicitBudget = previews
    .map((preview) => extractExplicitBudgetAmount(preview.raw_input))
    .find(Boolean);

  if (explicitBudget) return explicitBudget;

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

function getProjectMetadataAmount(projectMetadata: PreviewProjectMetadata) {
  const amount = getProjectMetadataText(projectMetadata, "amount");

  if (!amount) {
    return "";
  }

  const parsedAmount = parsePreviewAmount(amount);
  const currencyCode = normalizeCurrencyCode(
    getProjectMetadataText(projectMetadata, "currency_code")
  );

  if (!parsedAmount) {
    return amount;
  }

  if (!parsedAmount.suffix && currencyCode) {
    return `${formatNumber(parsedAmount.value)} ${currencyCode}`;
  }

  return parsedAmount.display;
}

function parseAmountLikeValue(value: string) {
  const parsed = parsePreviewAmount(value);

  return parsed
    ? {
        value: parsed.value,
        suffix: parsed.suffix,
        raw: parsed.display,
      }
    : null;
}

function hasMoneyEvidence(value: string) {
  return (
    /[$€£₪]/.test(value) ||
    /\b(USD|EUR|GBP|ILS|NIS|dollars?|euros?|pounds?|shekels?|sheqels?)\b/i.test(
      value
    )
  );
}

function normalizeExplicitMoneyValue(value: string) {
  const clean = String(value || "").trim();
  if (!clean) return null;

  const symbolBeforeMatch = clean.match(/([$€£₪])\s*([\d,]+(?:\.\d+)?)/);
  if (symbolBeforeMatch) {
    return formatExplicitMoney(symbolBeforeMatch[2], symbolBeforeMatch[1]);
  }

  const codeBeforeMatch = clean.match(
    /\b(USD|EUR|GBP|ILS|NIS|dollars?|euros?|pounds?|shekels?|sheqels?)\b\s*([\d,]+(?:\.\d+)?)/i
  );
  if (codeBeforeMatch) {
    return formatExplicitMoney(codeBeforeMatch[2], codeBeforeMatch[1]);
  }

  const numberBeforeCodeMatch = clean.match(
    /([\d,]+(?:\.\d+)?)\s*\b(USD|EUR|GBP|ILS|NIS|dollars?|euros?|pounds?|shekels?|sheqels?)\b/i
  );
  if (numberBeforeCodeMatch) {
    return formatExplicitMoney(numberBeforeCodeMatch[1], numberBeforeCodeMatch[2]);
  }

  return null;
}

function formatExplicitMoney(rawNumber: string, rawCurrency: string) {
  const amountValue = Number(String(rawNumber || "").replace(/,/g, ""));
  const currencyCode = normalizeCurrencyCode(rawCurrency);

  if (!Number.isFinite(amountValue) || !currencyCode) return null;

  return `${formatNumber(amountValue)} ${currencyCode}`;
}

function normalizeCurrencyCode(value: string) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "$" || normalized === "usd") return "USD";
  if (normalized === "€" || normalized === "eur") return "EUR";
  if (normalized === "£" || normalized === "gbp") return "GBP";
  if (normalized === "₪" || normalized === "ils" || normalized === "nis") {
    return "ILS";
  }
  if (normalized === "dollar" || normalized === "dollars") return "USD";
  if (normalized === "euro" || normalized === "euros") return "EUR";
  if (normalized === "pound" || normalized === "pounds") return "GBP";
  if (
    normalized === "shekel" ||
    normalized === "shekels" ||
    normalized === "sheqel" ||
    normalized === "sheqels"
  ) {
    return "ILS";
  }

  return null;
}

function normalizeAmountDisplay(value: string) {
  const clean = String(value || "").trim();

  if (!clean) return "";

  return parsePreviewAmount(clean)?.display || clean;
}

function parsePreviewAmount(value: string) {
  const parsed = parseAmount(value);

  if (!parsed.matched || parsed.amountValue === null) {
    return null;
  }

  const suffix = parsed.currencyCode?.trim().toUpperCase() || "";
  const display = `${formatNumber(parsed.amountValue)}${
    suffix ? ` ${suffix}` : ""
  }`;

  return {
    value: parsed.amountValue,
    suffix,
    display,
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function getGroupPriority(
  previews: PreviewItem[],
  projectMetadata: PreviewProjectMetadata | null,
  projectPriorityOverride: PreviewProjectPriority | null
): PreviewProjectGroup["priority"] {
  if (hasProjectMetadata(projectMetadata)) {
    if (projectPriorityOverride !== null) {
      return projectPriorityOverride;
    }

    switch (projectMetadata.priority) {
      case "high":
        return "High";
      case "medium":
        return "Medium";
      case "low":
        return "Low";
      case null:
      case undefined:
        return "";
    }
  }

  const priorities = previews.map((preview) =>
    String(preview.priority || "").trim().toLowerCase()
  );

  if (priorities.includes("high")) return "High";
  if (priorities.includes("medium")) return "Medium";
  return "Low";
}
