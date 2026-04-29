"use client";

import { useEffect, useRef, useState } from "react";
import { formatDeadline } from "@/lib/tasks/format-deadline";
import { getAutoPriority } from "@/lib/ai/priority-engine";
import type { BatchTaskSuggestion } from "@/lib/ai/task-suggestions-batch";
import type {
  HybridAppliedChange,
  HybridPreviewMeta,
} from "@/lib/preview/hybrid-preview";

type EditablePreview = {
  client: string;
  client_phone?: string;
  client_email?: string;
  client_notes?: string;
  task: string;
  amount: string;
  deadline: string;
  priority: "Low" | "Medium" | "High";
  source: string;
  raw_input?: string;
  deadline_date?: string | null;
  deadline_original_text?: string | null;
};

type EditablePreviewCardProps = {
  index: number;
  preview: EditablePreview;
  aiMeta: HybridPreviewMeta;
  onChange: (index: number, field: keyof EditablePreview, value: string) => void;
  onUndoChange: (change: HybridAppliedChange) => void;
  suggestions: BatchTaskSuggestion[];
  suggestionsLoading: boolean;
  suggestionsError: string;
};

function getComparableDeadline(preview: EditablePreview) {
  return (
    preview.deadline_original_text?.trim() ||
    preview.deadline_date?.trim() ||
    preview.deadline?.trim() ||
    ""
  );
}

