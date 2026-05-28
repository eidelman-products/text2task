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
  truncateProjectUpdateText,
  type ProjectUpdateReviewV2Props,
} from "./project-update-ui-types";

const STATUS_OPTIONS = ["New", "In Progress", "Review", "Urgent", "Done"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High"];

export default function ProjectUpdateReviewCard({
  form,
  isBusy,
  onToggleSuggestedItem,
  onUpdateSuggestedItemValue,
}: ProjectUpdateReviewV2Props) {
  const reviewModel = buildProjectUpdateReviewModel(form);
  const selectedItemIds = new Set(form.selectedItemIds);

  return (
    <aside style={cleanReviewPanelStyle}>
      <Header
        title="Update review"
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
        <div style={cleanReviewBodyStyle}>
          <CompactSummary
            readyItems={reviewModel.readyItems}
            selectedItemIds={selectedItemIds}
          />

          {reviewModel.readyItems.length > 0 ? (
            <section style={primaryApplySectionStyle}>
              <div style={sectionTopStyle}>
                <div>
                  <h4 style={sectionMainTitleStyle}>
                    {getReadySectionTitle(reviewModel.readyItems)}
                  </h4>
                </div>

                <span style={smallCountStyle}>{reviewModel.readyItems.length}</span>
              </div>

              <div style={simpleListStyle}>
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
    <div style={compactHeaderStyle}>
      <div>
        <h3 style={ui.reviewTitle}>{title}</h3>
        {text ? <p style={ui.reviewText}>{text}</p> : null}
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
    <div style={cleanEmptyStateStyle}>
      <div style={ui.emptyIcon}>{icon}</div>
      <h4 style={ui.emptyTitle}>{title}</h4>
      <p style={ui.emptyText}>{text}</p>
    </div>
  );
}

function CompactSummary({
  readyItems,
  selectedItemIds,
}: {
  readyItems: SuggestedProjectUpdateItem[];
  selectedItemIds: Set<string>;
}) {
  const readyCount = readyItems.length;
  const noReady = readyCount === 0;
  const subtitle = noReady
    ? "No new changes need to be saved."
    : getReadyHeroSubtitle(readyItems, selectedItemIds);

  return (
    <section style={noReady ? handledSummaryStyle : cleanSummaryStyle}>
      <div style={summaryHeaderStyle}>
        <div style={summaryTitleGroupStyle}>
          <span style={noReady ? summaryIconHandledStyle : summaryIconReadyStyle}>
            {noReady ? "✓" : "→"}
          </span>

          <div style={{ minWidth: 0 }}>
          <h4 style={summaryTitleStyle}>
            {noReady ? "Everything is already handled" : "Ready to save"}
          </h4>
          <p style={summarySubtextStyle}>{subtitle}</p>
          </div>
        </div>

        {noReady ? <span style={doneBadgeStyle}>Done ✓</span> : null}
      </div>
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
    <article style={{ ...readyRowStyle, opacity: isSelected ? 1 : 0.62 }}>
      <div style={readyRowTopStyle}>
        <span style={readyTypeChipStyle}>{itemTypeLabel}</span>

        <label style={simpleCheckboxLabelStyle}>
          <input
            type="checkbox"
            checked={isSelected}
            disabled={isBusy}
            onChange={() => onToggleSuggestedItem(item.id)}
            style={ui.checkbox}
          />
          <span>Save this</span>
        </label>
      </div>

      <h5 style={readyTitleStyle}>{item.title}</h5>

      {item.description ? (
        <p style={readyDescriptionStyle}>
          {truncateProjectUpdateText(item.description, 110)}
        </p>
      ) : null}

      <EditableFields
        item={item}
        editedValue={editedValue}
        disabled={disabled}
        onUpdate={(field, value) =>
          onUpdateSuggestedItemValue(item.id, field, value)
        }
      />
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
      <div style={simpleEditBoxStyle}>
        <div style={editHelperStyle}>Edit details before saving.</div>

        <TextField
          label="Task title"
          value={title}
          disabled={disabled}
          onChange={(value) => onUpdate("task_title", value)}
        />

        <div style={compactTwoColumnStyle}>
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
      <div style={simpleEditBoxStyle}>
        <div style={editHelperStyle}>Edit details before saving.</div>

        <ReadOnlyField label="Current deadline" value={current} />

        <TextField
          label="Suggested deadline"
          value={next.replace(/^by\s+/i, "")}
          disabled={disabled}
          onChange={(value) => onUpdate("deadline_text", value)}
        />
      </div>
    );
  }

  if (item.type === "priority_change") {
    const current =
      getStringValue(item.old_value, ["priority", "value"]) || "Not set";

    const next =
      getStringValue(editedValue, ["priority", "value"]) || "Medium";

    return (
      <div style={simpleEditBoxStyle}>
        <div style={editHelperStyle}>Edit details before saving.</div>

        <ReadOnlyField label="Current priority" value={current} />

        <SelectField
          label="Suggested priority"
          value={next}
          options={PRIORITY_OPTIONS}
          disabled={disabled}
          onChange={(value) => onUpdate("priority", value)}
        />
      </div>
    );
  }

  if (item.type === "status_change") {
    const current =
      getStringValue(item.old_value, ["status", "value"]) || "Not set";

    const next = getStringValue(editedValue, ["status", "value"]) || "New";

    return (
      <div style={simpleEditBoxStyle}>
        <div style={editHelperStyle}>Edit details before saving.</div>

        <ReadOnlyField label="Current status" value={current} />

        <SelectField
          label="Suggested status"
          value={next}
          options={STATUS_OPTIONS}
          disabled={disabled}
          onChange={(value) => onUpdate("status", value)}
        />
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
      <div style={simpleEditBoxStyle}>
        <div style={editHelperStyle}>Edit details before saving.</div>

        <ReadOnlyField label="Current budget" value={current} />

        <TextField
          label="Suggested budget"
          value={next}
          disabled={disabled}
          onChange={(value) => onUpdate("amount", value)}
        />
      </div>
    );
  }

  return null;
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
    <section
      style={hasReadyItems ? secondaryFindingsQuietStyle : secondaryFindingsStyle}
    >
      <div style={sectionTopStyle}>
        <div>
          <h4
            style={
              hasReadyItems ? secondarySectionTitleStyle : sectionMainTitleStyle
            }
          >
            Already saved in project
          </h4>
        </div>

        <span style={hasReadyItems ? subtleCountStyle : smallCountStyle}>
          {findings.length}
        </span>
      </div>

      <div style={findingsListStyle}>
        {findings.map((finding) => (
          <div key={finding.id} style={findingRowStyle}>
            <span style={findingDotStyle}>
              ✓
            </span>

            <div style={{ minWidth: 0 }}>
              <div style={findingTitleStyle}>{finding.title}</div>
            </div>
          </div>
        ))}
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
    <label style={compactFieldStyle}>
      <span style={compactLabelStyle}>{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        style={disabled ? compactInputDisabledStyle : compactInputStyle}
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
    <label style={compactFieldStyle}>
      <span style={compactLabelStyle}>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        style={disabled ? compactInputDisabledStyle : compactInputStyle}
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
    <div style={compactFieldStyle}>
      <span style={compactLabelStyle}>{label}</span>
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
  if (items.length !== 1) return "Changes to save";

  const item = items[0];
  if (!item) return "Change to save";

  if (item.type === "new_subtask") return "New task to add";
  if (item.type === "update_subtask") return "Task to update";
  if (item.type === "deadline_change") return "Deadline to update";
  if (item.type === "priority_change") return "Priority to update";
  if (item.type === "status_change") return "Status to update";
  if (item.type === "budget_change") return "Budget to update";

  return "Change to save";
}

function getReadyHeroSubtitle(
  items: SuggestedProjectUpdateItem[],
  selectedItemIds: Set<string>
) {
  const totalReady = items.length;
  const selectedReady = items.filter((item) => selectedItemIds.has(item.id)).length;

  if (totalReady === 1) {
    return selectedReady === 1
      ? "1 change selected"
      : "1 change found · none selected";
  }

  if (selectedReady === totalReady) {
    return `${totalReady} changes selected`;
  }

  return `${selectedReady} of ${totalReady} selected`;
}

function getReadyItemTypeLabel(item: SuggestedProjectUpdateItem) {
  if (item.type === "update_subtask") return "Task update";
  if (item.type === "new_subtask") return "New task";

  return getProjectUpdateItemLabel(item);
}

const cleanReviewPanelStyle: CSSProperties = {
  minWidth: 0,
  borderRadius: 34,
  border: "1px solid rgba(199, 210, 254, 0.64)",
  background:
    "radial-gradient(circle at 100% -8%, rgba(165,180,252,0.82), transparent 38%), radial-gradient(circle at 0% 108%, rgba(240,253,244,0.34), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.998), rgba(248,250,252,0.91))",
  padding: 22,
  display: "grid",
  alignContent: "start",
  gap: 16,
  boxShadow:
    "0 52px 118px rgba(15, 23, 42, 0.16), 0 30px 72px rgba(79, 70, 229, 0.17), 0 0 0 1px rgba(255,255,255,0.58), inset 0 1px 0 rgba(255, 255, 255, 0.98)",
  boxSizing: "border-box",
};

const compactHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
};

const cleanReviewBodyStyle: CSSProperties = {
  display: "grid",
  gap: 13,
  minWidth: 0,
};

const cleanEmptyStateStyle: CSSProperties = {
  borderRadius: 22,
  border: "1px solid rgba(226, 232, 240, 0.86)",
  background: "rgba(248, 250, 252, 0.72)",
  padding: "30px 16px",
  display: "grid",
  justifyItems: "center",
  gap: 7,
  textAlign: "center",
};

const cleanSummaryStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "17px 18px",
  borderRadius: 24,
  border: "1px solid rgba(165,180,252,0.46)",
  borderLeft: "4px solid rgba(99,102,241,0.56)",
  background:
    "radial-gradient(circle at 100% 0%, rgba(199,210,254,0.44), transparent 38%), linear-gradient(135deg, rgba(255,255,255,0.998), rgba(239,246,255,0.9) 52%, rgba(238,242,255,0.58))",
  boxShadow:
    "0 20px 42px rgba(67, 56, 202, 0.105), 0 10px 22px rgba(15,23,42,0.045), inset 0 1px 0 rgba(255,255,255,0.96)",
};

const handledSummaryStyle: CSSProperties = {
  ...cleanSummaryStyle,
  border: "1px solid rgba(187,247,208,0.82)",
  borderLeft: "4px solid rgba(22,163,74,0.68)",
  background:
    "radial-gradient(circle at 100% 0%, rgba(187,247,208,0.58), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.998), rgba(240,253,244,0.92))",
  boxShadow:
    "0 22px 46px rgba(22, 163, 74, 0.11), 0 10px 24px rgba(15,23,42,0.045), inset 0 1px 0 rgba(255,255,255,0.96)",
};

const summaryHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const summaryTitleGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
};

