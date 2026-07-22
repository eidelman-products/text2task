"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type ExtractInputPanelsProps = {
  text: string;
  onTextChange: (value: string) => void;
  onExtractText: () => void;
  onClearText: () => void;
  onImageSelected: (file: File) => void;
  onExtractImage: () => void;
  onRemoveImage: () => void;
  selectedImagePreviewUrl: string | null;
  selectedImageName: string;
  isBusy: boolean;
  imageProgress: number;
};

export default function ExtractInputPanels({
  text,
  onTextChange,
  onExtractText,
  onClearText,
  onImageSelected,
  onExtractImage,
  onRemoveImage,
  selectedImagePreviewUrl,
  selectedImageName,
  isBusy,
  imageProgress,
}: ExtractInputPanelsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pasteZoneRef = useRef<HTMLDivElement | null>(null);

  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isPasteFocused, setIsPasteFocused] = useState(false);
  const [pasteHintVisible, setPasteHintVisible] = useState(false);
  const [imageValidationError, setImageValidationError] = useState("");

  const hasText = Boolean(text.trim());
  const hasImage = Boolean(selectedImagePreviewUrl);

  function handleFile(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setImageValidationError("Please upload or paste an image file.");
      return;
    }

    setImageValidationError("");
    onImageSelected(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    handleFile(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingImage(false);

    const file = e.dataTransfer.files?.[0] || null;
    handleFile(file);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items;
    if (!items) {
      setImageValidationError("Clipboard does not contain an image.");
      return;
    }

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        handleFile(file);
        setPasteHintVisible(false);
        return;
      }
    }

    setImageValidationError("Clipboard does not contain an image.");
  }

  function handleRemoveImage() {
    setImageValidationError("");
    onRemoveImage();
  }

  function focusPasteZone() {
    pasteZoneRef.current?.focus();
    setPasteHintVisible(true);
  }

  useEffect(() => {
    if (!pasteHintVisible) return;

    const timer = setTimeout(() => {
      setPasteHintVisible(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, [pasteHintVisible]);

  useEffect(() => {
    setImageValidationError("");
  }, [selectedImagePreviewUrl]);

  return (
    <>
      <style>{extractInputPanelsCss}</style>

      <div className="extract-input-panels" style={panelsGridStyle}>
        <section className="extract-input-card" style={panelCardStyle}>
          <div style={panelHeaderStyle}>
            <div style={panelTitleRowStyle}>
              <div className="extract-icon-card" style={textIconStyle}>
                ✍
              </div>

              <div style={{ minWidth: 0 }}>
                <h3 style={panelTitleStyle}>Paste client work details</h3>
              </div>
            </div>
          </div>

          <p style={panelDescriptionStyle}>
            Paste an email, WhatsApp message, revision note, or client brief.
          </p>

          <div className="extract-textarea-shell" style={textareaShellStyle}>
            <textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder={`Type or paste the client request here...

Example:
Hi, I need a landing page, 3 ad creatives, and a logo for my new product launch.
Budget is around $2000 and I need the first draft by Friday.`}
              disabled={isBusy}
              style={textareaStyle}
            />

            <div style={textareaFooterStyle}>
              <div style={counterStyle}>{text.length} / 8000</div>
            </div>
          </div>

          <div style={actionRowStyle}>
            <button
              type="button"
              className="extract-primary-button"
              onClick={onExtractText}
              disabled={isBusy || !hasText}
              style={{
                ...primaryButtonStyle,
                cursor: isBusy || !hasText ? "not-allowed" : "pointer",
                opacity: isBusy || !hasText ? 0.68 : 1,
              }}
            >
              {isBusy ? "AI is extracting..." : "✦ Extract tasks"}
            </button>

            <button
              type="button"
              className="extract-secondary-button"
              onClick={onClearText}
              disabled={isBusy || !hasText}
              style={{
                ...secondaryButtonStyle,
                cursor: isBusy || !hasText ? "not-allowed" : "pointer",
                opacity: isBusy || !hasText ? 0.55 : 1,
              }}
            >
              Clear
            </button>

            <span style={actionHintStyle}>
              Review before saving. You stay in control.
            </span>
          </div>
        </section>

        <section className="extract-input-card" style={panelCardStyle}>
          <div style={panelHeaderStyle}>
            <div style={panelTitleRowStyle}>
              <div className="extract-icon-card" style={imageIconStyle}>
                ▣
              </div>

              <div style={{ minWidth: 0 }}>
                <h3 style={panelTitleStyle}>Upload or paste an image</h3>
              </div>
            </div>
          </div>

          <p style={panelDescriptionStyle}>
            Upload or paste a screenshot from WhatsApp, email, or a client
            message.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            style={{ display: "none" }}
          />

          <div style={imageTabsStyle}>
            <button
              type="button"
              className="extract-tab-button extract-tab-button-active"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              style={{
                ...tabButtonStyle,
                color: "#4f46e5",
                borderColor: "rgba(199,210,254,0.95)",
                background: "#eef2ff",
                cursor: isBusy ? "not-allowed" : "pointer",
                opacity: isBusy ? 0.6 : 1,
              }}
            >
              Upload
            </button>

            <button
              type="button"
              className="extract-tab-button"
              onClick={focusPasteZone}
              disabled={isBusy}
              style={{
                ...tabButtonStyle,
                cursor: isBusy ? "not-allowed" : "pointer",
                opacity: isBusy ? 0.6 : 1,
              }}
            >
              Paste from clipboard
            </button>

            <button
              type="button"
              className="extract-tab-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              style={{
                ...tabButtonStyle,
                cursor: isBusy ? "not-allowed" : "pointer",
                opacity: isBusy ? 0.6 : 1,
              }}
            >
              From device
            </button>
          </div>

          <div
            ref={pasteZoneRef}
            tabIndex={0}
            className="extract-drop-zone"
            onClick={() => {
              if (!isBusy) {
                pasteZoneRef.current?.focus();
              }
            }}
            onFocus={() => setIsPasteFocused(true)}
            onBlur={() => setIsPasteFocused(false)}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingImage(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingImage(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingImage(false);
            }}
            onDrop={handleDrop}
            onPaste={handlePaste}
            style={{
              ...dropZoneStyle,
              border:
                isDraggingImage || isPasteFocused
                  ? "2px solid #4f46e5"
                  : "2px dashed rgba(148,163,184,0.65)",
              background:
                isDraggingImage || isPasteFocused
                  ? "linear-gradient(180deg, #eef2ff 0%, #ffffff 100%)"
                  : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
              cursor: isBusy ? "not-allowed" : "pointer",
              minHeight: hasImage ? 250 : 198,
            }}
          >
            {selectedImagePreviewUrl ? (
              <div style={selectedImageShellStyle}>
                <div style={selectedImagePreviewFrameStyle}>
                  <Image
                    src={selectedImagePreviewUrl}
                    alt={selectedImageName || "Selected image"}
                    width={800}
                    height={600}
                    unoptimized
                    style={selectedImagePreviewStyle}
                  />
                </div>

                <div style={selectedImageMetaStyle}>
                  <div style={selectedImageNameStyle}>{selectedImageName}</div>

                  <div style={selectedImageTextStyle}>
                    Screenshot selected. You can analyze it now, replace it, or
                    remove it before extracting.
                  </div>
                </div>
              </div>
            ) : (
              <div style={emptyDropContentStyle}>
                <div className="extract-upload-icon" style={uploadIconStyle}>
                  ☁
                </div>

                <div style={dropTitleStyle}>
                  Drag & drop here, paste screenshot, or upload manually
                </div>

                <div style={dropTextStyle}>
                  Click this area first, then press{" "}
                  <span style={keyboardStyle}>Ctrl + V</span> to paste a
                  screenshot directly.
                </div>

                <div style={fileSupportStyle}>PNG, JPG, JPEG up to 10MB</div>

                {pasteHintVisible ? (
                  <div style={pasteHintStyle}>
                    Paste area focused. Now press Ctrl + V.
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {imageValidationError ? (
            <div role="alert" style={imageValidationErrorStyle}>
              {imageValidationError}
            </div>
          ) : null}

          {isBusy && imageProgress > 0 ? (
            <div style={progressShellStyle}>
              <div style={progressTopStyle}>
                <span>AI is processing the image...</span>
                <span>{imageProgress}%</span>
              </div>

              <div style={progressTrackStyle}>
                <div
                  style={{
                    ...progressFillStyle,
                    width: `${imageProgress}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          <div style={actionRowStyle}>
            <button
              type="button"
              className="extract-outline-action"
              onClick={onExtractImage}
              disabled={isBusy || !hasImage}
              style={{
                ...primaryOutlineButtonStyle,
                cursor: isBusy || !hasImage ? "not-allowed" : "pointer",
                opacity: isBusy || !hasImage ? 0.64 : 1,
              }}
            >
              {isBusy ? "Extracting..." : "✦ Analyze image"}
            </button>

            <button
              type="button"
              className="extract-danger-button"
              onClick={handleRemoveImage}
              disabled={isBusy || !hasImage}
              style={{
                ...dangerButtonStyle,
                cursor: isBusy || !hasImage ? "not-allowed" : "pointer",
                opacity: isBusy || !hasImage ? 0.5 : 1,
              }}
            >
              Remove image
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

const panelsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.12fr) minmax(360px, 0.88fr)",
  gap: 18,
  alignItems: "stretch",
  marginTop: 8,
};

const panelCardStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  alignContent: "start",
  gap: 16,
  borderRadius: 22,
  padding: 18,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,252,0.72) 100%)",
  border: "1px solid rgba(226,232,240,0.92)",
  boxShadow:
    "0 12px 28px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.92)",
  transition:
    "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background 180ms ease",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const panelTitleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
};

const textIconStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  background: "#eef2ff",
  color: "#4f46e5",
  border: "1px solid rgba(199,210,254,0.95)",
  boxShadow: "0 12px 24px rgba(79,70,229,0.08)",
  flexShrink: 0,
  transition: "transform 180ms ease, box-shadow 180ms ease",
};

const imageIconStyle: CSSProperties = {
  ...textIconStyle,
  background: "#ecfeff",
  color: "#0284c7",
  border: "1px solid rgba(186,230,253,0.95)",
};

const panelTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 19,
  lineHeight: 1.2,
  fontWeight: 850,
  letterSpacing: "-0.03em",
};

const panelDescriptionStyle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.65,
  fontWeight: 620,
};

const textareaShellStyle: CSSProperties = {
  borderRadius: 20,
  border: "1px solid rgba(203,213,225,0.86)",
  background: "#ffffff",
  overflow: "hidden",
  boxShadow:
    "0 12px 28px rgba(15,23,42,0.045), inset 0 1px 0 rgba(255,255,255,0.9)",
  transition: "box-shadow 180ms ease, border-color 180ms ease",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 226,
  resize: "vertical",
  border: "none",
  background:
    "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.7) 100%)",
  padding: 17,
  fontSize: 14,
  lineHeight: 1.75,
  color: "#0f172a",
  outline: "none",
  fontWeight: 560,
};

const textareaFooterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  padding: "10px 14px",
  borderTop: "1px solid rgba(226,232,240,0.85)",
  background: "rgba(248,250,252,0.78)",
};

const counterStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "center",
};

const primaryButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: 15,
  padding: "13px 18px",
  background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 850,
  boxShadow: "0 14px 28px rgba(79,70,229,0.24)",
  transition:
    "transform 160ms ease, box-shadow 160ms ease, filter 160ms ease",
};

const secondaryButtonStyle: CSSProperties = {
  borderRadius: 15,
  padding: "13px 17px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 800,
  border: "1px solid #dbe4f0",
  transition:
    "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
};

const actionHintStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const imageTabsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const tabButtonStyle: CSSProperties = {
  border: "1px solid rgba(226,232,240,0.95)",
  borderRadius: 999,
  padding: "8px 12px",
  background: "#ffffff",
  color: "#475569",
  fontSize: 12,
  fontWeight: 820,
  transition:
    "transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease, background 150ms ease",
};

const dropZoneStyle: CSSProperties = {
  borderRadius: 21,
  padding: 18,
  transition:
    "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background 180ms ease",
  outline: "none",
  display: "grid",
  alignItems: "center",
};

const emptyDropContentStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  textAlign: "center",
  gap: 9,
};

const uploadIconStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 17,
  display: "grid",
  placeItems: "center",
  background: "#eef2ff",
  color: "#4f46e5",
  border: "1px solid rgba(199,210,254,0.95)",
  fontSize: 18,
  fontWeight: 900,
  transition: "transform 180ms ease, box-shadow 180ms ease",
};

const dropTitleStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 850,
  letterSpacing: "-0.02em",
};

const dropTextStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.6,
  maxWidth: 420,
  fontWeight: 650,
};

const keyboardStyle: CSSProperties = {
  color: "#0f172a",
  fontWeight: 900,
};

const fileSupportStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 800,
};

const pasteHintStyle: CSSProperties = {
  marginTop: 3,
  fontSize: 12,
  fontWeight: 850,
  color: "#3730a3",
  background: "#e0e7ff",
  border: "1px solid #c7d2fe",
  borderRadius: 14,
  padding: "9px 11px",
};

const imageValidationErrorStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(248,113,113,0.34)",
  background: "rgba(254,242,242,0.9)",
  color: "#b91c1c",
  padding: "10px 12px",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
};

const selectedImageShellStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const selectedImagePreviewFrameStyle: CSSProperties = {
  width: "100%",
  borderRadius: 18,
  overflow: "hidden",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  boxShadow: "0 14px 30px rgba(15,23,42,0.08)",
};

const selectedImagePreviewStyle: CSSProperties = {
  width: "100%",
  height: "auto",
  maxHeight: 280,
  objectFit: "contain",
  display: "block",
  background: "#ffffff",
};

const selectedImageMetaStyle: CSSProperties = {
  display: "grid",
  gap: 4,
};

const selectedImageNameStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 850,
  wordBreak: "break-word",
};

const selectedImageTextStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.55,
  fontWeight: 650,
};

const progressShellStyle: CSSProperties = {
  display: "grid",
  gap: 9,
};

const progressTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  color: "#334155",
  fontSize: 12,
  fontWeight: 850,
};

const progressTrackStyle: CSSProperties = {
  width: "100%",
  height: 9,
  borderRadius: 999,
  background: "#e2e8f0",
  overflow: "hidden",
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, #4f46e5 0%, #0ea5e9 100%)",
  transition: "width 0.25s ease",
};

const primaryOutlineButtonStyle: CSSProperties = {
  border: "1px solid rgba(199,210,254,0.95)",
  borderRadius: 15,
  padding: "13px 18px",
  background: "#ffffff",
  color: "#4f46e5",
  fontSize: 14,
  fontWeight: 850,
  boxShadow: "0 12px 24px rgba(79,70,229,0.08)",
  transition:
    "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease",
};

const dangerButtonStyle: CSSProperties = {
  borderRadius: 15,
  padding: "13px 17px",
  background: "#ffffff",
  color: "#dc2626",
  fontSize: 14,
  fontWeight: 820,
  border: "1px solid #fecaca",
  transition:
    "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease",
};

const extractInputPanelsCss = `
  .extract-input-card:hover {
    transform: translateY(-1px);
    border-color: rgba(191, 219, 254, 0.9) !important;
    box-shadow:
      0 16px 34px rgba(15, 23, 42, 0.055),
      inset 0 1px 0 rgba(255,255,255,0.95) !important;
    background:
      linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.82) 100%) !important;
  }

  .extract-input-card:hover .extract-icon-card {
    transform: translateY(-1px) scale(1.03);
    box-shadow: 0 16px 30px rgba(79,70,229,0.14) !important;
  }

  .extract-textarea-shell:focus-within {
    border-color: rgba(99,102,241,0.72) !important;
    box-shadow:
      0 0 0 4px rgba(99,102,241,0.08),
      0 14px 32px rgba(15,23,42,0.06),
      inset 0 1px 0 rgba(255,255,255,0.95) !important;
  }

  .extract-drop-zone:hover {
    transform: translateY(-1px);
    border-color: rgba(99,102,241,0.82) !important;
    box-shadow:
      0 0 0 4px rgba(99,102,241,0.055),
      0 18px 36px rgba(15,23,42,0.07) !important;
  }

  .extract-drop-zone:hover .extract-upload-icon {
    transform: translateY(-1px) scale(1.04);
    box-shadow: 0 14px 28px rgba(79,70,229,0.12);
  }

  .extract-primary-button:not(:disabled):hover {
    transform: translateY(-1px);
    filter: brightness(1.04);
    box-shadow: 0 18px 34px rgba(79,70,229,0.30) !important;
  }

  .extract-secondary-button:not(:disabled):hover,
  .extract-outline-action:not(:disabled):hover,
  .extract-tab-button:not(:disabled):hover {
    transform: translateY(-1px);
    border-color: rgba(129,140,248,0.72) !important;
    box-shadow: 0 12px 24px rgba(15,23,42,0.07) !important;
    background: #ffffff !important;
  }

  .extract-danger-button:not(:disabled):hover {
    transform: translateY(-1px);
    border-color: rgba(248,113,113,0.72) !important;
    background: #fff7f7 !important;
    box-shadow: 0 12px 24px rgba(220,38,38,0.08) !important;
  }

  @media (max-width: 1180px) {
    .extract-input-panels {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 640px) {
    .extract-input-panels section {
      padding: 15px !important;
      border-radius: 20px !important;
    }

    .extract-input-panels textarea {
      min-height: 190px !important;
      font-size: 13px !important;
    }

    .extract-input-panels button {
      width: 100%;
      justify-content: center;
    }
  }
`;