export default function EditablePreviewCard({
  index,
  preview,
  aiMeta,
  onChange,
  onUndoChange,
}: EditablePreviewCardProps) {
  const [autoPriorityLabel, setAutoPriorityLabel] = useState("");
  const lastAutoPriorityKeyRef = useRef("");

  useEffect(() => {
    const autoPriorityKey = JSON.stringify({
      task: preview.task,
      deadline: getComparableDeadline(preview),
    });

    if (lastAutoPriorityKeyRef.current === autoPriorityKey) {
      return;
    }

    lastAutoPriorityKeyRef.current = autoPriorityKey;

    if (!preview.task.trim() && !getComparableDeadline(preview)) {
      setAutoPriorityLabel("");
      return;
    }

    const suggestedPriority = getAutoPriority({
      task: preview.task,
      deadline: getComparableDeadline(preview),
    });

    setAutoPriorityLabel(suggestedPriority);

    if (preview.priority !== suggestedPriority) {
      onChange(index, "priority", suggestedPriority);
    }
  }, [
    index,
    onChange,
    preview.task,
    preview.priority,
    preview.deadline,
    preview.deadline_date,
    preview.deadline_original_text,
  ]);

  const displayDeadline = formatDeadline(
    preview.deadline_original_text ?? preview.deadline,
    preview.deadline_date ?? null
  );

  const inputDeadlineValue = preview.deadline || "";

  return (
    <div
      style={{
        border: "1px solid rgba(226,232,240,0.95)",
        borderRadius: 18,
        padding: 14,
        background:
          "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.96) 100%)",
        boxShadow:
          "0 8px 18px rgba(15,23,42,0.04), 0 1px 4px rgba(15,23,42,0.02)",
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6, minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: "#4f46e5",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Review task {index + 1}
          </div>

          <input
            value={preview.task}
            onChange={(e) => onChange(index, "task", e.target.value)}
            placeholder="Task title"
            style={{
              width: "100%",
              maxWidth: 680,
              border: "none",
              background: "transparent",
              outline: "none",
              padding: 0,
              margin: 0,
              fontSize: 20,
              lineHeight: 1.1,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              color: "#0f172a",
            }}
          />

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
            }}
          >
            <MetaChip label={`Client: ${preview.client || "Unassigned"}`} />
            <MetaChip
              label={`Phone: ${preview.client_phone || "No phone"}`}
              subtle={!preview.client_phone}
            />
            <MetaChip
              label={`Email: ${preview.client_email || "No email"}`}
              subtle={!preview.client_email}
            />
            <MetaChip label={`Amount: ${preview.amount || "No amount"}`} />
            <MetaChip label={`Deadline: ${displayDeadline || "No deadline"}`} />
            <MetaChip label={`Source: ${preview.source}`} subtle />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {aiMeta.aiApplied ? (
            <Badge
              text="AI Improved"
              background="#eef2ff"
              border="#c7d2fe"
              color="#4338ca"
            />
          ) : null}

          {autoPriorityLabel ? (
            <Badge
              text={`AI Priority: ${autoPriorityLabel}`}
              background="#eff6ff"
              border="#bfdbfe"
              color="#1d4ed8"
            />
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 10,
        }}
      >
        <Field label="Client">
          <input
            value={preview.client}
            onChange={(e) => onChange(index, "client", e.target.value)}
            placeholder="Client name"
            style={inputStyle}
          />
        </Field>

        <Field label="Phone">
          <input
            value={preview.client_phone || ""}
            onChange={(e) =>
              onChange(index, "client_phone", e.target.value)
            }
            placeholder="Phone"
            style={inputStyle}
          />
        </Field>

        <Field label="Email">
          <input
            value={preview.client_email || ""}
            onChange={(e) =>
              onChange(index, "client_email", e.target.value)
            }
            placeholder="Email"
            style={inputStyle}
          />
        </Field>

        <Field label="Amount">
          <input
            value={preview.amount}
            onChange={(e) => onChange(index, "amount", e.target.value)}
            placeholder="Amount"
            style={inputStyle}
          />
        </Field>

        <Field label="Deadline">
          <input
            value={inputDeadlineValue}
            onChange={(e) => {
              onChange(index, "deadline", e.target.value);
            }}
            placeholder="MM/DD/YY"
            style={inputStyle}
          />
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
              lineHeight: 1.5,
            }}
          >
            Display only: {displayDeadline || "No deadline"}
          </div>
        </Field>

        <Field label="Priority">
          <select
            value={preview.priority}
            onChange={(e) =>
              onChange(
                index,
                "priority",
                e.target.value as EditablePreview["priority"]
              )
            }
            style={inputStyle}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </Field>
      </div>

      <Field label="Client notes">
        <textarea
          value={preview.client_notes || ""}
          onChange={(e) => onChange(index, "client_notes", e.target.value)}
          placeholder="Optional client notes"
          style={{
            ...inputStyle,
            resize: "vertical",
            minHeight: 74,
            lineHeight: 1.5,
          }}
        />
      </Field>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 12,
          background:
            "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(255,255,255,0.98) 100%)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: "#0f172a",
            marginBottom: 8,
          }}
        >
          Smart Suggestions
        </div>

        <div
          style={{
            fontSize: 12,
            color: "#64748b",
            lineHeight: 1.6,
          }}
        >
          Deadline suggestions are display-only. They convert raw date text into
          a cleaner calendar-style label, but they do not change the saved date.
        </div>

        {aiMeta.changes.length > 0 ? (
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {aiMeta.changes.map((change, idx) => (
              <ChangeRow
                key={`${change.field}-${idx}`}
                change={change}
                onUndo={() => onUndoChange(change)}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              fontWeight: 600,
              color: "#64748b",
            }}
          >
            No smart changes are currently available for this task.
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({
  text,
  background,
  border,
  color,
}: {
  text: string;
  background: string;
  border: string;
  color: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        background,
        color,
        borderRadius: 999,
        padding: "5px 8px",
        fontSize: 10,
        fontWeight: 800,
      }}
    >
      {text}
    </div>
  );
}

function MetaChip({
  label,
  subtle = false,
}: {
  label: string;
  subtle?: boolean;
}) {
  return (
    <div
      style={{
        border: subtle ? "1px solid #e2e8f0" : "1px solid #dbeafe",
        background: subtle ? "#ffffff" : "#f8fbff",
        color: subtle ? "#64748b" : "#334155",
        borderRadius: 999,
        padding: "6px 9px",
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  );
}

function ChangeRow({
  change,
  onUndo,
}: {
  change: HybridAppliedChange;
  onUndo: () => void;
}) {
  return (
    <div
      style={{
        border: "1px solid #c7d2fe",
        background:
          "linear-gradient(180deg, rgba(238,242,255,1) 0%, rgba(238,242,255,0.82) 100%)",
        borderRadius: 12,
        padding: "9px 10px",
        display: "grid",
        gap: 5,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          color: "#4338ca",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {getChangeFieldLabel(change.field)}
      </div>

      <div
        style={{
          fontSize: 11,
          color: "#64748b",
        }}
      >
        Before: {change.before || "—"}
      </div>

      <div
        style={{
          fontSize: 11,
          color: "#0f172a",
          fontWeight: 800,
        }}
      >
        After:{" "}
        {change.field === "deadline"
          ? formatDeadline(change.before, change.after)
          : change.after || "—"}
      </div>

      <div>
        <button
          onClick={onUndo}
          style={{
            marginTop: 2,
            border: "none",
            background: "transparent",
            color: "#1d4ed8",
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
            padding: 0,
          }}
        >
          Undo change
        </button>
      </div>
    </div>
  );
}

function getChangeFieldLabel(field: HybridAppliedChange["field"]) {
  if (field === "amount") return "Amount";
  if (field === "deadline") return "Deadline";
  return "Priority";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        padding: 12,
        background:
          "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(255,255,255,0.99) 100%)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: "#64748b",
          marginBottom: 7,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  padding: "9px 11px",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
  fontSize: 12,
  outline: "none",
  boxShadow: "inset 0 1px 2px rgba(15,23,42,0.03)",
};