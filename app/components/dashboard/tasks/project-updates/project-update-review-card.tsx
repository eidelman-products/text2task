"use client";

import type { CSSProperties, ReactNode } from "react";

import type {
  JsonRecord,
  SuggestedProjectUpdateItem,
} from "./project-update-types";
import * as ui from "./project-update-ui-styles";
import {
  buildProjectUpdateReviewModel,
  getProjectUpdateItemLabel,
  getStringValue,
  resolveProjectUpdateSummaryVariant,
  type ProjectUpdateReviewV2Props,
} from "./project-update-ui-types";

const NEEDS_REVIEW_CONTEXT_KEYS = [
  "existing_title",
  "existingTitle",
  "existing_task_title",
];

const STATUS_OPTIONS = ["New", "In Progress", "Review", "Urgent", "Done"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High"];
const CLIENT_DETAIL_FIELDS = [
  {
    key: "client_name",
    label: "client name",
    keys: ["client_name", "clientName", "name"],
  },
  {
    key: "contact_name",
    label: "contact name",
    keys: ["contact_name", "contactName"],
  },
  {
    key: "email",
    label: "email",
    keys: ["email"],
  },
  {
    key: "phone",
    label: "phone",
    keys: ["phone"],
  },
  {
    key: "notes",
    label: "notes",
    keys: ["notes", "client_notes", "clientNotes"],
  },
] as const;

export default function ProjectUpdateReviewCard({
  form,
  isBusy,
  onToggleSuggestedItem,
  onUpdateSuggestedItemValue,
}: ProjectUpdateReviewV2Props) {
  const reviewModel = buildProjectUpdateReviewModel(form);
  const selectedItemIds = new Set(form.selectedItemIds);

  const handledCount =
    reviewModel.alreadyExistsItems.length + reviewModel.alreadyMatchesItems.length;

  return (
    <aside className={ui.responsiveClassNames.reviewCard} style={reviewPanelStyle}>
      <Header
        title="Suggested update plan"
        text={
          form.analysisResult
            ? null
            : "Analyze the client update to see what should be saved."
        }
      />

      {!form.analysisResult && !form.isAnalyzing && !form.analysisError ? (
        <EmptyState
          icon="⚡"
          title="No update analyzed yet"
          text="Analyze the update to see what can be safely changed."
        />
      ) : null}

      {form.isAnalyzing ? (
        <EmptyState
          icon={<span style={ui.loadingSpinner} />}
          title="Analyzing update"
          text="Comparing the client update with the current project and subtasks."
        />
      ) : null}

      {!form.isAnalyzing && form.analysisError ? (
        <div style={ui.errorBox}>{form.analysisError}</div>
      ) : null}

      {!form.isAnalyzing && !form.analysisError && form.analysisResult ? (
        <div style={reviewBodyStyle}>
          <CompactSummary
            readyItems={reviewModel.readyItems}
            selectedItemIds={selectedItemIds}
            handledCount={handledCount}
            needsReviewCount={reviewModel.needsReviewItems.length}
          />

          {reviewModel.readyItems.length > 0 ? (
            <section style={readySectionStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h4 style={sectionTitleStyle}>
                    {getReadySectionTitle(reviewModel.readyItems)}
                  </h4>
                </div>

                <span style={countPillStyle}>{reviewModel.readyItems.length}</span>
              </div>

              <div style={readyListStyle}>
                {reviewModel.readyItems.map((item) => (
                  <ReadyUpdateRow
                    key={item.id}
                    item={item}
                    isSelected={selectedItemIds.has(item.id)}
                    editedValue={form.editedItemValues[item.id] || item.new_value || {}}
                    isBusy={isBusy || Boolean(form.applySuccessMessage)}
                    onToggleSuggestedItem={onToggleSuggestedItem}
                    onUpdateSuggestedItemValue={onUpdateSuggestedItemValue}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <NeedsReviewFindings items={reviewModel.needsReviewItems} />

          <SecondaryFindings
            alreadyExistsItems={reviewModel.alreadyExistsItems}
            alreadyMatchesItems={reviewModel.alreadyMatchesItems}
            hasReadyItems={reviewModel.readyItems.length > 0}
          />

          {reviewModel.totalVisibleCount === 0 ? (
            <EmptyState
              icon="✓"
              title="Nothing clear to apply"
              text="The update was analyzed, but Text2Task did not find a safe project change."
            />
          ) : null}

          {form.applyError ? <div style={ui.errorBox}>{form.applyError}</div> : null}

          {form.applySuccessMessage ? (
            <div style={ui.successBox}>{form.applySuccessMessage}</div>
          ) : null}

          {form.applyPlaceholderMessage ? (
            <div style={ui.successBox}>{form.applyPlaceholderMessage}</div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function Header({ title, text }: { title: string; text?: string | null }) {
  return (
    <div style={headerStyle}>
      <div>
        <h3 style={reviewTitleStyle}>{title}</h3>
        {text ? <p style={reviewTextStyle}>{text}</p> : null}
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div style={emptyStateStyle}>
      <div style={emptyIconStyle}>{icon}</div>
      <h4 style={emptyTitleStyle}>{title}</h4>
      <p style={emptyTextStyle}>{text}</p>
    </div>
  );
}

function CompactSummary({
  readyItems,
  selectedItemIds,
  handledCount,
  needsReviewCount,
}: {
  readyItems: SuggestedProjectUpdateItem[];
  selectedItemIds: Set<string>;
  handledCount: number;
  needsReviewCount: number;
}) {
  const readyCount = readyItems.length;
  const selectedReady = readyItems.filter((item) => selectedItemIds.has(item.id)).length;
  const noReady = readyCount === 0;
  const variant = resolveProjectUpdateSummaryVariant({
    readyCount,
    needsReviewCount,
  });
  const needsReview = variant === "needsReview";

  const title =
    variant === "needsReview"
      ? "Review required"
      : variant === "handled"
        ? "Everything is already handled"
        : "Ready to save";

  const subtitle =
    variant === "needsReview"
      ? `Text2Task found ${needsReviewCount} item${needsReviewCount === 1 ? "" : "s"} that could not be matched safely. Review ${needsReviewCount === 1 ? "it" : "them"} below before saving.`
      : variant === "handled"
        ? handledCount > 0
          ? `${handledCount} existing item${handledCount === 1 ? "" : "s"} detected. No duplicates will be created.`
          : "No new changes need to be saved."
        : getReadyHeroSubtitle(readyItems, selectedItemIds);

  return (
    <section className={ui.responsiveClassNames.reviewSummary} style={summaryRowStyle}>
      <div style={summaryLeftStyle}>
        <span
          style={
            needsReview
              ? summaryIconReviewStyle
              : noReady
                ? summaryIconDoneStyle
                : summaryIconReadyStyle
          }
        >
          {needsReview ? "!" : noReady ? "✓" : "→"}
        </span>

        <div style={{ minWidth: 0 }}>
          <h4 style={summaryTitleStyle}>{title}</h4>
          <p style={summaryTextStyle}>{subtitle}</p>
        </div>
      </div>

      {!noReady ? (
        <span style={summaryMetaPillStyle}>
          {selectedReady}/{readyCount} selected
        </span>
      ) : needsReview ? (
        <span style={summaryReviewPillStyle}>Needs review</span>
      ) : (
        <span style={summaryDonePillStyle}>Protected</span>
      )}
    </section>
  );
}

function ReadyUpdateRow({
  item,
  isSelected,
  editedValue,
  isBusy,
  onToggleSuggestedItem,
  onUpdateSuggestedItemValue,
}: {
  item: SuggestedProjectUpdateItem;
  isSelected: boolean;
  editedValue: JsonRecord;
  isBusy: boolean;
  onToggleSuggestedItem: (itemId: string) => void;
  onUpdateSuggestedItemValue: (
    itemId: string,
    field: string,
    value: string
  ) => void;
}) {
  const disabled = !isSelected || isBusy;
  const itemTypeLabel = getReadyItemTypeLabel(item);

  return (
    <article style={{ ...readyItemStyle, opacity: isSelected ? 1 : 0.58 }}>
      <div
        className={ui.responsiveClassNames.reviewItemHeader}
        style={readyItemHeaderStyle}
      >
        <div style={readyItemMainStyle}>
          <span style={typeChipStyle}>{itemTypeLabel}</span>

          <h5 style={readyItemTitleStyle}>{item.title}</h5>
        </div>

        <label
          style={{
            ...selectedControlStyle,
            ...(isSelected ? selectedControlActiveStyle : selectedControlInactiveStyle),
          }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            disabled={isBusy}
            onChange={() => onToggleSuggestedItem(item.id)}
            style={ui.checkbox}
          />
          <span>{isSelected ? "Will be saved" : "Not saved"}</span>
        </label>
      </div>

      <details style={detailsWrapStyle}>
        <summary style={detailsSummaryStyle}>Edit saved details</summary>

        <EditableFields
          item={item}
          editedValue={editedValue}
          disabled={disabled}
          onUpdate={(field, value) =>
            onUpdateSuggestedItemValue(item.id, field, value)
          }
        />
      </details>
    </article>
  );
}

function EditableFields({
  item,
  editedValue,
  disabled,
  onUpdate,
}: {
  item: SuggestedProjectUpdateItem;
  editedValue: JsonRecord;
  disabled: boolean;
  onUpdate: (field: string, value: string) => void;
}) {
  if (item.type === "new_subtask" || item.type === "update_subtask") {
    const title =
      getStringValue(editedValue, ["task_title", "title", "name"]) || item.title;

    const status = getStringValue(editedValue, ["status"]) || "New";
    const priority = getStringValue(editedValue, ["priority"]) || "Medium";

    return (
      <div style={inlineEditStyle}>
        <TextField
          label="Saved title"
          value={title}
          disabled={disabled}
          onChange={(value) => onUpdate("task_title", value)}
        />

        <div className={ui.responsiveClassNames.reviewFields} style={twoColumnStyle}>
          <SelectField
            label="Status"
            value={status}
            options={STATUS_OPTIONS}
            disabled={disabled}
            onChange={(value) => onUpdate("status", value)}
          />

          <SelectField
            label="Priority"
            value={priority}
            options={PRIORITY_OPTIONS}
            disabled={disabled}
            onChange={(value) => onUpdate("priority", value)}
          />
        </div>
      </div>
    );
  }

  if (item.type === "deadline_change") {
    const current =
      getStringValue(item.old_value, ["deadline_text", "deadline", "value"]) ||
      "Not set";

    const next =
      getStringValue(editedValue, ["deadline_text", "deadline", "value"]) || "";

    return (
      <div style={inlineEditStyle}>
        <div className={ui.responsiveClassNames.reviewFields} style={twoColumnStyle}>
          <ReadOnlyField label="Current deadline" value={current} />

          <TextField
            label="Suggested deadline"
            value={next.replace(/^by\s+/i, "")}
            disabled={disabled}
            onChange={(value) => onUpdate("deadline_text", value)}
          />
        </div>
      </div>
    );
  }

  if (item.type === "priority_change") {
    const current =
      getStringValue(item.old_value, ["priority", "value"]) || "Not set";

    const next =
      getStringValue(editedValue, ["priority", "value"]) || "Medium";

    return (
      <div style={inlineEditStyle}>
        <div className={ui.responsiveClassNames.reviewFields} style={twoColumnStyle}>
          <ReadOnlyField label="Current priority" value={current} />

          <SelectField
            label="Suggested priority"
            value={next}
            options={PRIORITY_OPTIONS}
            disabled={disabled}
            onChange={(value) => onUpdate("priority", value)}
          />
        </div>
      </div>
    );
  }

  if (item.type === "status_change") {
    const current =
      getStringValue(item.old_value, ["status", "value"]) || "Not set";

    const next = getStringValue(editedValue, ["status", "value"]) || "New";

    return (
      <div style={inlineEditStyle}>
        <div className={ui.responsiveClassNames.reviewFields} style={twoColumnStyle}>
          <ReadOnlyField label="Current status" value={current} />

          <SelectField
            label="Suggested status"
            value={next}
            options={STATUS_OPTIONS}
            disabled={disabled}
            onChange={(value) => onUpdate("status", value)}
          />
        </div>
      </div>
    );
  }

  if (item.type === "budget_change") {
    const current =
      getStringValue(item.old_value, ["amount", "budget", "price", "value"]) ||
      "Not set";

    const next =
      getStringValue(editedValue, ["amount", "budget", "price", "value"]) || "";

    return (
      <div style={inlineEditStyle}>
        <div className={ui.responsiveClassNames.reviewFields} style={twoColumnStyle}>
          <ReadOnlyField label="Current budget" value={current} />

          <TextField
            label="Suggested budget"
            value={next}
            disabled={disabled}
            onChange={(value) => onUpdate("amount", value)}
          />
        </div>
      </div>
    );
  }

  if (item.type === "client_detail_change") {
    const visibleFields = CLIENT_DETAIL_FIELDS.filter((field) =>
      hasClientDetailField(editedValue, field.keys) ||
      hasClientDetailField(item.new_value, field.keys)
    );

    if (visibleFields.length === 0) {
      return null;
    }

    return (
      <div style={inlineEditStyle}>
        {visibleFields.map((field) => {
          const current =
            getClientDetailStringValue(item.old_value, field.keys) || "Not set";
          const next =
            getClientDetailStringValue(editedValue, field.keys) ||
            getClientDetailStringValue(item.new_value, field.keys) ||
            "";

          return (
            <div
              key={field.key}
              className={ui.responsiveClassNames.reviewFields}
              style={twoColumnStyle}
            >
              <ReadOnlyField label={`Current ${field.label}`} value={current} />

              <TextField
                label={`Suggested ${field.label}`}
                value={next}
                disabled={disabled}
                onChange={(value) => onUpdate(field.key, value)}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}

function hasClientDetailField(
  record: JsonRecord | null,
  keys: readonly string[]
) {
  if (!record) return false;

  return keys.some((key) => Object.prototype.hasOwnProperty.call(record, key));
}

function getClientDetailStringValue(
  record: JsonRecord | null,
  keys: ReadonlyArray<string>
) {
  return getStringValue(record, [...keys]);
}

function SecondaryFindings({
  alreadyExistsItems,
  alreadyMatchesItems,
  hasReadyItems,
}: {
  alreadyExistsItems: SuggestedProjectUpdateItem[];
  alreadyMatchesItems: SuggestedProjectUpdateItem[];
  hasReadyItems: boolean;
}) {
  const findings = [
    ...alreadyExistsItems.map((item) => ({
      id: item.id,
      title: formatSecondaryFindingTitle(getDuplicateFindingTitle(item)),
    })),
    ...alreadyMatchesItems.map((item) => ({
      id: item.id,
      title: formatSecondaryFindingTitle(cleanNoActionTitle(item.title)),
    })),
  ];

  if (findings.length === 0) {
    return null;
  }

  return (
    <section style={hasReadyItems ? handledSectionCompactStyle : handledSectionStyle}>
      <div style={handledHeaderStyle}>
        <div style={handledTitleGroupStyle}>
          <span style={handledIconStyle}>✓</span>

          <div>
            <h4 style={handledTitleStyle}>Already handled</h4>
            <p style={handledTextStyle}>
              {findings.length} existing item{findings.length === 1 ? "" : "s"}{" "}
              detected. These will not be duplicated.
            </p>
          </div>
        </div>

        <span style={handledCountStyle}>{findings.length}</span>
      </div>

      <div style={findingsListStyle}>
        {findings.map((finding) => (
          <div key={finding.id} style={findingRowStyle}>
            <span style={findingDotStyle}>✓</span>

            <div style={{ minWidth: 0 }}>
              <div style={findingTitleStyle}>{finding.title}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function NeedsReviewFindings({
  items,
}: {
  items: SuggestedProjectUpdateItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section style={needsReviewSectionStyle}>
      <div style={needsReviewHeaderStyle}>
        <div style={needsReviewTitleGroupStyle}>
          <span style={needsReviewIconStyle}>!</span>

          <div>
            <h4 style={needsReviewTitleStyle}>Needs review</h4>
            <p style={needsReviewTextStyle}>
              Text2Task found a possible related task but couldn&apos;t safely
              decide on its own. These are not saved automatically.
            </p>
          </div>
        </div>

        <span style={needsReviewCountStyle}>{items.length}</span>
      </div>

      <div style={needsReviewListStyle}>
        {items.map((item) => {
          const nearestTaskTitle = getStringValue(
            item.old_value,
            NEEDS_REVIEW_CONTEXT_KEYS
          );

          return (
            <div key={item.id} style={needsReviewRowStyle}>
              <span style={needsReviewDotStyle}>!</span>

              <div style={{ minWidth: 0 }}>
                <div style={needsReviewItemTitleStyle}>{item.title}</div>

                {item.description ? (
                  <p style={needsReviewReasonStyle}>{item.description}</p>
                ) : null}

                {nearestTaskTitle ? (
                  <p style={needsReviewReasonStyle}>
                    Nearest existing task: {nearestTaskTitle}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TextField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label style={fieldStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        style={disabled ? inputDisabledStyle : inputStyle}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label style={fieldStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        style={disabled ? inputDisabledStyle : inputStyle}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div style={fieldStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      <span style={readOnlyValueStyle}>{value}</span>
    </div>
  );
}

function getDuplicateFindingTitle(item: SuggestedProjectUpdateItem) {
  return (
    getStringValue(item.new_value, [
      "proposed_title",
      "proposedTitle",
      "task_title",
      "title",
    ]) ||
    getStringValue(item.old_value, [
      "existing_title",
      "existingTitle",
      "existing_task_title",
    ]) ||
    item.title
  );
}

function cleanNoActionTitle(value: string) {
  return value.replace(/^No action:\s*/i, "");
}

function formatSecondaryFindingTitle(title: string) {
  if (/^Priority already matches this project$/i.test(title)) {
    return "Project priority already matches";
  }

  if (/^Deadline already matches this project$/i.test(title)) {
    return "Project deadline already matches";
  }

  return title;
}

function getReadySectionTitle(items: SuggestedProjectUpdateItem[]) {
  if (items.length !== 1) return "Suggested changes";

  const item = items[0];
  if (!item) return "Suggested change";

  if (item.type === "new_subtask") return "New task suggested";
  if (item.type === "update_subtask") return "Task update suggested";
  if (item.type === "deadline_change") return "Deadline update suggested";
  if (item.type === "priority_change") return "Priority update suggested";
  if (item.type === "status_change") return "Status update suggested";
  if (item.type === "budget_change") return "Budget update suggested";

  return "Suggested change";
}

function getReadyHeroSubtitle(
  items: SuggestedProjectUpdateItem[],
  selectedItemIds: Set<string>
) {
  const totalReady = items.length;
  const selectedReady = items.filter((item) => selectedItemIds.has(item.id)).length;

  if (totalReady === 1) {
    return selectedReady === 1
      ? "1 change selected and ready to apply."
      : "1 change found, but it is not selected.";
  }

  if (selectedReady === totalReady) {
    return `${totalReady} changes selected and ready to apply.`;
  }

  return `${selectedReady} of ${totalReady} changes selected.`;
}

function getReadyItemTypeLabel(item: SuggestedProjectUpdateItem) {
  if (item.type === "update_subtask") return "Task update";
  if (item.type === "new_subtask") return "New task";

  return getProjectUpdateItemLabel(item);
}

const reviewPanelStyle: CSSProperties = {
  minWidth: 0,
  borderRadius: 22,
  border: "1px solid rgba(191, 219, 254, 0.72)",
  background: "#ffffff",
  padding: 20,
  display: "grid",
  alignContent: "start",
  gap: 16,
  boxShadow: "0 18px 44px rgba(15, 23, 42, 0.06)",
  boxSizing: "border-box",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
};

const reviewTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 17,
  lineHeight: 1.2,
  fontWeight: 950,
  letterSpacing: "-0.035em",
};

const reviewTextStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 700,
};

const reviewBodyStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  minWidth: 0,
};

const emptyStateStyle: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(226, 232, 240, 0.9)",
  background: "#f8fafc",
  padding: "32px 18px",
  display: "grid",
  justifyItems: "center",
  gap: 8,
  textAlign: "center",
};

const emptyIconStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#2563eb",
  fontSize: 18,
  fontWeight: 900,
};

const emptyTitleStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#0f172a",
  fontSize: 14,
  lineHeight: 1.25,
  fontWeight: 900,
};

const emptyTextStyle: CSSProperties = {
  margin: 0,
  maxWidth: 340,
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 650,
};

const summaryRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  padding: "0 0 14px",
  borderBottom: "1px solid rgba(226, 232, 240, 0.92)",
};

const summaryLeftStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  minWidth: 0,
};

const summaryIconReadyStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  color: "#ffffff",
  background: "#2563eb",
  border: "1px solid rgba(37, 99, 235, 0.3)",
  boxShadow: "0 8px 18px rgba(37, 99, 235, 0.18)",
  fontSize: 13,
  fontWeight: 950,
};

const summaryIconDoneStyle: CSSProperties = {
  ...summaryIconReadyStyle,
  background: "#16a34a",
  border: "1px solid rgba(22, 163, 74, 0.28)",
  boxShadow: "0 8px 18px rgba(22, 163, 74, 0.14)",
};

const summaryTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 16,
  lineHeight: 1.15,
  fontWeight: 950,
  letterSpacing: "-0.03em",
};

const summaryTextStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#475569",
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 700,
};

const summaryMetaPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "0 9px",
  borderRadius: 999,
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 10.5,
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const summaryDonePillStyle: CSSProperties = {
  ...summaryMetaPillStyle,
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#15803d",
};

const summaryIconReviewStyle: CSSProperties = {
  ...summaryIconReadyStyle,
  background: "#d97706",
  border: "1px solid rgba(217, 119, 6, 0.28)",
  boxShadow: "0 8px 18px rgba(217, 119, 6, 0.14)",
};

const summaryReviewPillStyle: CSSProperties = {
  ...summaryMetaPillStyle,
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#b45309",
};

const readySectionStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 13.5,
  lineHeight: 1.25,
  fontWeight: 950,
  letterSpacing: "-0.02em",
};

const countPillStyle: CSSProperties = {
  minWidth: 20,
  height: 20,
  padding: "0 6px",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  borderRadius: 999,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#94a3b8",
  fontSize: 10,
  fontWeight: 850,
};

const readyListStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const readyItemStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "0 0 15px",
  borderBottom: "1px solid rgba(226, 232, 240, 0.92)",
  background: "transparent",
  boxShadow: "none",
};

const readyItemHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "var(--project-update-review-item-header-columns, minmax(0, 1fr) auto)",
  alignItems: "start",
  gap: 14,
};

const readyItemMainStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  minWidth: 0,
};

const typeChipStyle: CSSProperties = {
  display: "none",
  width: "fit-content",
  flexShrink: 0,
  borderRadius: 999,
  padding: "4px 8px",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 850,
};

const selectedControlStyle: CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 9px",
  borderRadius: 999,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 10.5,
  fontWeight: 850,
  cursor: "pointer",
  boxShadow: "none",
};

const selectedControlActiveStyle: CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
};

const selectedControlInactiveStyle: CSSProperties = {
  border: "1px solid rgba(226, 232, 240, 0.86)",
  background: "#ffffff",
  color: "#64748b",
};

const readyItemTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 20,
  lineHeight: 1.22,
  fontWeight: 950,
  letterSpacing: "-0.04em",
};

const detailsWrapStyle: CSSProperties = {
  marginTop: 2,
};

const detailsSummaryStyle: CSSProperties = {
  width: "fit-content",
  cursor: "pointer",
  color: "#2563eb",
  fontSize: 11.5,
  lineHeight: 1.3,
  fontWeight: 850,
  listStyle: "none",
  padding: "4px 0",
};

const inlineEditStyle: CSSProperties = {
  display: "grid",
  gap: 9,
  marginTop: 8,
  padding: "12px 0 0",
  borderTop: "1px solid rgba(226, 232, 240, 0.9)",
  background: "transparent",
};

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "var(--project-update-review-field-columns, repeat(2, minmax(0, 1fr)))",
  gap: 10,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 0,
};

const fieldLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 9.5,
  fontWeight: 850,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 36,
  minWidth: 0,
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 12.5,
  fontWeight: 680,
  padding: "8px 10px",
  outline: "none",
  boxShadow: "none",
};

const inputDisabledStyle: CSSProperties = {
  ...inputStyle,
  cursor: "not-allowed",
  background: "#f8fafc",
  borderColor: "#e2e8f0",
  color: "#64748b",
};

const readOnlyValueStyle: CSSProperties = {
  minHeight: 36,
  display: "flex",
  alignItems: "center",
  color: "#334155",
  fontSize: 12.5,
  fontWeight: 780,
  lineHeight: 1.35,
};

const handledSectionStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  borderRadius: 18,
  border: "1px solid rgba(134, 239, 172, 0.8)",
  background: "linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)",
  padding: 14,
  boxShadow: "0 12px 28px rgba(22, 163, 74, 0.06)",
};

const handledSectionCompactStyle: CSSProperties = {
  ...handledSectionStyle,
  marginTop: 0,
};

const handledHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const handledTitleGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  minWidth: 0,
};

const handledIconStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  border: "1px solid rgba(134, 239, 172, 0.9)",
  background: "#dcfce7",
  color: "#15803d",
  fontSize: 13,
  fontWeight: 950,
};

const handledTitleStyle: CSSProperties = {
  margin: 0,
  color: "#166534",
  fontSize: 15,
  lineHeight: 1.2,
  fontWeight: 950,
  letterSpacing: "-0.02em",
};

const handledTextStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#334155",
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 720,
};

const handledCountStyle: CSSProperties = {
  minWidth: 24,
  height: 24,
  padding: "0 7px",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  borderRadius: 999,
  border: "1px solid rgba(134, 239, 172, 0.9)",
  background: "#ffffff",
  color: "#15803d",
  fontSize: 11,
  fontWeight: 900,
};

const findingsListStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const findingRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "22px minmax(0, 1fr)",
  alignItems: "start",
  gap: 8,
  padding: "4px 0",
};

const findingDotStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  fontSize: 10,
  fontWeight: 950,
  border: "1px solid rgba(134, 239, 172, 0.9)",
  background: "#ffffff",
  color: "#15803d",
};

const findingTitleStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 780,
};

const needsReviewSectionStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  borderRadius: 18,
  border: "1px solid rgba(253, 230, 138, 0.9)",
  background: "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)",
  padding: 14,
  boxShadow: "0 12px 28px rgba(217, 119, 6, 0.06)",
};

const needsReviewHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const needsReviewTitleGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  minWidth: 0,
};

const needsReviewIconStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  border: "1px solid rgba(253, 230, 138, 0.9)",
  background: "#fef3c7",
  color: "#b45309",
  fontSize: 13,
  fontWeight: 950,
};

const needsReviewTitleStyle: CSSProperties = {
  margin: 0,
  color: "#92400e",
  fontSize: 15,
  lineHeight: 1.2,
  fontWeight: 950,
  letterSpacing: "-0.02em",
};

const needsReviewTextStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#334155",
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 720,
};

const needsReviewCountStyle: CSSProperties = {
  minWidth: 24,
  height: 24,
  padding: "0 7px",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  borderRadius: 999,
  border: "1px solid rgba(253, 230, 138, 0.9)",
  background: "#ffffff",
  color: "#b45309",
  fontSize: 11,
  fontWeight: 900,
};

const needsReviewListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const needsReviewRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "22px minmax(0, 1fr)",
  alignItems: "start",
  gap: 8,
  padding: "4px 0",
};

const needsReviewDotStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  fontSize: 10,
  fontWeight: 950,
  border: "1px solid rgba(253, 230, 138, 0.9)",
  background: "#ffffff",
  color: "#b45309",
};

const needsReviewItemTitleStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 780,
};

const needsReviewReasonStyle: CSSProperties = {
  margin: "3px 0 0",
  color: "#64748b",
  fontSize: 11,
  lineHeight: 1.4,
  fontWeight: 650,
};
