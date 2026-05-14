"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { MouseEvent } from "react";
import type { TaskResource } from "./resource-api";

type ResourceNoteEditorModalProps = {
  isOpen: boolean;
  resource: TaskResource | null;
  isSaving?: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSave: (input: { resourceId: string; title: string; notes: string }) => void;
};

export default function ResourceNoteEditorModal({
  isOpen,
  resource,
  isSaving = false,
  errorMessage = "",
  onClose,
  onSave,
}: ResourceNoteEditorModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !resource) return;

    setTitle(resource.title || "");
    setNotes(resource.notes || "");
  }, [isOpen, resource]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSaving, onClose]);

  if (!isMounted || !isOpen || !resource) return null;

  const canSave = Boolean(notes.trim() || title.trim());

  function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !isSaving) {
      onClose();
    }
  }

  function handleSave() {
    if (!resource || !canSave || isSaving) return;

    onSave({
      resourceId: resource.id,
      title: title.trim(),
      notes: notes.trim(),
    });
  }

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit note"
      className="t2t-note-editor-overlay"
      onMouseDown={handleOverlayMouseDown}
    >
      <section
        className="t2t-note-editor-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="t2t-note-editor-header">
          <div className="t2t-note-editor-header-main">
            <div className="t2t-note-editor-icon">✍</div>

            <div>
              <div className="t2t-note-editor-eyebrow">Project note</div>
              <h2>View / edit note</h2>
              <p>Update the saved client instruction or internal context.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="t2t-note-editor-close"
            aria-label="Close note editor"
          >
            ×
          </button>
        </header>

        <main className="t2t-note-editor-body">
          {errorMessage ? (
            <div className="t2t-note-editor-error">{errorMessage}</div>
          ) : null}

          <label className="t2t-note-editor-field">
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Note title..."
              maxLength={160}
            />
          </label>

          <label className="t2t-note-editor-field">
            <span>Note</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Write the note here..."
              rows={8}
              maxLength={1000}
            />
          </label>

          <div className="t2t-note-editor-count">
            {notes.length}/1000 characters
          </div>
        </main>

        <footer className="t2t-note-editor-footer">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="t2t-note-editor-secondary"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="t2t-note-editor-primary"
          >
            {isSaving ? "Saving..." : "Save note"}
          </button>
        </footer>
      </section>

      <style jsx global>{`
        .t2t-note-editor-overlay {
          position: fixed;
          inset: 0;
          z-index: 10020;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(15, 23, 42, 0.38);
          backdrop-filter: blur(8px);
          box-sizing: border-box;
        }

        .t2t-note-editor-modal {
          width: min(560px, calc(100vw - 36px));
          max-height: calc(100dvh - 36px);
          display: flex;
          flex-direction: column;
          border-radius: 28px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background:
            radial-gradient(circle at 100% 0%, rgba(224, 231, 255, 0.8), transparent 34%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.98));
          box-shadow:
            0 30px 90px rgba(15, 23, 42, 0.28),
            0 0 0 1px rgba(255, 255, 255, 0.72);
          overflow: hidden;
          box-sizing: border-box;
        }

        .t2t-note-editor-header {
          flex: 0 0 auto;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 18px 18px 14px;
          border-bottom: 1px solid rgba(226, 232, 240, 0.78);
        }

        .t2t-note-editor-header-main {
          min-width: 0;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .t2t-note-editor-icon {
          width: 42px;
          height: 42px;
          border-radius: 17px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          background: rgba(238, 242, 255, 0.98);
          border: 1px solid rgba(199, 210, 254, 0.96);
          color: #4f46e5;
          box-shadow:
            0 14px 28px rgba(79, 70, 229, 0.11),
            inset 0 1px 0 rgba(255, 255, 255, 0.84);
        }

        .t2t-note-editor-eyebrow {
          color: #4f46e5;
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .t2t-note-editor-header h2 {
          margin: 4px 0 0;
          color: #0f172a;
          font-size: 22px;
          line-height: 1.1;
          font-weight: 950;
          letter-spacing: -0.045em;
        }

        .t2t-note-editor-header p {
          margin: 6px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 720;
        }

        .t2t-note-editor-close {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: rgba(255, 255, 255, 0.94);
          color: #64748b;
          font-size: 23px;
          line-height: 1;
          cursor: pointer;
          flex-shrink: 0;
        }

        .t2t-note-editor-close:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .t2t-note-editor-body {
          flex: 1 1 auto;
          overflow-y: auto;
          display: grid;
          gap: 12px;
          padding: 16px 18px;
          box-sizing: border-box;
        }

        .t2t-note-editor-error {
          border-radius: 16px;
          border: 1px solid rgba(253, 164, 175, 0.95);
          background: rgba(255, 241, 242, 0.95);
          color: #be123c;
          padding: 11px 12px;
          font-size: 13px;
          font-weight: 850;
          line-height: 1.45;
        }

        .t2t-note-editor-field {
          display: grid;
          gap: 7px;
          min-width: 0;
        }

        .t2t-note-editor-field span {
          color: #64748b;
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .t2t-note-editor-field input,
        .t2t-note-editor-field textarea {
          width: 100%;
          min-width: 0;
          border-radius: 16px;
          border: 1px solid rgba(203, 213, 225, 0.95);
          background: rgba(255, 255, 255, 0.98);
          color: #0f172a;
          font-size: 13px;
          font-weight: 760;
          outline: none;
          box-sizing: border-box;
        }

        .t2t-note-editor-field input {
          min-height: 44px;
          padding: 0 13px;
        }

        .t2t-note-editor-field textarea {
          min-height: 190px;
          padding: 12px 13px;
          line-height: 1.55;
          resize: vertical;
        }

        .t2t-note-editor-count {
          color: #94a3b8;
          font-size: 11px;
          font-weight: 800;
          text-align: right;
        }

        .t2t-note-editor-footer {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 14px 18px 18px;
          border-top: 1px solid rgba(226, 232, 240, 0.72);
        }

        .t2t-note-editor-secondary,
        .t2t-note-editor-primary {
          min-height: 40px;
          border-radius: 14px;
          padding: 0 15px;
          font-size: 12px;
          font-weight: 950;
          cursor: pointer;
        }

        .t2t-note-editor-secondary {
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: rgba(255, 255, 255, 0.95);
          color: #475569;
        }

        .t2t-note-editor-primary {
          border: none;
          background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
          color: #ffffff;
          box-shadow: 0 14px 26px rgba(79, 70, 229, 0.22);
        }

        .t2t-note-editor-secondary:disabled,
        .t2t-note-editor-primary:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        @media (max-width: 760px) {
          .t2t-note-editor-overlay {
            padding: 0;
            align-items: stretch;
            justify-content: stretch;
            background: rgba(248, 250, 252, 1);
            backdrop-filter: none;
          }

          .t2t-note-editor-modal {
            width: 100vw;
            height: 100dvh;
            max-height: 100dvh;
            border-radius: 0;
            border: none;
            box-shadow: none;
          }

          .t2t-note-editor-header {
            position: sticky;
            top: 0;
            z-index: 2;
            padding: 13px 14px;
            background:
              radial-gradient(circle at 100% 0%, rgba(224, 231, 255, 0.78), transparent 34%),
              rgba(255, 255, 255, 0.97);
            backdrop-filter: blur(12px);
          }

          .t2t-note-editor-icon {
            width: 38px;
            height: 38px;
            border-radius: 15px;
          }

          .t2t-note-editor-header h2 {
            font-size: 20px;
          }

          .t2t-note-editor-header p {
            font-size: 12px;
          }

          .t2t-note-editor-body {
            padding: 14px;
          }

          .t2t-note-editor-field textarea {
            min-height: 260px;
          }

          .t2t-note-editor-footer {
            position: sticky;
            bottom: 0;
            background: rgba(255, 255, 255, 0.96);
            backdrop-filter: blur(12px);
            padding: 12px 14px 16px;
          }

          .t2t-note-editor-secondary,
          .t2t-note-editor-primary {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
}