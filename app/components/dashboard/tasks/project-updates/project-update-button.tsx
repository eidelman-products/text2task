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
  minHeight: 34,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  borderRadius: 999,
  border: "1px solid rgba(199, 210, 254, 0.9)",
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(238,242,255,0.88))",
  color: "#4338ca",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "-0.01em",
  padding: "0 13px",
  cursor: "pointer",
  boxShadow:
    "0 10px 24px rgba(79, 70, 229, 0.09), inset 0 1px 0 rgba(255,255,255,0.9)",
  transition:
    "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease",
};

const projectUpdateButtonHoverStyle: CSSProperties = {
  ...projectUpdateButtonStyle,
  transform: "translateY(-1px)",
  border: "1px solid rgba(129, 140, 248, 0.95)",
  background:
    "linear-gradient(135deg, rgba(238,242,255,1), rgba(224,231,255,0.95))",
  boxShadow:
    "0 14px 30px rgba(79, 70, 229, 0.16), inset 0 1px 0 rgba(255,255,255,0.96)",
};

const projectUpdateButtonDisabledStyle: CSSProperties = {
  ...projectUpdateButtonStyle,
  opacity: 0.48,
  cursor: "not-allowed",
  transform: "none",
  boxShadow: "none",
};

const projectUpdateButtonIconStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  display: "inline-grid",
  placeItems: "center",
  background: "rgba(255, 255, 255, 0.72)",
  border: "1px solid rgba(199, 210, 254, 0.72)",
  color: "#4f46e5",
  fontSize: 11,
  fontWeight: 950,
  lineHeight: 1,
};