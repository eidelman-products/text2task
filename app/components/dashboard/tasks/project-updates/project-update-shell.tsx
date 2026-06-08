"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";

import type { TaskProjectGroup } from "../task-types";
import type { ProjectUpdateFormState } from "./project-update-types";
import ProjectUpdateInputCard from "./project-update-input-card";
import ProjectUpdateReviewCard from "./project-update-review-card";
import * as ui from "./project-update-ui-styles";

type ProjectUpdateModalV2Props = {
  isOpen: boolean;
  project: TaskProjectGroup | null;
  form: ProjectUpdateFormState;
  isBusy: boolean;

  onClose: () => void;
  onAnalyzeUpdate: () => void;
  onApplySelectedChanges: () => void;

  onRawInputChange: (value: string) => void;
  onInputMethodChange: (value: "text" | "image") => void;
  onImageSelected: (file: File) => void;
  onRemoveImage: () => void;
  onImageError: (message: string | null) => void;

  onToggleSuggestedItem: (itemId: string) => void;
  onUpdateSuggestedItemValue: (
    itemId: string,
    field: string,
    value: string
  ) => void;
};

export default function ProjectUpdateModalV2({
  isOpen,
  project,
  form,
  isBusy,
  onClose,
  onAnalyzeUpdate,
  onApplySelectedChanges,
  onRawInputChange,
  onInputMethodChange,
  onImageSelected,
  onRemoveImage,
  onImageError,
  onToggleSuggestedItem,
  onUpdateSuggestedItemValue,
}: ProjectUpdateModalV2Props) {
  const [isMounted, setIsMounted] = useState(false);

  const clientName = getModalClientName(project);
  const projectTitle = getModalProjectTitle(project);

  const canAnalyze =
    !isBusy &&
    !form.isAnalyzing &&
    !form.isApplying &&
    !form.applySuccessMessage &&
    (form.inputMethod === "image"
      ? Boolean(form.selectedImage)
      : Boolean(form.rawInput.trim()));

  const canApply =
    !isBusy &&
    !form.isAnalyzing &&
    !form.isApplying &&
    !form.applySuccessMessage &&
    Boolean(form.analysisResult) &&
    hasSelectedApplyableItems(form);

  const primaryButtonState = getPrimaryButtonState({
    form,
    canAnalyze,
    canApply,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) {
        onClose();
      }
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isBusy, onClose]);

  if (!isMounted || !isOpen) {
    return null;
  }

  function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !isBusy) {
      onClose();
    }
  }

  function handlePrimaryClick() {
    if (form.applySuccessMessage) {
      onClose();
      return;
    }

    if (form.analysisResult) {
      if (canApply) {
        onApplySelectedChanges();
      } else {
        onClose();
      }

      return;
    }

    if (canAnalyze) {
      onAnalyzeUpdate();
    }
  }

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add client update"
      className={ui.responsiveClassNames.overlay}
      style={ui.overlay}
      onMouseDown={handleOverlayMouseDown}
    >
      <section
        className={ui.responsiveClassNames.modal}
        style={ui.modal}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={ui.responsiveClassNames.header} style={ui.header}>
          <div style={ui.headerMain}>
            <div style={ui.headerCopy}>
              <h2 style={ui.title}>Add client update</h2>

              <p style={ui.subtitle}>
                Review a client message or screenshot before saving changes.
              </p>

              <ProjectContext clientName={clientName} projectTitle={projectTitle} />
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close client update modal"
            style={{
              ...ui.closeButton,
              opacity: isBusy ? 0.65 : 1,
              cursor: isBusy ? "not-allowed" : "pointer",
            }}
          >
            ×
          </button>
        </header>

        <main className={ui.responsiveClassNames.body} style={ui.body}>
          <div className={ui.responsiveClassNames.mainGrid} style={ui.mainGrid}>
            <div style={ui.leftColumn}>
              <ProjectUpdateInputCard
                form={form}
                isBusy={isBusy}
                onRawInputChange={onRawInputChange}
                onInputMethodChange={onInputMethodChange}
                onImageSelected={onImageSelected}
                onRemoveImage={onRemoveImage}
                onImageError={onImageError}
              />
            </div>

            <ProjectUpdateReviewCard
              form={form}
              isBusy={isBusy}
              onToggleSuggestedItem={onToggleSuggestedItem}
              onUpdateSuggestedItemValue={onUpdateSuggestedItemValue}
            />
          </div>
        </main>

        <footer className={ui.responsiveClassNames.footer} style={ui.footer}>
          <button
            type="button"
            className="project-update-secondary-button"
            onClick={onClose}
            disabled={isBusy && !form.applySuccessMessage}
            style={{
              ...ui.secondaryButton,
              opacity: isBusy && !form.applySuccessMessage ? 0.65 : 1,
              cursor:
                isBusy && !form.applySuccessMessage ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            className={
              primaryButtonState.style === ui.secondaryButton
                ? "project-update-secondary-button"
                : "project-update-primary-button"
            }
            onClick={handlePrimaryClick}
            disabled={primaryButtonState.disabled}
            style={primaryButtonState.style}
          >
            {primaryButtonState.label}
            {primaryButtonState.icon ? <span>{primaryButtonState.icon}</span> : null}
          </button>
        </footer>

        <style jsx global>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          ${ui.responsiveCss}

          .project-update-modal-grid {
            grid-template-columns: minmax(320px, 0.68fr) minmax(0, 1.32fr);
            gap: 18px;
          }

          .project-update-modal-grid > * {
            min-width: 0;
            width: 100%;
            max-width: 100%;
          }

          @media (max-width: 760px) {
            .project-update-modal-grid {
              grid-template-columns: 1fr;
              gap: 14px;
              width: 100% !important;
              max-width: 100% !important;
              min-width: 0 !important;
            }

            .project-update-modal-grid > * {
              min-width: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
          }
        `}</style>
      </section>
    </div>
  );

  return createPortal(modalContent, document.body);
}

function ProjectContext({
  clientName,
  projectTitle,
}: {
  clientName: string;
  projectTitle: string;
}) {
  if (!clientName && !projectTitle) {
    return null;
  }

  const displayClientName = clientName || "Client project";
  const displayProjectTitle = projectTitle || "Untitled project";

  return (
    <div style={projectContextStyle}>
      <div style={projectContextEyebrowStyle}>Project update for</div>

      <div style={projectContextMainLineStyle}>
        <span style={projectClientNameStyle}>{displayClientName}</span>
        <span style={projectDividerStyle}>/</span>
        <span style={projectTitleStyle}>{displayProjectTitle}</span>
      </div>
    </div>
  );
}

function getPrimaryButtonState({
  form,
  canAnalyze,
  canApply,
}: {
  form: ProjectUpdateFormState;
  canAnalyze: boolean;
  canApply: boolean;
}) {
  if (form.applySuccessMessage) {
    return {
      label: "Done",
      icon: "✓",
      disabled: false,
      style: ui.successButton,
    };
  }

  if (form.isAnalyzing) {
    return {
      label: "Analyzing...",
      icon: null,
      disabled: true,
      style: ui.primaryButtonDisabled,
    };
  }

  if (form.isApplying) {
    return {
      label: "Applying...",
      icon: null,
      disabled: true,
      style: ui.primaryButtonDisabled,
    };
  }

  if (form.analysisResult) {
    if (canApply) {
      const selectedApplyableCount = getSelectedApplyableItemCount(form);

      return {
        label:
          selectedApplyableCount === 1
            ? "Save 1 change"
            : `Save ${selectedApplyableCount} changes`,
        icon: "→",
        disabled: false,
        style: ui.primaryButton,
      };
    }

    return {
      label: "Close",
      icon: null,
      disabled: false,
      style: ui.secondaryButton,
    };
  }

  return {
    label: "Analyze update",
    icon: "→",
    disabled: !canAnalyze,
    style: canAnalyze ? ui.primaryButton : ui.primaryButtonDisabled,
  };
}

function hasSelectedApplyableItems(form: ProjectUpdateFormState) {
  return getSelectedApplyableItemCount(form) > 0;
}

function getSelectedApplyableItemCount(form: ProjectUpdateFormState) {
  const selectedIds = new Set(form.selectedItemIds);
  const items = form.analysisResult?.items ?? [];

  return items.filter(
    (item) =>
      selectedIds.has(item.id) &&
      item.type !== "duplicate_warning" &&
      item.type !== "no_action"
  ).length;
}

function getModalClientName(project: TaskProjectGroup | null) {
  return getProjectString(project, [
    "client_name",
    "clientName",
    "client",
    "contact_name",
  ]);
}

function getModalProjectTitle(project: TaskProjectGroup | null) {
  return getProjectString(project, [
    "project_title",
    "title",
    "task_title",
    "projectName",
  ]);
}

function getProjectString(project: TaskProjectGroup | null, keys: string[]) {
  if (!project) {
    return "";
  }

  const record = project as unknown as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  const nestedProject = record.project;

  if (nestedProject && typeof nestedProject === "object") {
    const nestedRecord = nestedProject as Record<string, unknown>;

    for (const key of keys) {
      const value = nestedRecord[key];

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }

      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
    }
  }

  return "";
}

const projectContextStyle: CSSProperties = {
  marginTop: 16,
  paddingLeft: 12,
  borderLeft: "3px solid #2563eb",
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const projectContextEyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#2563eb",
  fontSize: 10.5,
  lineHeight: 1.2,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.085em",
};

const projectContextMainLineStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
  minWidth: 0,
  flexWrap: "wrap",
};

const projectClientNameStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  lineHeight: 1.25,
  fontWeight: 950,
  letterSpacing: "-0.025em",
};

const projectDividerStyle: CSSProperties = {
  color: "#cbd5e1",
  fontSize: 12,
  fontWeight: 800,
};

const projectTitleStyle: CSSProperties = {
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.25,
  fontWeight: 750,
};
