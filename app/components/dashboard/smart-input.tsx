"use client";

import { useRef, useState } from "react";

type SmartInputProps = {
  text: string;
  setText: (value: string) => void;
  onImageSelect: (file: File) => void;
  isBusy?: boolean;
};

export default function SmartInput({
  text,
  setText,
  onImageSelect,
  isBusy = false,
}: SmartInputProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function openFilePicker() {
    if (isBusy) return;
    fileInputRef.current?.click();
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || isBusy) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      onImageSelect(file);
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!isBusy) {
      setIsDragging(true);
    }
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    if (isBusy) return;

    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          onImageSelect(file);
        }
      }
    }
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onPaste={handlePaste}
      style={{
        border: isDragging ? "2px dashed #2563eb" : "2px dashed #cbd5e1",
        borderRadius: 20,
        background: isDragging ? "#eff6ff" : "#ffffff",
        padding: 18,
        transition: "all 0.2s ease",
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Paste the message here...

Example:
Hi, I need a landing page, a logo, and 3 ad creatives for my business. Budget is around $2000. Can you send me a quote by Friday?

You can also:
• drag and drop images here
• paste a screenshot with Ctrl+V
• upload one or more image files`}
        style={{
          width: "100%",
          minHeight: 220,
          resize: "vertical",
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          padding: 16,
          fontSize: 15,
          lineHeight: 1.7,
          color: "#0f172a",
          background: "#ffffff",
          outline: "none",
        }}
      />

      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: "#64748b",
            lineHeight: 1.6,
            fontWeight: 700,
          }}
        >
          Drag & drop images, paste screenshots, or upload files.
        </div>

        <button
          type="button"
          onClick={openFilePicker}
          disabled={isBusy}
          style={{
            borderRadius: 12,
            padding: "10px 14px",
            background: "#ffffff",
            color: "#0f172a",
            fontSize: 14,
            fontWeight: 800,
            border: "1px solid #cbd5e1",
            cursor: isBusy ? "not-allowed" : "pointer",
            opacity: isBusy ? 0.65 : 1,
          }}
        >
          {isBusy ? "Processing..." : "Choose images"}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        multiple
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
}