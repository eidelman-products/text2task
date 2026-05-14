import type { CSSProperties, KeyboardEvent } from "react";
import type { TaskProjectGroup } from "./task-types";

type ClientContactEditorProps = {
  project: TaskProjectGroup;
  isDeleting: boolean;
  onEnterBlur: (
    e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  updateTaskField: (taskId: number, field: string, value: any) => void;
};

export default function ClientContactEditor({
  project,
  isDeleting,
  onEnterBlur,
  updateTaskField,
}: ClientContactEditorProps) {
  const primaryTaskId = project.primaryTask.id;

  const contactName = project.contactName || project.contact_name || "";
  const email = project.client_email || project.primaryTask.client?.email || "";
  const phone = project.client_phone || project.primaryTask.client?.phone || "";
  const notes = project.client_notes || project.primaryTask.client?.notes || "";

  function updateOnBlur(
    field: "phone" | "email" | "notes",
    currentValue: string,
    nextValue: string
  ) {
    const cleanCurrent = String(currentValue || "").trim();
    const cleanNext = String(nextValue || "").trim();

    if (cleanCurrent === cleanNext) return;

    updateTaskField(primaryTaskId, field, cleanNext);
  }

  return (
    <aside style={clientCardStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <div style={sectionTitleStyle}>Client details</div>
          <div style={sectionSubtitleStyle}>
            Contact information and project context saved with this client.
          </div>
        </div>

        <span style={editorPillStyle}>Editable</span>
      </div>

      <div style={contactListStyle}>
        <ReadOnlyField
          label="Contact person"
          value={contactName}
          emptyText="No contact person saved"
        />

        <EditableTextField
          label="Email"
          type="email"
          placeholder="client@email.com"
          defaultValue={email}
          disabled={isDeleting}
          onEnterBlur={onEnterBlur}
          onCommit={(nextValue) => updateOnBlur("email", email, nextValue)}
        />

        <EditableTextField
          label="Phone"
          type="tel"
          placeholder="Client phone number"
          defaultValue={phone}
          disabled={isDeleting}
          onEnterBlur={onEnterBlur}
          onCommit={(nextValue) => updateOnBlur("phone", phone, nextValue)}
        />

        <EditableTextareaField
          label="Notes"
          placeholder="Add project notes, client preferences, or context..."
          defaultValue={notes}
          disabled={isDeleting}
          onCommit={(nextValue) => updateOnBlur("notes", notes, nextValue)}
        />

        {!contactName && !email && !phone && !notes ? (
          <div style={emptyDetailsStyle}>
            No client details saved yet. Add email, phone, or notes to keep the
            project context in one place.
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function ReadOnlyField({
  label,
  value,
  emptyText,
}: {
  label: string;
  value?: string | null;
  emptyText: string;
}) {
  return (
    <div style={fieldShellStyle}>
      <label style={fieldLabelStyle}>{label}</label>

      <div
        style={{
          ...readOnlyValueStyle,
          color: value ? "#344054" : "#98a2b3",
        }}
      >
        {value || emptyText}
      </div>
    </div>
  );
}

function EditableTextField({
  label,
  type,
  placeholder,
  defaultValue,
  disabled,
  onEnterBlur,
  onCommit,
}: {
  label: string;
  type: "email" | "tel" | "text";
  placeholder: string;
  defaultValue: string;
  disabled: boolean;
  onEnterBlur: (
    e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  onCommit: (value: string) => void;
}) {
  return (
    <div style={fieldShellStyle}>
      <label style={fieldLabelStyle}>{label}</label>

      <input
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        onBlur={(e) => onCommit(e.currentTarget.value)}
        onKeyDown={onEnterBlur}
        className="client-contact-editor-input"
        style={inputStyle}
      />
    </div>
  );
}

function EditableTextareaField({
  label,
  placeholder,
  defaultValue,
  disabled,
  onCommit,
}: {
  label: string;
  placeholder: string;
  defaultValue: string;
  disabled: boolean;
  onCommit: (value: string) => void;
}) {
  return (
    <div style={fieldShellStyle}>
      <label style={fieldLabelStyle}>{label}</label>

      <textarea
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        rows={4}
        onBlur={(e) => onCommit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="client-contact-editor-input"
        style={textareaStyle}
      />
    </div>
  );
}

const clientCardStyle: CSSProperties = {
  borderRadius: 22,
  background: "rgba(255,255,255,0.66)",
  padding: 13,
  minWidth: 0,
  boxShadow: "0 10px 28px rgba(15,23,42,0.026)",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 11,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 950,
  color: "#344054",
};

const sectionSubtitleStyle: CSSProperties = {
  marginTop: 3,
  fontSize: 11,
  fontWeight: 750,
  color: "#98a2b3",
  lineHeight: 1.45,
};

const editorPillStyle: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(240,253,244,0.72)",
  color: "#15803d",
  border: "1px solid rgba(187,247,208,0.7)",
  fontSize: 10,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const contactListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const fieldShellStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  padding: "10px 11px",
  borderRadius: 15,
  background: "rgba(248,250,252,0.66)",
  border: "1px solid rgba(226,232,240,0.42)",
  minWidth: 0,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 10,
  color: "#98a2b3",
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const readOnlyValueStyle: CSSProperties = {
  minHeight: 28,
  display: "flex",
  alignItems: "center",
  fontSize: 13,
  fontWeight: 760,
  lineHeight: 1.45,
  wordBreak: "break-word",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 34,
  borderRadius: 12,
  border: "1px solid rgba(226,232,240,0.72)",
  background: "rgba(255,255,255,0.78)",
  color: "#344054",
  fontSize: 13,
  fontWeight: 760,
  padding: "0 10px",
  outline: "none",
  boxShadow: "0 1px 2px rgba(15,23,42,0.025)",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 92,
  resize: "vertical",
  borderRadius: 12,
  border: "1px solid rgba(226,232,240,0.72)",
  background: "rgba(255,255,255,0.78)",
  color: "#344054",
  fontSize: 13,
  fontWeight: 720,
  lineHeight: 1.45,
  padding: "9px 10px",
  outline: "none",
  boxShadow: "0 1px 2px rgba(15,23,42,0.025)",
};

const emptyDetailsStyle: CSSProperties = {
  padding: "12px",
  borderRadius: 15,
  background: "rgba(255,255,255,0.62)",
  border: "1px dashed rgba(203,213,225,0.75)",
  color: "#667085",
  fontSize: 13,
  fontWeight: 750,
  lineHeight: 1.45,
};