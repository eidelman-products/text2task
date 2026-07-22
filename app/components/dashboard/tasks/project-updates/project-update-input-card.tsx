"use client";

import Image from "next/image";
import { useRef, type ChangeEvent, type ClipboardEvent, type DragEvent } from "react";

import * as ui from "./project-update-ui-styles";
import type { ProjectUpdateInputV2Props } from "./project-update-ui-types";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export default function ProjectUpdateInputCard({
  form,
  isBusy,
  onRawInputChange,
  onInputMethodChange,
  onImageSelected,
  onRemoveImage,
  onImageError,
}: ProjectUpdateInputV2Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isImageMode = form.inputMethod === "image";
  const selectedImage = form.selectedImage;
  const canEdit = !isBusy && !form.isApplying;

  function handleFile(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onImageError("Upload a PNG, JPG, JPEG, or WEBP image.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      onImageError("This image is too large. Upload images up to 10MB.");
      return;
    }

    onImageError(null);
    onImageSelected(file);
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.currentTarget.files?.[0] || null);

    if (event.currentTarget) {
      event.currentTarget.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!canEdit) return;

    handleFile(event.dataTransfer.files?.[0] || null);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    if (!canEdit || !isImageMode) return;

    const imageFile = Array.from(event.clipboardData.files).find((file) =>
      file.type.startsWith("image/")
    );

    if (!imageFile) return;

    event.preventDefault();
    handleFile(imageFile);
  }

  return (
    <section className={ui.responsiveClassNames.inputCard} style={ui.card}>
      <div style={ui.cardHeader}>
        <div style={ui.cardIcon}>{isImageMode ? "▣" : "✎"}</div>

        <div style={{ minWidth: 0 }}>
          <h3 style={ui.cardTitle}>Update source</h3>
        </div>
      </div>

      <div
        className={ui.responsiveClassNames.inputTabs}
        style={ui.tabs}
        aria-label="Update source"
      >
        <SourceTab
          active={!isImageMode}
          icon="✎"
          label="Text update"
          disabled={!canEdit}
          onClick={() => onInputMethodChange("text")}
        />

        <SourceTab
          active={isImageMode}
          icon="▣"
          label="Screenshot update"
          disabled={!canEdit}
          onClick={() => onInputMethodChange("image")}
        />
      </div>

      {!isImageMode ? (
        <TextUpdateInput
          value={form.rawInput}
          disabled={!canEdit}
          onChange={onRawInputChange}
        />
      ) : (
        <ScreenshotUpdateInput
          selectedImage={selectedImage}
          imageError={form.imageError}
          disabled={!canEdit}
          fileInputRef={fileInputRef}
          onFileInputChange={handleFileInputChange}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onPaste={handlePaste}
          onRemoveImage={onRemoveImage}
        />
      )}
    </section>
  );
}

function SourceTab({
  active,
  icon,
  label,
  disabled,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...ui.tab,
        ...(active ? ui.tabActive : {}),
        opacity: disabled ? 0.7 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function TextUpdateInput({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={ui.field}>
        <span style={ui.label}>Message</span>

        <textarea
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Example: The client asked to add a FAQ section, change the deadline to next Friday, and update the homepage headline..."
          style={{
            ...ui.textarea,
            minHeight: 152,
            opacity: disabled ? 0.72 : 1,
          }}
        />
      </label>

      <div style={ui.helperRow}>
        <strong>{value.length} / 8000</strong>
      </div>
    </div>
  );
}

function ScreenshotUpdateInput({
  selectedImage,
  imageError,
  disabled,
  fileInputRef,
  onFileInputChange,
  onDrop,
  onDragOver,
  onPaste,
  onRemoveImage,
}: {
  selectedImage: ProjectUpdateInputV2Props["form"]["selectedImage"];
  imageError: string | null;
  disabled: boolean;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLDivElement>) => void;
  onRemoveImage: () => void;
}) {
  if (selectedImage) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div className={ui.responsiveClassNames.imagePreview} style={ui.imagePreview}>
          <div style={ui.imageFrame}>
            <Image
              src={selectedImage.previewUrl}
              alt="Selected client update screenshot"
              width={160}
              height={142}
              unoptimized
              style={ui.image}
            />
          </div>

          <div style={ui.previewDetails}>
            <div style={ui.previewLabel}>Screenshot selected</div>
            <div style={ui.previewTitle}>{selectedImage.file.name}</div>
            <div style={ui.previewMeta}>
              {formatFileSize(selectedImage.file.size)} · Ready to analyze
            </div>

            <div style={ui.previewActions}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  ...ui.smallButton,
                  opacity: disabled ? 0.65 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                Change image
              </button>

              <button
                type="button"
                disabled={disabled}
                onClick={onRemoveImage}
                style={{
                  ...ui.smallButton,
                  background: "rgba(255, 255, 255, 0.92)",
                  color: "#64748b",
                  borderColor: "rgba(226, 232, 240, 0.95)",
                  opacity: disabled ? 0.65 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>

        <HiddenImageInput
          inputRef={fileInputRef}
          onChange={onFileInputChange}
        />

        {imageError ? <div style={ui.errorBox}>{imageError}</div> : null}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        role="button"
        tabIndex={0}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onPaste={onPaste}
        style={{
          ...ui.uploadBox,
          opacity: disabled ? 0.72 : 1,
          cursor: disabled ? "not-allowed" : "default",
        }}
      >
        <div style={ui.uploadIcon}>☁</div>
        <strong style={ui.uploadTitle}>Paste a screenshot</strong>
        <p style={ui.uploadHelp}>
          Press Ctrl+V to paste a client screenshot, or upload an image file.
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            fileInputRef.current?.click();
          }}
          style={{
            ...ui.smallButton,
            opacity: disabled ? 0.65 : 1,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          Upload image
        </button>
        <p style={ui.uploadHelp}>PNG, JPG, JPEG, WEBP up to 10MB</p>
      </div>

      <HiddenImageInput inputRef={fileInputRef} onChange={onFileInputChange} />

      {imageError ? <div style={ui.errorBox}>{imageError}</div> : null}
    </div>
  );
}

function HiddenImageInput({
  inputRef,
  onChange,
}: {
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/png,image/jpeg,image/jpg,image/webp"
      onChange={onChange}
      style={{ display: "none" }}
    />
  );
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 KB";
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