const summaryIconReadyStyle: CSSProperties = {
  width: 37,
  height: 37,
  borderRadius: 15,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  color: "#ffffff",
  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
  border: "1px solid rgba(255,255,255,0.72)",
  boxShadow:
    "0 12px 24px rgba(79,70,229,0.22), inset 0 1px 0 rgba(255,255,255,0.3)",
  fontSize: 17,
  fontWeight: 950,
};

const summaryIconHandledStyle: CSSProperties = {
  ...summaryIconReadyStyle,
  background: "linear-gradient(135deg, #22c55e, #15803d)",
  boxShadow:
    "0 14px 28px rgba(22,163,74,0.2), inset 0 1px 0 rgba(255,255,255,0.28)",
};

const summaryTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 18,
  lineHeight: 1.16,
  fontWeight: 950,
  letterSpacing: "-0.04em",
};

const summarySubtextStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#475569",
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 760,
};

const doneBadgeStyle: CSSProperties = {
  flexShrink: 0,
  padding: "6px 10px",
  borderRadius: 999,
  background:
    "linear-gradient(135deg, rgba(240,253,244,0.98), rgba(220,252,231,0.9))",
  border: "1px solid rgba(187,247,208,0.95)",
  color: "#15803d",
  fontSize: 11,
  fontWeight: 950,
  boxShadow: "0 10px 20px rgba(22,163,74,0.1)",
};

const primaryApplySectionStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  borderRadius: 18,
  border: "none",
  background: "transparent",
  padding: 0,
  boxShadow: "none",
};

const sectionTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
};

const sectionMainTitleStyle: CSSProperties = {
  margin: "1px 0 0",
  color: "#0f172a",
  fontSize: 14,
  lineHeight: 1.25,
  fontWeight: 950,
  letterSpacing: "-0.025em",
};

const smallCountStyle: CSSProperties = {
  width: 22,
  height: 22,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  borderRadius: 999,
  border: "1px solid rgba(226, 232, 240, 0.84)",
  background: "rgba(255, 255, 255, 0.72)",
  color: "#64748b",
  fontSize: 10,
  fontWeight: 950,
};

const subtleCountStyle: CSSProperties = {
  ...smallCountStyle,
  width: 20,
  height: 20,
  background: "rgba(248,250,252,0.54)",
  borderColor: "rgba(226,232,240,0.62)",
  color: "#94a3b8",
  fontSize: 10,
};

const simpleListStyle: CSSProperties = {
  display: "grid",
  gap: 9,
};

const readyRowStyle: CSSProperties = {
  display: "grid",
  gap: 13,
  padding: 23,
  borderRadius: 27,
  border: "1px solid rgba(199,210,254,0.58)",
  borderLeft: "4px solid rgba(99,102,241,0.58)",
  background:
    "radial-gradient(circle at 100% -8%, rgba(224,231,255,0.54), transparent 36%), radial-gradient(circle at 0% 100%, rgba(240,253,250,0.24), transparent 28%), linear-gradient(180deg, rgba(255,255,255,1), rgba(255,255,255,0.965))",
  boxShadow:
    "0 34px 78px rgba(15, 23, 42, 0.145), 0 18px 44px rgba(79,70,229,0.135), 0 0 0 1px rgba(255,255,255,0.68), inset 0 1px 0 rgba(255,255,255,0.98)",
};

const readyRowTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
};

const simpleCheckboxLabelStyle: CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid rgba(226,232,240,0.9)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.86))",
  color: "#64748b",
  fontSize: 10,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(15,23,42,0.032)",
};

const readyTypeChipStyle: CSSProperties = {
  flexShrink: 0,
  borderRadius: 999,
  padding: "5px 9px",
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(238,242,255,0.9) 48%, rgba(224,231,255,0.72))",
  border: "1px solid rgba(165,180,252,0.68)",
  color: "#4338ca",
  fontSize: 10,
  fontWeight: 950,
  boxShadow:
    "0 8px 18px rgba(79,70,229,0.09), inset 0 1px 0 rgba(255,255,255,0.9)",
};

const readyTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 19,
  lineHeight: 1.28,
  fontWeight: 950,
  letterSpacing: "-0.035em",
};

const readyDescriptionStyle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 11,
  lineHeight: 1.45,
  fontWeight: 620,
};

const simpleEditBoxStyle: CSSProperties = {
  display: "grid",
  gap: 9,
  padding: 13,
  borderRadius: 17,
  border: "1px solid rgba(226,232,240,0.44)",
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.44), rgba(255,255,255,0.34))",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.68)",
};

const editHelperStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  lineHeight: 1.35,
  fontWeight: 900,
};

const compactTwoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
};

const compactFieldStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 0,
};

const compactLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
};

const compactInputStyle: CSSProperties = {
  width: "100%",
  minHeight: 44,
  minWidth: 0,
  boxSizing: "border-box",
  border: "1px solid rgba(199,210,254,0.72)",
  borderRadius: 15,
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 800,
  padding: "10px 12px",
  outline: "none",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.94), 0 10px 22px rgba(15,23,42,0.036), 0 0 0 3px rgba(238,242,255,0.2)",
};

const compactInputDisabledStyle: CSSProperties = {
  ...compactInputStyle,
  cursor: "not-allowed",
  background: "rgba(248,250,252,0.86)",
  borderColor: "rgba(226,232,240,0.9)",
};

const readOnlyValueStyle: CSSProperties = {
  color: "#334155",
  fontSize: 12,
  fontWeight: 850,
  lineHeight: 1.35,
  padding: "8px 0",
};

const secondaryFindingsStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  borderRadius: 22,
  border: "1px solid rgba(226,232,240,0.56)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.62), rgba(248,250,252,0.48))",
  padding: 10,
  boxShadow: "0 10px 24px rgba(15,23,42,0.032)",
};

const secondaryFindingsQuietStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  borderRadius: 15,
  border: "1px solid rgba(226,232,240,0.28)",
  background: "rgba(248,250,252,0.2)",
  padding: "6px 7px",
  boxShadow: "none",
};

const secondarySectionTitleStyle: CSSProperties = {
  ...sectionMainTitleStyle,
  margin: 0,
  color: "#64748b",
  fontSize: 12,
  letterSpacing: "-0.01em",
};

const findingsListStyle: CSSProperties = {
  display: "grid",
  gap: 4,
};

const findingRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "20px minmax(0, 1fr)",
  alignItems: "start",
  gap: 7,
  padding: "5px 0",
};

const findingDotStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  fontSize: 10,
  fontWeight: 950,
  border: "1px solid rgba(187,247,208,0.95)",
  background: "rgba(240,253,244,0.94)",
  color: "#15803d",
};

const findingTitleStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 11,
  lineHeight: 1.35,
  fontWeight: 780,
};
