"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { MouseEvent } from "react";
import type { TaskProjectGroup } from "../task-types";
import type {
  JsonRecord,
  ProjectUpdateItemType,
  SuggestedProjectUpdateItem,
} from "./project-update-types";
import type {
  ProjectUpdateHistoryEntry,
  ProjectUpdateHistoryState,
  ProjectUpdateHistoryStatus,
  ProjectUpdateHistoryValueRow,
} from "./project-update-history-types";
import * as styles from "./project-update-history-styles";

type ProjectUpdateHistoryModalProps = {
  state: ProjectUpdateHistoryState;
  onClose: () => void;
  onRefresh: () => void;
};

export default function ProjectUpdateHistoryModal({
  state,
  onClose,
  onRefresh,
}: ProjectUpdateHistoryModalProps) {
  const [expandedUpdateIds, setExpandedUpdateIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!state.isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [state.isOpen]);

  useEffect(() => {
    if (state.isOpen) {
      setExpandedUpdateIds({});
    }
  }, [state.isOpen, state.project]);

  if (!state.isOpen || !state.project) {
    return null;
  }

  function toggleExpanded(updateId: string) {
    setExpandedUpdateIds((current) => ({
      ...current,
      [updateId]: !current[updateId],
    }));
  }

  function handleOverlayClick() {
    onClose();
  }

  function handleModalClick(event: MouseEvent) {
    event.stopPropagation();
  }

  const modal = (
    <div style={styles.historyOverlayStyle} onClick={handleOverlayClick}>
      <div
        style={styles.historyModalStyle}
        onClick={handleModalClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-update-history-title"
      >
        <header style={styles.historyHeaderStyle}>
          <div style={styles.historyHeaderLeftStyle}>
            <div style={styles.historyHeaderIconStyle}>H</div>
            <div>
              <h2 id="project-update-history-title" style={styles.historyTitleStyle}>
                Project update history
              </h2>
              <p style={styles.historySubtitleStyle}>
                Review client updates and changes applied to this project.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close project update history"
            onClick={onClose}
            style={styles.historyCloseButtonStyle}
          >
            x
          </button>
        </header>

        <main style={styles.historyContentStyle}>
          <ProjectContextStrip project={state.project} />

          {!state.isLoading && !state.error && state.updates.length > 0 && (
            <HistorySummaryStrip updates={state.updates} />
          )}

          <div style={styles.historyToolbarStyle}>
            <div style={styles.historyCountStyle}>
              {state.isLoading
                ? "Loading update history..."
                : `${state.updates.length} client ${state.updates.length === 1 ? "update" : "updates"}`}
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={state.isLoading}
              style={{
                ...styles.refreshButtonStyle,
                opacity: state.isLoading ? 0.6 : 1,
                cursor: state.isLoading ? "wait" : "pointer",
              }}
            >
              Refresh
            </button>
          </div>

          {state.isLoading && (
            <StatePanel
              title="Loading update history..."
              text="Text2Task is loading previous client updates for this project."
            />
          )}

          {!state.isLoading && state.error && (
            <StatePanel
              title="Could not load update history"
              text={state.error}
            />
          )}

          {!state.isLoading && !state.error && state.updates.length === 0 && (
            <StatePanel
              title="No client updates yet"
              text="Updates you analyze and apply will appear here."
            />
          )}

          {!state.isLoading && !state.error && state.updates.length > 0 && (
            <section style={styles.historyListStyle}>
              {state.updates.map((entry, index) => {
                const isExpanded =
                  expandedUpdateIds[entry.update.id] ?? index === 0;

                return (
                  <UpdateHistoryCard
                    key={entry.update.id}
                    entry={entry}
                    isLast={index === state.updates.length - 1}
                    isExpanded={isExpanded}
                    onToggleExpanded={() => toggleExpanded(entry.update.id)}
                  />
                );
              })}
            </section>
          )}
        </main>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}

function HistorySummaryStrip({ updates }: { updates: ProjectUpdateHistoryEntry[] }) {
  const metrics = getHistoryMetrics(updates);

  return (
    <section style={styles.summaryStripStyle} aria-label="Project update summary">
      {metrics.map((metric) => (
        <div key={metric.label} style={styles.summaryMetricStyle}>
          <div style={styles.summaryMetricValueStyle}>{metric.value}</div>
          <div style={styles.summaryMetricLabelStyle}>{metric.label}</div>
        </div>
      ))}
    </section>
  );
}

function ProjectContextStrip({ project }: { project: TaskProjectGroup }) {
  const stats = [
    ["Project", project.projectTitle || "Unnamed project"],
    ["Client", project.clientName || "Unknown client"],
    ["Current deadline", project.deadline_original_text || project.deadline || "Not set"],
    ["Budget", project.amount || "Not set"],
    ["Status", project.status || "Not set"],
    ["Subtasks", String(project.subtaskCount || 0)],
  ];

  return (
    <div style={styles.projectContextStripStyle}>
      {stats.map(([label, value]) => (
        <div key={label} style={styles.projectContextStatStyle}>
          <div style={styles.projectContextLabelStyle}>{label}</div>
          <div style={styles.projectContextValueStyle}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function UpdateHistoryCard({
  entry,
  isLast,
  isExpanded,
  onToggleExpanded,
}: {
  entry: ProjectUpdateHistoryEntry;
  isLast: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  const status = getUpdateHistoryStatus(entry);
  const summary = getUpdateSummary(entry);
  const detailCount = entry.items.length;
  const accent = getStatusAccent(status);

  return (
    <div style={styles.timelineEntryStyle}>
      <div style={styles.timelineRailStyle}>
        <div style={{ ...styles.timelineDotStyle, ...accent.dot }} />
        {!isLast && <div style={styles.timelineLineStyle} />}
      </div>

      <article style={{ ...styles.updateCardStyle, ...accent.card }}>
        <div style={styles.updateCardHeaderStyle}>
          <div style={styles.updateMetaStyle}>
            <span style={styles.sourceBadgeStyle}>
              {formatSourceTypeLabel(entry.update.source_type)}
            </span>
            <span style={{ ...styles.statusBadgeStyle, ...accent.badge }}>
              {formatUpdateStatusLabel(status)}
            </span>
          </div>
          <time style={styles.updateDateStyle} dateTime={entry.update.created_at}>
            {formatDateTime(entry.update.applied_at || entry.update.created_at)}
          </time>
        </div>

        <p style={styles.rawInputStyle}>
          {truncateText(entry.update.raw_input || "No client message saved.", 260)}
        </p>

        <div style={styles.summaryRowStyle}>
          {summary.map((label) => (
            <span key={label} style={styles.summaryPillStyle}>
              {label}
            </span>
          ))}
        </div>

        {isExpanded && entry.items.length > 0 && (
          <div style={styles.itemListStyle}>
            {entry.items.map((item) => (
              <UpdateHistoryItem key={item.id} item={item} />
            ))}
          </div>
        )}

        {entry.items.length > 0 && (
          <button type="button" onClick={onToggleExpanded} style={styles.detailsToggleButtonStyle}>
            {isExpanded
              ? "Hide details"
              : `View ${detailCount} ${detailCount === 1 ? "detail" : "details"}`}
          </button>
        )}
      </article>
    </div>
  );
}

function UpdateHistoryItem({ item }: { item: SuggestedProjectUpdateItem }) {
  const valueRows = getItemValueRows(item);
  const itemStatusLabel = formatItemStatusLabel(item);
  const helperText = getItemHelperText(item);

  return (
    <div style={styles.itemCardStyle}>
      <div style={styles.itemHeaderStyle}>
        <div style={styles.itemBadgesStyle}>
          <span style={styles.itemTypeBadgeStyle}>{formatItemTypeLabel(item.type)}</span>
          {itemStatusLabel && (
            <span style={styles.itemStatusBadgeStyle}>{itemStatusLabel}</span>
          )}
        </div>
      </div>

      <h4 style={styles.itemTitleStyle}>{getItemDisplayTitle(item)}</h4>

      {helperText && (
        <p style={styles.itemDescriptionStyle}>{helperText}</p>
      )}

      {valueRows.length > 0 && (
        <div style={styles.valueRowsStyle}>
          {valueRows.map((row) => (
            <div key={`${row.label}-${row.value}`} style={styles.valueRowStyle}>
              <span style={styles.valueLabelStyle}>{row.label}</span>
              <span style={styles.valueTextStyle}>{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function StatePanel({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.statePanelStyle}>
      <div style={styles.stateIconStyle}>H</div>
      <h3 style={styles.stateTitleStyle}>{title}</h3>
      <p style={styles.stateTextStyle}>{text}</p>
    </div>
  );
}

function getHistoryMetrics(updates: ProjectUpdateHistoryEntry[]) {
  const appliedChanges = updates.reduce(
    (count, entry) => count + entry.items.filter((item) => item.status === "applied").length,
    0
  );
  const avoided = updates.reduce(
    (count, entry) =>
      count +
      entry.items.filter((item) =>
        item.type === "duplicate_warning" || item.type === "no_action"
      ).length,
    0
  );
  const lastUpdate = updates[0]?.update.applied_at || updates[0]?.update.created_at || null;

  return [
    {
      value: String(updates.length),
      label: updates.length === 1 ? "update" : "updates",
    },
    {
      value: String(appliedChanges),
      label: "applied changes",
    },
    {
      value: String(avoided),
      label: "duplicates/no-actions",
    },
    {
      value: formatShortDate(lastUpdate),
      label: "last update",
    },
  ];
}

function getStatusAccent(status: ProjectUpdateHistoryStatus) {
  switch (status) {
    case "applied":
      return {
        dot: { background: "#16a34a", boxShadow: "0 0 0 4px rgba(22, 163, 74, 0.12)" },
        badge: {
          color: "#166534",
          borderColor: "rgba(187, 247, 208, 0.78)",
          background: "rgba(240, 253, 244, 0.82)",
        },
        card: { borderLeft: "3px solid rgba(34, 197, 94, 0.42)" },
      };

    case "partial":
      return {
        dot: { background: "#4f46e5", boxShadow: "0 0 0 4px rgba(79, 70, 229, 0.12)" },
        badge: {
          color: "#4338ca",
          borderColor: "rgba(199, 210, 254, 0.78)",
          background: "rgba(238, 242, 255, 0.82)",
        },
        card: { borderLeft: "3px solid rgba(79, 70, 229, 0.38)" },
      };

    case "duplicate":
      return {
        dot: { background: "#d97706", boxShadow: "0 0 0 4px rgba(217, 119, 6, 0.12)" },
        badge: {
          color: "#92400e",
          borderColor: "rgba(245, 158, 11, 0.45)",
          background: "rgba(255, 251, 235, 0.86)",
        },
        card: { borderLeft: "3px solid rgba(245, 158, 11, 0.42)" },
      };

    case "failed":
      return {
        dot: { background: "#dc2626", boxShadow: "0 0 0 4px rgba(220, 38, 38, 0.1)" },
        badge: {
          color: "#991b1b",
          borderColor: "rgba(248, 113, 113, 0.42)",
          background: "rgba(254, 242, 242, 0.84)",
        },
        card: { borderLeft: "3px solid rgba(248, 113, 113, 0.42)" },
      };

    default:
      return {
        dot: { background: "#94a3b8", boxShadow: "0 0 0 4px rgba(148, 163, 184, 0.12)" },
        badge: {},
        card: { borderLeft: "3px solid rgba(148, 163, 184, 0.34)" },
      };
  }
}

function getUpdateHistoryStatus(entry: ProjectUpdateHistoryEntry): ProjectUpdateHistoryStatus {
  if (entry.update.status === "failed") return "failed";

  const applied = entry.items.filter((item) => item.status === "applied").length;
  const rejected = entry.items.filter((item) => item.status === "rejected").length;
  const duplicate = entry.items.some((item) => item.type === "duplicate_warning");
  const noAction = entry.items.length > 0 && entry.items.every((item) =>
    item.type === "no_action" || item.type === "duplicate_warning"
  );

  if (applied > 0 && rejected > 0) return "partial";
  if (applied > 0 || entry.update.status === "applied") return "applied";
  if (duplicate) return "duplicate";
  if (rejected > 0) return "no_changes";
  if (noAction || entry.update.status === "ignored") return "no_changes";

  return "suggested";
}

function getUpdateSummary(entry: ProjectUpdateHistoryEntry) {
  const applied = entry.items.filter((item) => item.status === "applied").length;
  const rejected = entry.items.filter((item) => item.status === "rejected").length;
  const duplicate = entry.items.filter((item) => item.type === "duplicate_warning").length;
  const noAction = entry.items.filter((item) => item.type === "no_action").length;
  const suggested = entry.items.filter((item) => item.status === "suggested").length;
  const summary: string[] = [];

  if (applied > 0) {
    summary.push(`${applied} ${applied === 1 ? "change" : "changes"} applied`);
  }

  if (rejected > 0) {
    summary.push(`${rejected} skipped`);
  }

  if (duplicate > 0) {
    summary.push(duplicate === 1 ? "Duplicate avoided" : `${duplicate} duplicates avoided`);
  }

  if (noAction > 0 && applied === 0 && rejected === 0) {
    summary.push("Nothing to apply");
  }

  if (suggested > 0 && applied === 0 && rejected === 0) {
    summary.push("Ready to review");
  }

  return summary.length > 0 ? summary : ["No item details"];
}

function getItemDisplayTitle(item: SuggestedProjectUpdateItem) {
  if (item.type === "duplicate_warning") {
    return "Already existed";
  }

  if (item.type === "no_action") {
    return "No project changes";
  }

  if (item.status === "rejected") {
    return `Skipped: ${item.title}`;
  }

  if (item.type === "new_subtask") {
    const title = getStringValue(item.new_value, ["task_title", "title", "name"]) || item.title;
    return item.status === "applied"
      ? `Added subtask: ${title}`
      : `Suggested subtask: ${title}`;
  }

  if (item.type === "deadline_change") {
    return item.status === "applied" ? "Deadline changed" : "Deadline suggestion";
  }

  if (item.type === "budget_change") {
    return item.status === "applied" ? "Budget changed" : "Budget suggestion";
  }

  if (item.type === "priority_change") {
    return item.status === "applied" ? "Priority changed" : "Priority suggestion";
  }

  if (item.type === "status_change") {
    return item.status === "applied" ? "Status changed" : "Status suggestion";
  }

  return item.title;
}

function getItemHelperText(item: SuggestedProjectUpdateItem) {
  if (item.type === "duplicate_warning") {
    return "Text2Task found this subtask already in the project, so it did not create another one.";
  }

  if (item.type === "no_action") {
    return "Text2Task did not find a new change to add.";
  }

  return item.description;
}

function getItemValueRows(item: SuggestedProjectUpdateItem): ProjectUpdateHistoryValueRow[] {
  const oldValue = item.old_value;
  const newValue = item.new_value;

  switch (item.type) {
    case "new_subtask":
      return compactRows([
        {
          label: "Status",
          value: getStringValue(newValue, ["status"]),
        },
        {
          label: "Priority",
          value: getStringValue(newValue, ["priority"]),
        },
        {
          label: "Deadline",
          value: getStringValue(newValue, ["deadline_text", "deadline"]),
        },
        {
          label: "Budget",
          value: getStringValue(newValue, ["amount", "budget", "price"]),
        },
      ]);

    case "deadline_change":
      return compactRows([
        {
          label: "From",
          value: getStringValue(oldValue, ["deadline_text", "deadline", "value"]) || "Not set",
        },
        {
          label: "To",
          value: getStringValue(newValue, ["deadline_text", "deadline", "value"]),
        },
      ]);

    case "budget_change":
      return compactRows([
        {
          label: "From",
          value: getStringValue(oldValue, ["amount", "budget", "price", "value"]) || "Not set",
        },
        {
          label: "To",
          value: getStringValue(newValue, ["amount", "budget", "price", "value"]),
        },
      ]);

    case "priority_change":
      return compactRows([
        {
          label: "From",
          value: getStringValue(oldValue, ["priority", "value"]) || "Not set",
        },
        {
          label: "To",
          value: getStringValue(newValue, ["priority", "value"]),
        },
      ]);

    case "status_change":
      return compactRows([
        {
          label: "From",
          value: getStringValue(oldValue, ["status", "value"]) || "Not set",
        },
        {
          label: "To",
          value: getStringValue(newValue, ["status", "value"]),
        },
      ]);

    case "duplicate_warning":
      return compactRows([
        {
          label: "Existing subtask",
          value: getStringValue(newValue, ["existing_title", "existingTitle"]) ||
            getStringValue(oldValue, ["existing_title", "existingTitle"]),
        },
        {
          label: "Requested",
          value: getStringValue(newValue, ["proposed_title", "proposedTitle", "task_title"]),
        },
      ]);

    case "project_note":
    case "client_note":
      return compactRows([
        {
          label: "Note",
          value: getStringValue(newValue, ["note", "notes", "value"]) || item.description,
        },
      ]);

    case "client_detail_change":
      return compactRows([
        { label: "Client", value: getStringValue(newValue, ["client_name", "name"]) },
        { label: "Contact", value: getStringValue(newValue, ["contact_name"]) },
        { label: "Phone", value: getStringValue(newValue, ["phone"]) },
        { label: "Email", value: getStringValue(newValue, ["email"]) },
        { label: "Notes", value: getStringValue(newValue, ["notes", "client_notes"]) },
      ]);

    default:
      return compactRows([
        {
          label: "Change",
          value: item.description || item.title,
        },
      ]);
  }
}

function compactRows(rows: Array<{ label: string; value: string | null | undefined }>) {
  return rows.filter(
    (row): row is ProjectUpdateHistoryValueRow =>
      typeof row.value === "string" && row.value.trim().length > 0
  );
}

function formatSourceTypeLabel(sourceType: string) {
  switch (sourceType) {
    case "text":
      return "Text message";
    case "email":
      return "Email";
    case "manual":
      return "Manual note";
    case "image":
      return "Screenshot";
    default:
      return "Client update";
  }
}

function formatUpdateStatusLabel(status: ProjectUpdateHistoryStatus) {
  switch (status) {
    case "applied":
      return "Applied";
    case "partial":
      return "Partially applied";
    case "duplicate":
      return "Duplicate";
    case "no_changes":
      return "No project changes";
    case "failed":
      return "Failed";
    default:
      return "Suggested";
  }
}

function formatItemStatusLabel(item: SuggestedProjectUpdateItem) {
  if (item.type === "duplicate_warning" || item.type === "no_action") return null;

  switch (item.status) {
    case "applied":
      return "Applied";
    case "rejected":
      return "Skipped";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    default:
      return null;
  }
}

function formatItemTypeLabel(type: ProjectUpdateItemType) {
  switch (type) {
    case "new_subtask":
      return "New subtask";
    case "update_subtask":
      return "Update subtask";
    case "deadline_change":
      return "Deadline change";
    case "budget_change":
      return "Budget change";
    case "priority_change":
      return "Priority change";
    case "status_change":
      return "Status change";
    case "client_detail_change":
      return "Client detail";
    case "project_note":
      return "Project note";
    case "client_note":
      return "Client note";
    case "duplicate_warning":
      return "Duplicate";
    case "no_action":
      return "No project changes";
    default:
      return "Update";
  }
}

function getStringValue(record: JsonRecord | null, keys: string[]) {
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "None";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "None";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function truncateText(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}
