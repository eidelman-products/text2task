import type { CSSProperties, KeyboardEvent } from "react";
import type { TaskProjectGroup } from "./task-types";

type ProjectHeaderVisual = {
  avatarBackground: string;
  avatarText: string;
  label: string;
  labelColor: string;
  labelBackground: string;
};

type ProjectHeaderEditorProps = {
  project: TaskProjectGroup;
  visual: ProjectHeaderVisual;
  isDeleting: boolean;
  createdLabel: string;
  onEnterBlur: (
    e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  updateProjectField: (
    projectId: string,
    field: string,
    value: any
  ) => Promise<void> | void;
};

export default function ProjectHeaderEditor({
  project,
  visual,
  isDeleting,
  createdLabel,
  onEnterBlur,
  updateProjectField,
}: ProjectHeaderEditorProps) {
  const projectId = project.project_id || project.project?.id || "";
  const canEditProject = Boolean(projectId) && !isDeleting;

  const clientName = project.clientName || "";
  const contactName = project.contactName || project.contact_name || "";
  const projectTitle = project.projectTitle || "";
  const projectSummary = project.projectSummary || "";

  function commitProjectField(
    field: "client_name" | "contact_name" | "title" | "summary",
    currentValue: string,
    nextValue: string
  ) {
    if (!projectId) return;

    const cleanCurrent = String(currentValue || "").trim();
    const cleanNext = String(nextValue || "").trim();

    if (cleanCurrent === cleanNext) return;

    if ((field === "client_name" || field === "title") && !cleanNext) {
      return;
    }

    updateProjectField(projectId, field, cleanNext);
  }

  return (
    <div style={headerShellStyle}>
      <style>{projectHeaderEditorCss}</style>

      <div style={topRowStyle}>
        <span
          style={{
            ...clientAvatarStyle,
            background: visual.avatarBackground,
            color: visual.avatarText,
          }}
        >
          {getClientInitials(clientName)}
        </span>

        <div style={clientStackStyle}>
          <div style={clientMetaRowStyle}>
            <EditableHeaderField
              ariaLabel="Client name"
              value={clientName}
              placeholder="Client name"
              disabled={!canEditProject}
              variant="client"
              onEnterBlur={onEnterBlur}
              onCommit={(nextValue) =>
                commitProjectField("client_name", clientName, nextValue)
              }
            />

            <span style={createdPillStyle}>{createdLabel}</span>

            {visual.label ? (
              <span
                style={{
                  ...statePillStyle,
                  color: visual.labelColor,
                  background: visual.labelBackground,
                }}
              >
                {visual.label}
              </span>
            ) : null}
          </div>

          <div style={contactRowStyle}>
            <span style={contactPrefixStyle}>Contact:</span>

            <EditableHeaderField
              ariaLabel="Contact name"
              value={contactName}
              placeholder="Add contact"
              disabled={!canEditProject}
              variant="contact"
              onEnterBlur={onEnterBlur}
              onCommit={(nextValue) =>
                commitProjectField("contact_name", contactName, nextValue)
              }
            />
          </div>
        </div>
      </div>

      <EditableHeaderField
        ariaLabel="Project title"
        value={projectTitle}
        placeholder="Project title"
        disabled={!canEditProject}
        variant="title"
        onEnterBlur={onEnterBlur}
        onCommit={(nextValue) =>
          commitProjectField("title", projectTitle, nextValue)
        }
      />

      <EditableHeaderField
        ariaLabel="Project summary"
        value={projectSummary}
        placeholder="Project summary"
        disabled={!canEditProject}
        variant="summary"
        onEnterBlur={onEnterBlur}
        onCommit={(nextValue) =>
          commitProjectField("summary", projectSummary, nextValue)
        }
      />
    </div>
  );
}

function EditableHeaderField({
  ariaLabel,
  value,
  placeholder,
  disabled,
  variant,
  onEnterBlur,
  onCommit,
}: {
  ariaLabel: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  variant: "client" | "contact" | "title" | "summary";
  onEnterBlur: (
    e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  onCommit: (value: string) => void;
}) {
  return (
    <span
      className={[
        "project-header-edit-shell",
        `project-header-edit-shell-${variant}`,
        disabled ? "project-header-edit-shell-disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...shellBaseStyle,
        ...getShellVariantStyle(variant),
      }}
    >
      <input
        aria-label={ariaLabel}
        title={disabled ? "" : "Click to edit"}
        type="text"
        defaultValue={value}
        placeholder={placeholder}
        disabled={disabled}
        onBlur={(e) => onCommit(e.currentTarget.value)}
        onKeyDown={onEnterBlur}
        className={[
          "project-header-editor-input",
          `project-header-editor-input-${variant}`,
        ].join(" ")}
        style={{
          ...baseInputStyle,
          ...getInputVariantStyle(variant),
          opacity: disabled ? 0.68 : 1,
          cursor: disabled ? "not-allowed" : "text",
        }}
      />

      {!disabled ? (
        <span className="project-header-edit-cue" style={editCueStyle}>
          ✎
        </span>
      ) : null}
    </span>
  );
}

function getShellVariantStyle(
  variant: "client" | "contact" | "title" | "summary"
): CSSProperties {
  if (variant === "title") {
    return {
      width: "100%",
      borderRadius: 12,
    };
  }

  if (variant === "summary") {
    return {
      width: "100%",
      borderRadius: 11,
    };
  }

  if (variant === "contact") {
    return {
      width: "min(210px, 100%)",
      borderRadius: 999,
    };
  }

  return {
    width: "min(250px, 100%)",
    borderRadius: 999,
  };
}

function getInputVariantStyle(
  variant: "client" | "contact" | "title" | "summary"
): CSSProperties {
  if (variant === "title") {
    return {
      minHeight: 27,
      fontSize: 16,
      lineHeight: 1.15,
      fontWeight: 950,
      color: "#101828",
      letterSpacing: "-0.035em",
      padding: "3px 30px 3px 9px",
    };
  }

  if (variant === "summary") {
    return {
      minHeight: 25,
      fontSize: 12,
      lineHeight: 1.35,
      fontWeight: 760,
      color: "#667085",
      padding: "2px 30px 2px 9px",
    };
  }

  if (variant === "contact") {
    return {
      minHeight: 21,
      fontSize: 11,
      fontWeight: 820,
      color: "#667085",
      padding: "1px 26px 1px 7px",
    };
  }

  return {
    minHeight: 23,
    fontSize: 12,
    fontWeight: 950,
    color: "#344054",
    padding: "1px 26px 1px 7px",
  };
}

function getClientInitials(clientName: string) {
  const clean = String(clientName || "").trim();

  if (!clean) return "C";

  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const headerShellStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 4,
};

const topRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minWidth: 0,
};

const clientAvatarStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 12,
  display: "inline-grid",
  placeItems: "center",
  fontSize: 11,
  fontWeight: 950,
  flexShrink: 0,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.78), 0 8px 18px rgba(15,23,42,0.04)",
};

