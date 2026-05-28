"use client";

import type {
  InputMethod,
  ProjectUpdateUIState,
} from "./project-update-types";
import ProjectUpdateShell from "./project-update-shell";

type ProjectUpdateModalProps = {
  uiState: ProjectUpdateUIState;
  onClose: () => void;
  onRawInputChange: (value: string) => void;
  onInputMethodChange: (value: InputMethod) => void;
  onAnalyze: () => void;
  onImageSelected: (file: File) => void;
  onRemoveImage: () => void;
  onImageError: (message: string | null) => void;
  onToggleSuggestedItem: (itemId: string) => void;
  onUpdateSuggestedItemValue: (
    itemId: string,
    field: string,
    value: string
  ) => void;
  onApply: () => void;
};

export default function ProjectUpdateModal({
  uiState,
  onClose,
  onRawInputChange,
  onInputMethodChange,
  onAnalyze,
  onImageSelected,
  onRemoveImage,
  onImageError,
  onToggleSuggestedItem,
  onUpdateSuggestedItemValue,
  onApply,
}: ProjectUpdateModalProps) {
  const { modal, form } = uiState;

  const isBusy = form.isAnalyzing || form.isApplying;

  return (
    <ProjectUpdateShell
      isOpen={modal.isOpen && Boolean(modal.project)}
      project={modal.project}
      form={form}
      isBusy={isBusy}
      onClose={onClose}
      onAnalyzeUpdate={onAnalyze}
      onApplySelectedChanges={onApply}
      onRawInputChange={onRawInputChange}
      onInputMethodChange={(value) => onInputMethodChange(value)}
      onImageSelected={onImageSelected}
      onRemoveImage={onRemoveImage}
      onImageError={onImageError}
      onToggleSuggestedItem={onToggleSuggestedItem}
      onUpdateSuggestedItemValue={onUpdateSuggestedItemValue}
    />
  );
}
