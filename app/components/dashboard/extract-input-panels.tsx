"use client";

import { useEffect, useRef, useState } from "react";

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

  function handleFile(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }

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
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        handleFile(file);
        setPasteHintVisible(false);
        break;
      }
    }
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

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 24,
          background:
            "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.82) 100%)",
          padding: 22,
          display: "grid",
          gap: 18,
          boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#4f46e5",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Text to tasks
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-0.03em",
            }}
          >
            Paste a messy request and turn it into structured work
          </div>

          <div
            style={{
              fontSize: 14,
              color: "#64748b",
              lineHeight: 1.7,
              maxWidth: 760,
            }}
          >
            Drop in a client message, email, voice transcript, or rough note.
            The system will extract clear task items you can review before saving.
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={`Example:
Hi, I need a landing page, 3 ad creatives, and a logo for my new product launch.
Budget is around $2000 and I need the first draft by Friday.`}
          disabled={isBusy}
          style={{
            width: "100%",
            minHeight: 210,
            resize: "vertical",
            borderRadius: 20,
            border: "1px solid #dbe4f0",
            background:
              "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
            padding: 18,
            fontSize: 15,
            lineHeight: 1.8,
            color: "#0f172a",
            outline: "none",
            boxShadow: "inset 0 1px 2px rgba(15,23,42,0.03)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={onExtractText}
            disabled={isBusy}
            style={{
              border: "none",
              borderRadius: 16,
              padding: "14px 22px",
              background:
                "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 800,
              cursor: isBusy ? "not-allowed" : "pointer",
              opacity: isBusy ? 0.75 : 1,
              boxShadow: "0 10px 24px rgba(79,70,229,0.24)",
            }}
          >
            {isBusy ? "AI is extracting..." : "Extract Tasks"}
          </button>

          <button
            type="button"
            onClick={onClearText}
            disabled={isBusy || !text.trim()}
            style={{
              borderRadius: 16,
              padding: "14px 20px",
              background: "#ffffff",
              color: "#0f172a",
              fontSize: 15,
              fontWeight: 800,
              border: "1px solid #dbe4f0",
              cursor: isBusy || !text.trim() ? "not-allowed" : "pointer",
              opacity: isBusy || !text.trim() ? 0.55 : 1,
            }}
          >
            Clear
          </button>

          <div
            style={{
              fontSize: 13,
              color: "#64748b",
              fontWeight: 600,
            }}
          >
            Paste first. Review after extraction. Save only when ready.
          </div>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 24,
          background:
            "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.82) 100%)",
          padding: 22,
          display: "grid",
          gap: 18,
          boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#0ea5e9",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Image to tasks
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-0.03em",
            }}
          >
            Upload or paste a screenshot
          </div>

          <div
            style={{
              fontSize: 14,
              color: "#64748b",
              lineHeight: 1.7,
              maxWidth: 760,
            }}
          >
            Use this when the task request lives inside WhatsApp, email, a quote,
            a PDF screenshot, or any image-based message.
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          style={{ display: "none" }}
        />

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            style={{
              border: "1px solid #dbe4f0",
              borderRadius: 16,
              padding: "12px 18px",
              background: "#ffffff",
              color: "#0f172a",
              fontSize: 14,
              fontWeight: 800,
              cursor: isBusy ? "not-allowed" : "pointer",
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            Upload image
          </button>

          <button
            type="button"
            onClick={focusPasteZone}
            disabled={isBusy}
            style={{
              border: "1px solid #dbe4f0",
              borderRadius: 16,
              padding: "12px 18px",
              background: "#ffffff",
              color: "#0f172a",
              fontSize: 14,
              fontWeight: 800,
              cursor: isBusy ? "not-allowed" : "pointer",
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            Focus paste area
          </button>
        </div>

        <div
          ref={pasteZoneRef}
          tabIndex={0}
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
            border:
              isDraggingImage || isPasteFocused
                ? "2px solid #4f46e5"
                : "2px dashed #cbd5e1",
            borderRadius: 22,
            background:
              isDraggingImage || isPasteFocused
                ? "linear-gradient(180deg, #eef2ff 0%, #f8fafc 100%)"
                : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
            padding: 24,
            minHeight: selectedImagePreviewUrl ? 280 : 190,
            transition: "all 0.2s ease",
            outline: "none",
            cursor: isBusy ? "not-allowed" : "pointer",
            display: "grid",
            alignItems: "center",
          }}
        >
          {selectedImagePreviewUrl ? (
            <div
              style={{
                display: "grid",
                gap: 18,
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 560,
                  borderRadius: 20,
                  overflow: "hidden",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  boxShadow: "0 14px 30px rgba(15,23,42,0.08)",
                }}
              >
                <img
                  src={selectedImagePreviewUrl}
                  alt={selectedImageName || "Selected image"}
                  style={{
                    width: "100%",
                    maxHeight: 320,
                    objectFit: "contain",
                    display: "block",
                    background: "#ffffff",
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#0f172a",
                    wordBreak: "break-word",
                  }}
                >
                  {selectedImageName}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: "#64748b",
                    lineHeight: 1.7,
                  }}
                >
                  Image selected successfully. You can extract now, replace it
                  with a different screenshot, or remove it first.
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 12,
                justifyItems: "start",
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: "#0f172a",
                  letterSpacing: "-0.02em",
                }}
              >
                Drop image here, paste a screenshot, or upload manually
              </div>

              <div
                style={{
                  fontSize: 14,
                  color: "#64748b",
                  lineHeight: 1.8,
                  maxWidth: 760,
                }}
              >
                This zone supports drag & drop and clipboard paste. Click here
                first and then press{" "}
                <span style={{ fontWeight: 800, color: "#0f172a" }}>
                  Ctrl + V
                </span>{" "}
                to paste a screenshot directly.
              </div>

              {pasteHintVisible ? (
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#3730a3",
                    background: "#e0e7ff",
                    border: "1px solid #c7d2fe",
                    borderRadius: 14,
                    padding: "10px 12px",
                  }}
                >
                  Paste area focused. Now press Ctrl + V.
                </div>
              ) : null}
            </div>
          )}
        </div>

        {isBusy && imageProgress > 0 ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#334155",
              }}
            >
              AI is processing the image...
            </div>

            <div
              style={{
                width: "100%",
                height: 10,
                borderRadius: 999,
                background: "#e2e8f0",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${imageProgress}%`,
                  height: "100%",
                  background:
                    "linear-gradient(90deg, #4f46e5 0%, #0ea5e9 100%)",
                  transition: "width 0.25s ease",
                }}
              />
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={onExtractImage}
            disabled={isBusy || !selectedImagePreviewUrl}
            style={{
              border: "none",
              borderRadius: 16,
              padding: "14px 22px",
              background:
                "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 800,
              cursor:
                isBusy || !selectedImagePreviewUrl ? "not-allowed" : "pointer",
              opacity: isBusy || !selectedImagePreviewUrl ? 0.75 : 1,
              boxShadow: "0 10px 24px rgba(79,70,229,0.24)",
            }}
          >
            {isBusy ? "Extracting..." : "Extract Tasks from Image"}
          </button>

          <button
            type="button"
            onClick={onRemoveImage}
            disabled={isBusy || !selectedImagePreviewUrl}
            style={{
              borderRadius: 16,
              padding: "14px 20px",
              background: "#ffffff",
              color: "#dc2626",
              fontSize: 15,
              fontWeight: 800,
              border: "1px solid #fecaca",
              cursor:
                isBusy || !selectedImagePreviewUrl ? "not-allowed" : "pointer",
              opacity: isBusy || !selectedImagePreviewUrl ? 0.6 : 1,
            }}
          >
            Remove image
          </button>
        </div>
      </div>
    </div>
  );
}