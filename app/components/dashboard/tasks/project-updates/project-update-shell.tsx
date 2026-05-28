"use client";

import { useEffect, useState, type MouseEvent } from "react";
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
  const contextParts = [clientName, projectTitle].filter(Boolean);

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
      style={ui.overlay}
      onMouseDown={handleOverlayMouseDown}
    >
      <section style={ui.modal} onMouseDown={(event) => event.stopPropagation()}>
        <header style={ui.header}>
          <div style={ui.headerMain}>
            <div style={ui.headerCopy}>
              <h2 style={ui.title}>Add client update</h2>

              <p style={ui.subtitle}>
                Review a client message or screenshot before saving changes.
              </p>

              {contextParts.length > 0 ? (
                <div style={ui.headerContextLine}>
                  {contextParts.map((part, index) => (
                    <span key={`${part}-${index}`}>
                      {index > 0 ? "· " : ""}
                      {part}
                    </span>
                  ))}
                </div>
              ) : null}
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

        <main style={ui.body}>
          <div style={ui.mainGrid}>
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

        <footer style={ui.footer}>
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

          @media (max-width: 760px) {
            [aria-label="Add client update"] {
              padding: 0 !important;
              align-items: stretch !important;
              justify-content: stretch !important;
              background: rgba(248, 250, 252, 1) !important;
              backdrop-filter: none !important;
            }
          }
        `}</style>
      </section>
    </div>
  );

  return createPortal(modalContent, document.body);
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
