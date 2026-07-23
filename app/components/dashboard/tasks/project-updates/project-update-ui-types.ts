import type {
  JsonRecord,
  ProjectUpdateFormState,
  SuggestedProjectUpdateItem,
} from "./project-update-types";

export type ProjectUpdateReviewGroupKey =
  | "ready"
  | "needsReview"
  | "alreadyExists"
  | "alreadyMatches";

export type ProjectUpdateReviewGroup = {
  key: ProjectUpdateReviewGroupKey;
  title: string;
  subtitle: string;
  count: number;
  items: SuggestedProjectUpdateItem[];
};

export type ProjectUpdateReviewModel = {
  readyItems: SuggestedProjectUpdateItem[];
  needsReviewItems: SuggestedProjectUpdateItem[];
  alreadyExistsItems: SuggestedProjectUpdateItem[];
  alreadyMatchesItems: SuggestedProjectUpdateItem[];
  selectedReadyCount: number;
  totalVisibleCount: number;
  headline: string;
  groups: ProjectUpdateReviewGroup[];
};

export type ProjectUpdateV2SharedProps = {
  form: ProjectUpdateFormState;
  isBusy: boolean;
};

export type ProjectUpdateReviewV2Props = ProjectUpdateV2SharedProps & {
  onToggleSuggestedItem: (itemId: string) => void;
  onUpdateSuggestedItemValue: (
    itemId: string,
    field: string,
    value: string
  ) => void;
};

export type ProjectUpdateInputV2Props = ProjectUpdateV2SharedProps & {
  onRawInputChange: (value: string) => void;
  onInputMethodChange: (value: "text" | "image") => void;
  onImageSelected: (file: File) => void;
  onRemoveImage: () => void;
  onImageError: (message: string | null) => void;
};

export type EditableSuggestionValue = JsonRecord;

export function isApplyableProjectUpdateItem(item: SuggestedProjectUpdateItem) {
  return (
    item.type !== "duplicate_warning" &&
    item.type !== "no_action" &&
    item.type !== "needs_review"
  );
}

export function isNeedsReviewProjectUpdateItem(
  item: SuggestedProjectUpdateItem
) {
  return item.type === "needs_review";
}

export function isAlreadyExistsProjectUpdateItem(
  item: SuggestedProjectUpdateItem
) {
  return item.type === "duplicate_warning";
}

export function isAlreadyMatchesProjectUpdateItem(
  item: SuggestedProjectUpdateItem
) {
  return item.type === "no_action";
}

export function isInternalSkippedProjectUpdateItem(
  item: SuggestedProjectUpdateItem
) {
  return item.type === "no_action" && /skipped unclear suggestion/i.test(item.title);
}

export function buildProjectUpdateReviewModel(
  form: ProjectUpdateFormState
): ProjectUpdateReviewModel {
  const items = form.analysisResult?.items ?? [];
  const visibleItems = items.filter((item) => !isInternalSkippedProjectUpdateItem(item));
  const selectedIds = new Set(form.selectedItemIds);

  const readyItems = visibleItems.filter(isApplyableProjectUpdateItem);
  const needsReviewItems = visibleItems.filter(isNeedsReviewProjectUpdateItem);
  const alreadyExistsItems = visibleItems.filter(isAlreadyExistsProjectUpdateItem);
  const alreadyMatchesItems = visibleItems.filter(isAlreadyMatchesProjectUpdateItem);

  const selectedReadyCount = readyItems.filter((item) =>
    selectedIds.has(item.id)
  ).length;

  const allGroups: ProjectUpdateReviewGroup[] = [
    {
      key: "ready",
      title: "Ready to apply",
      subtitle: "These updates will be applied to the project.",
      count: readyItems.length,
      items: readyItems,
    },
    {
      key: "needsReview",
      title: "Needs review",
      subtitle:
        "Text2Task found a possible related task but could not safely decide on its own.",
      count: needsReviewItems.length,
      items: needsReviewItems,
    },
    {
      key: "alreadyExists",
      title: "Already in project",
      subtitle: "Text2Task found these requested tasks already saved.",
      count: alreadyExistsItems.length,
      items: alreadyExistsItems,
    },
    {
      key: "alreadyMatches",
      title: "Already matches",
      subtitle:
        "The client mentioned these details, but they already match this project.",
      count: alreadyMatchesItems.length,
      items: alreadyMatchesItems,
    },
  ];

  const groups = allGroups.filter((group) => group.count > 0);

  return {
    readyItems,
    needsReviewItems,
    alreadyExistsItems,
    alreadyMatchesItems,
    selectedReadyCount,
    totalVisibleCount: visibleItems.length,
    headline: buildReviewHeadline({
      readyCount: readyItems.length,
      needsReviewCount: needsReviewItems.length,
      alreadyExistsCount: alreadyExistsItems.length,
      alreadyMatchesCount: alreadyMatchesItems.length,
    }),
    groups,
  };
}

function buildReviewHeadline({
  readyCount,
  needsReviewCount,
  alreadyExistsCount,
  alreadyMatchesCount,
}: {
  readyCount: number;
  needsReviewCount: number;
  alreadyExistsCount: number;
  alreadyMatchesCount: number;
}) {
  const parts = [
    readyCount > 0
      ? `${readyCount} ${readyCount === 1 ? "update" : "updates"} ready`
      : null,
    needsReviewCount > 0
      ? `${needsReviewCount} ${needsReviewCount === 1 ? "item needs" : "items need"} review`
      : null,
    alreadyExistsCount > 0
      ? `${alreadyExistsCount} already ${alreadyExistsCount === 1 ? "exists" : "exist"}`
      : null,
    alreadyMatchesCount > 0
      ? `${alreadyMatchesCount} already ${alreadyMatchesCount === 1 ? "matches" : "match"}`
      : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "No project changes found";
}

export function getProjectUpdateItemLabel(item: SuggestedProjectUpdateItem) {
  if (item.type === "new_subtask") return "New task";
  if (item.type === "update_subtask") return "Update task";
  if (item.type === "deadline_change") return "Deadline";
  if (item.type === "budget_change") return "Budget";
  if (item.type === "priority_change") return "Priority";
  if (item.type === "status_change") return "Status";
  if (item.type === "client_detail_change") return "Client details";
  if (item.type === "project_note") return "Project note";
  if (item.type === "client_note") return "Client note";
  if (item.type === "duplicate_warning") return "Already exists";
  if (item.type === "no_action") return "Already matches";
  if (item.type === "needs_review") return "Needs review";

  return "Project update";
}

export type ProjectUpdateSummaryVariant = "ready" | "needsReview" | "handled";

/**
 * Decides which of the three compact-summary states applies. Pulled out as
 * a pure function (no JSX) so this decision -- specifically, that
 * "everything is already handled" must never be shown while unresolved
 * needs-review items exist -- is directly unit-testable without rendering
 * the review card.
 */
export function resolveProjectUpdateSummaryVariant({
  readyCount,
  needsReviewCount,
}: {
  readyCount: number;
  needsReviewCount: number;
}): ProjectUpdateSummaryVariant {
  if (readyCount > 0) return "ready";
  if (needsReviewCount > 0) return "needsReview";

  return "handled";
}

export function getStringValue(record: JsonRecord | null, keys: string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

export function truncateProjectUpdateText(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}