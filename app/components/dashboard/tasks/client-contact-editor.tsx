import type { CSSProperties, KeyboardEvent } from "react";
import type { TaskProjectGroup } from "./task-types";

type ClientContactEditorProps = {
  project: TaskProjectGroup;
  isDeleting: boolean;
  onEnterBlur: (
    e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  updateTaskField: (taskId: number, field: string, value: string) => void;
  updateProjectField: (
    projectId: string,
    field: string,
    value: string
  ) => Promise<void> | void;
};

export default function ClientContactEditor({
  project,
  isDeleting,
  onEnterBlur,
  updateTaskField,
  updateProjectField,
}: ClientContactEditorProps) {
  const primaryTaskId = project.primaryTask.id;
  const projectId = project.project_id || project.project?.id || "";

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

  function updateContactOnBlur(nextValue: string) {
    if (!projectId) return;

    const cleanCurrent = String(contactName || "").trim();
    const cleanNext = String(nextValue || "").trim();

    if (cleanCurrent === cleanNext) return;

    updateProjectField(projectId, "contact_name", cleanNext);
  }

  return (
    <aside style={clientDetailsStyle}>
      <style>{clientContactCss}</style>

      <div style={clientHeaderStyle}>
        <div style={clientKickerStyle}>Client details</div>
      </div>

      <div style={clientContentStyle}>
        <div style={clientInfoRowStyle}>
          <EditableTextField
            label="Contact"
            type="text"
            placeholder="No contact person"
            defaultValue={contactName}
            disabled={isDeleting || !projectId}
            onEnterBlur={onEnterBlur}
            onCommit={updateContactOnBlur}
          />

          <EditableTextField
            label="Email"
            type="email"
            placeholder="Add email"
            defaultValue={email}
            disabled={isDeleting}
            onEnterBlur={onEnterBlur}
            onCommit={(nextValue) => updateOnBlur("email", email, nextValue)}
          />

          <EditableTextField
            label="Phone"
            type="tel"
            placeholder="Add phone"
            defaultValue={phone}
            disabled={isDeleting}
            onEnterBlur={onEnterBlur}
            onCommit={(nextValue) => updateOnBlur("phone", phone, nextValue)}
          />
        </div>

        <EditableTextareaField
          label="Notes"
          placeholder="Add project notes, client preferences, tone, links, or important context."
          defaultValue={notes}
          disabled={isDeleting}
          onCommit={(nextValue) => updateOnBlur("notes", notes, nextValue)}
        />
      </div>

      {!contactName && !email && !phone && !notes ? (
        <div style={emptyDetailsStyle}>
          No client details saved yet. Add email, phone, or notes to keep the
          project context in one place.
        </div>
      ) : null}
    </aside>
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
    <label style={fieldLineStyle}>
      <span style={fieldLabelStyle}>{label}</span>

      <input
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        onBlur={(e) => onCommit(e.currentTarget.value)}
        onKeyDown={onEnterBlur}
        className="client-contact-editor-input-v6"
        style={inputStyle}
      />
    </label>
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
    <label style={notesLineStyle}>
      <span style={fieldLabelStyle}>{label}</span>

      <textarea
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        onBlur={(e) => onCommit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="client-contact-editor-input-v6"
        style={textareaStyle}
      />
    </label>
  );
}

const clientDetailsStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "160px minmax(0, 1fr)",
  gap: 16,
  padding: "10px 0 11px",
  background:
    "linear-gradient(90deg, rgba(239,246,255,0.36), rgba(255,255,255,0) 50%)",
  border: "none",
  boxShadow: "none",
  borderRadius: 18,
};

const clientHeaderStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  alignContent: "start",
  gap: 3,
  paddingLeft: 13,
  borderLeft: "2px solid rgba(37,99,235,0.42)",
};

const clientKickerStyle: CSSProperties = {
  fontSize: 13.8,
  fontWeight: 950,
  color: "#101828",
  letterSpacing: "-0.025em",
};

const clientContentStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 5,
  maxWidth: 820,
};

const clientInfoRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(150px, 0.9fr) minmax(240px, 1.2fr) minmax(150px, 0.9fr)",
  alignItems: "baseline",
  columnGap: 22,
  rowGap: 5,
};

const fieldLineStyle: CSSProperties = {
  minWidth: 0,
  display: "inline-flex",
  alignItems: "baseline",
  gap: 7,
};

const notesLineStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "50px minmax(0, 1fr)",
  alignItems: "start",
  gap: 8,
  paddingTop: 2,
  maxWidth: 820,
};

const fieldLabelStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: 10,
  color: "#98a2b3",
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: 23,
  borderRadius: 8,
  border: "1px solid transparent",
  background: "transparent",
  color: "#101828",
  fontSize: 13.2,
  fontWeight: 880,
  padding: "0 2px",
  outline: "none",
  boxShadow: "none",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 42,
  maxHeight: 78,
  resize: "none",
  borderRadius: 8,
  border: "1px solid transparent",
  background: "transparent",
  color: "#344054",
  fontSize: 13,
  fontWeight: 760,
  lineHeight: 1.5,
  padding: "0 2px",
  outline: "none",
  boxShadow: "none",
  overflow: "hidden",
};

const emptyDetailsStyle: CSSProperties = {
  gridColumn: "1 / -1",
  padding: "2px 0 0 14px",
  color: "#667085",
  fontSize: 12,
  fontWeight: 720,
  lineHeight: 1.35,
};

const clientContactCss = `
  .client-contact-editor-input-v6::placeholder {
    color: #98a2b3;
  }

  .client-contact-editor-input-v6:hover:not(:disabled) {
    background: rgba(248,250,252,0.70) !important;
  }

  .client-contact-editor-input-v6:focus {
    background: rgba(255,255,255,0.98) !important;
    border-color: rgba(147,197,253,0.72) !important;
    box-shadow: 0 0 0 3px rgba(37,99,235,0.045) !important;
    padding-left: 7px !important;
    padding-right: 7px !important;
  }

  @media (max-width: 1100px) {
    .client-contact-editor-input-v6 {
      font-size: 12.4px !important;
    }
  }
`;
