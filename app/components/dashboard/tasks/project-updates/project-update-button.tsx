"use client";

import { useState, type CSSProperties } from "react";
import type { TaskProjectGroup } from "../task-types";

type ProjectUpdateButtonProps = {
  project: TaskProjectGroup;
  isDeleting: boolean;
  onOpenModal: (project: TaskProjectGroup) => void;
};

export default function ProjectUpdateButton({
  project,
  isDeleting,
  onOpenModal,
}: ProjectUpdateButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const projectId = project.project_id || project.project?.id;
  const canClick = Boolean(projectId) && !isDeleting;

  function handleClick() {
    if (canClick) {
      onOpenModal(project);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!canClick}
      title={canClick ? "Add a new client update" : "Save project first"}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="crm-soft-button-v3"
      style={
        !canClick
          ? projectUpdateButtonDisabledStyle
          : isHovered
            ? projectUpdateButtonHoverStyle
            : projectUpdateButtonStyle
      }
    >
      <span style={projectUpdateButtonIconStyle}>↻</span>
      <span>Add update</span>
    </button>
  );
}

const projectUpdateButtonStyle: CSSProperties = {
  minHeight: 32,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  borderRadius: 999,
  border: "1px solid rgba(37,99,235,0.28)",
  background: "rgba(239,246,255,0.94)",
  color: "#1d4ed8",
  fontSize: 11.5,
  fontWeight: 900,
  letterSpacing: "-0.01em",
  padding: "0 12px",
  cursor: "pointer",
  boxShadow:
    "0 8px 18px rgba(37,99,235,0.055), inset 0 1px 0 rgba(255,255,255,0.88)",
  transition:
    "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease",
};

const projectUpdateButtonHoverStyle: CSSProperties = {
  ...projectUpdateButtonStyle,
  transform: "translateY(-1px)",
  border: "1px solid rgba(37,99,235,0.38)",
  background: "rgba(219,234,254,0.94)",
  boxShadow:
    "0 10px 22px rgba(37,99,235,0.085), inset 0 1px 0 rgba(255,255,255,0.96)",
};

const projectUpdateButtonDisabledStyle: CSSProperties = {
  ...projectUpdateButtonStyle,
  opacity: 0.48,
  cursor: "not-allowed",
  transform: "none",
  boxShadow: "none",
};

const projectUpdateButtonIconStyle: CSSProperties = {
  width: 17,
  height: 17,
  borderRadius: 999,
  display: "inline-grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.76)",
  border: "1px solid rgba(191,219,254,0.78)",
  color: "#2563eb",
  fontSize: 11,
  fontWeight: 950,
  lineHeight: 1,
};