const clientStackStyle: CSSProperties = {
  display: "grid",
  gap: 1,
  minWidth: 0,
};

const clientMetaRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
  flexWrap: "wrap",
};

const contactRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 3,
  minWidth: 0,
};

const contactPrefixStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 850,
  color: "#98a2b3",
  whiteSpace: "nowrap",
};

const createdPillStyle: CSSProperties = {
  padding: "3px 7px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 850,
  color: "#667085",
  background: "rgba(248,250,252,0.72)",
  whiteSpace: "nowrap",
  border: "1px solid rgba(226,232,240,0.44)",
};

const statePillStyle: CSSProperties = {
  padding: "3px 7px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
  whiteSpace: "nowrap",
  border: "1px solid rgba(255,255,255,0.58)",
};

const shellBaseStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  minWidth: 0,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.44) 0%, rgba(255,255,255,0.14) 100%)",
  border: "1px solid transparent",
  transition:
    "background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
};

const baseInputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  border: "0",
  background: "transparent",
  outline: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const editCueStyle: CSSProperties = {
  position: "absolute",
  right: 7,
  top: "50%",
  transform: "translateY(-50%)",
  width: 16,
  height: 16,
  borderRadius: 999,
  display: "inline-grid",
  placeItems: "center",
  color: "#4f46e5",
  background: "rgba(238,242,255,0.9)",
  border: "1px solid rgba(199,210,254,0.82)",
  fontSize: 9,
  fontWeight: 950,
  opacity: 0,
  pointerEvents: "none",
  transition: "opacity 0.16s ease, transform 0.16s ease",
};

const projectHeaderEditorCss = `
  .project-header-edit-shell:hover:not(.project-header-edit-shell-disabled) {
    background: linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.82) 100%) !important;
    border-color: rgba(199,210,254,0.78) !important;
    box-shadow:
      0 7px 16px rgba(79,70,229,0.07),
      inset 0 1px 0 rgba(255,255,255,0.92) !important;
    transform: translateY(-1px);
  }

  .project-header-edit-shell:hover:not(.project-header-edit-shell-disabled) .project-header-edit-cue {
    opacity: 1 !important;
    transform: translateY(-50%) scale(1.02) !important;
  }

  .project-header-edit-shell:focus-within {
    background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(238,242,255,0.72) 100%) !important;
    border-color: rgba(129,140,248,0.92) !important;
    box-shadow:
      0 0 0 3px rgba(99,102,241,0.105),
      0 10px 22px rgba(79,70,229,0.09),
      inset 0 1px 0 rgba(255,255,255,0.96) !important;
    transform: translateY(-1px);
  }

  .project-header-edit-shell:focus-within .project-header-edit-cue {
    opacity: 1 !important;
    background: rgba(79,70,229,0.98) !important;
    color: #ffffff !important;
    border-color: rgba(79,70,229,0.98) !important;
  }

  .project-header-editor-input::placeholder {
    color: #98a2b3;
  }

  .project-header-editor-input::selection {
    background: rgba(199,210,254,0.78);
  }

  .project-header-editor-input-title:focus,
  .project-header-editor-input-summary:focus,
  .project-header-editor-input-client:focus,
  .project-header-editor-input-contact:focus {
    color: #101828 !important;
  }
`;