"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ChangeEvent, MouseEvent } from "react";
import ResourceNoteEditorModal from "./resource-note-editor-modal";
import {
  createLinkResource,
  createNoteResource,
  deleteTaskResource,
  fetchTaskResources,
  formatResourceFileSize,
  getResourceIcon,
  getResourceTypeLabel,
  getTaskResourceFileUrl,
  isFileResource,
  isLinkResource,
  isNoteResource,
  updateTaskResource,
  uploadAndCreateFileResource,
  type TaskResource,
  type TaskResourceType,
} from "./resource-api";

type ResourceManagerModalProps = {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  projectId?: string | null;
  taskId?: number | null;
  onClose: () => void;
  onResourcesChanged?: (resources: TaskResource[]) => void;
};

type ResourceTab = "link" | "file" | "note";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const LINK_RESOURCE_TYPES: TaskResourceType[] = [
  "link",
  "website",
  "reference",
  "brief",
];

const FILE_RESOURCE_TYPES: TaskResourceType[] = [
  "file",
  "image",
  "logo",
  "banner",
  "document",
  "brief",
  "reference",
];

export default function ResourceManagerModal({
  isOpen,
  title = "Project resources",
  subtitle = "Keep client links, files, logos, references, briefs, and notes attached to this project.",
  projectId = null,
  taskId = null,
  onClose,
  onResourcesChanged,
}: ResourceManagerModalProps) {
  const [isMounted, setIsMounted] = useState(false);

  const [resources, setResources] = useState<TaskResource[]>([]);
  const [activeTab, setActiveTab] = useState<ResourceTab>("link");

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [deletingResourceId, setDeletingResourceId] = useState<string | null>(
    null
  );
  const [resourcePendingDelete, setResourcePendingDelete] =
    useState<TaskResource | null>(null);
  const [deleteConfirmationError, setDeleteConfirmationError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [editingNoteResource, setEditingNoteResource] =
    useState<TaskResource | null>(null);
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);
  const [noteEditorError, setNoteEditorError] = useState("");

  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkType, setLinkType] = useState<TaskResourceType>("link");

  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");

  const [fileTitle, setFileTitle] = useState("");
  const [fileNotes, setFileNotes] = useState("");
  const [fileType, setFileType] = useState<TaskResourceType>("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasTarget = Boolean(projectId || taskId);
  const isBusy =
    isLoading ||
    isSavingLink ||
    isSavingNote ||
    isUploadingFile ||
    isUpdatingNote ||
    Boolean(deletingResourceId);

  const resourceStats = useMemo(() => {
    const files = resources.filter(isFileResource).length;
    const links = resources.filter(isLinkResource).length;
    const notes = resources.filter(isNoteResource).length;

    return {
      total: resources.length,
      files,
      links,
      notes,
    };
  }, [resources]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    void loadResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId, taskId]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) {
        if (resourcePendingDelete) {
          setResourcePendingDelete(null);
          setDeleteConfirmationError("");
          return;
        }

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
  }, [isOpen, isBusy, onClose, resourcePendingDelete]);

  if (!isMounted || !isOpen) return null;

  async function loadResources() {
    if (!hasTarget) {
      setResources([]);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");

      const nextResources = await fetchTaskResources({
        project_id: projectId,
        task_id: taskId,
      });

      setResources(nextResources);
      onResourcesChanged?.(nextResources);
    } catch (error: any) {
      setErrorMessage(error?.message || "Failed to load resources.");
    } finally {
      setIsLoading(false);
    }
  }

  function resetLinkForm() {
    setLinkTitle("");
    setLinkUrl("");
    setLinkType("link");
  }

  function resetNoteForm() {
    setNoteTitle("");
    setNoteText("");
  }

  function resetFileForm() {
    setFileTitle("");
    setFileNotes("");
    setFileType("file");
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function normalizeUrl(rawUrl: string) {
    const cleanUrl = rawUrl.trim();

    if (!cleanUrl) return "";

    if (
      cleanUrl.startsWith("http://") ||
      cleanUrl.startsWith("https://") ||
      cleanUrl.startsWith("mailto:")
    ) {
      return cleanUrl;
    }

    return `https://${cleanUrl}`;
  }

  async function handleCreateLink() {
    if (!hasTarget || isSavingLink) return;

    const cleanUrl = normalizeUrl(linkUrl);

    if (!cleanUrl) {
      setErrorMessage("Add a URL before saving the link.");
      return;
    }

    try {
      setIsSavingLink(true);
      setErrorMessage("");

      await createLinkResource({
        project_id: projectId,
        task_id: taskId,
        title: linkTitle.trim() || cleanUrl,
        url: cleanUrl,
        resource_type: linkType,
      });

      resetLinkForm();
      await loadResources();
    } catch (error: any) {
      setErrorMessage(error?.message || "Failed to add link.");
    } finally {
      setIsSavingLink(false);
    }
  }

  async function handleCreateNote() {
    if (!hasTarget || isSavingNote) return;

    const cleanNote = noteText.trim();

    if (!cleanNote) {
      setErrorMessage("Write a note before saving it.");
      return;
    }

    try {
      setIsSavingNote(true);
      setErrorMessage("");

      await createNoteResource({
        project_id: projectId,
        task_id: taskId,
        title: noteTitle.trim() || "Internal note",
        notes: cleanNote,
      });

      resetNoteForm();
      await loadResources();
    } catch (error: any) {
      setErrorMessage(error?.message || "Failed to add note.");
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleUpdateNoteResource(input: {
    resourceId: string;
    title: string;
    notes: string;
  }) {
    if (isUpdatingNote) return;

    try {
      setIsUpdatingNote(true);
      setNoteEditorError("");

      await updateTaskResource({
        resource_id: input.resourceId,
        resource_type: "note",
        title: input.title || "Internal note",
        notes: input.notes,
      });

      setEditingNoteResource(null);
      await loadResources();
    } catch (error: any) {
      setNoteEditorError(error?.message || "Failed to update note.");
    } finally {
      setIsUpdatingNote(false);
    }
  }

  async function handleUploadFile() {
    if (!hasTarget || isUploadingFile) return;

    if (!selectedFile) {
      setErrorMessage("Choose a file before uploading.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage("This file is too large. Upload files up to 10MB.");
      return;
    }

    try {
      setIsUploadingFile(true);
      setErrorMessage("");

      await uploadAndCreateFileResource({
        file: selectedFile,
        project_id: projectId,
        task_id: taskId,
        title: fileTitle.trim() || selectedFile.name,
        notes: fileNotes.trim() || null,
        resource_type: fileType,
      });

      resetFileForm();
      await loadResources();
    } catch (error: any) {
      setErrorMessage(error?.message || "Failed to upload file.");
    } finally {
      setIsUploadingFile(false);
    }
  }

  function requestDeleteResource(resource: TaskResource) {
    if (deletingResourceId) return;

    setResourcePendingDelete(resource);
    setDeleteConfirmationError("");
  }

  function cancelDeleteConfirmation() {
    if (deletingResourceId) return;

    setResourcePendingDelete(null);
    setDeleteConfirmationError("");
  }

  async function handleDeleteResource() {
    if (!resourcePendingDelete || deletingResourceId) return;

    const resourceId = resourcePendingDelete.id;

    try {
      setDeletingResourceId(resourceId);
      setErrorMessage("");
      setDeleteConfirmationError("");

      await deleteTaskResource(resourceId);
      await loadResources();
      setResourcePendingDelete(null);
    } catch (error: any) {
      const message = error?.message || "Failed to delete resource.";

      setErrorMessage(message);
      setDeleteConfirmationError(message);
    } finally {
      setDeletingResourceId(null);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] || null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      setErrorMessage("This file is too large. Upload files up to 10MB.");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    setErrorMessage("");
    setSelectedFile(file);

    if (!fileTitle.trim()) {
      setFileTitle(file.name);
    }
  }

  function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !isBusy) {
      onClose();
    }
  }

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Project resources"
      className="t2t-resource-overlay"
      onMouseDown={handleOverlayMouseDown}
    >
      <section
        className="t2t-resource-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="t2t-resource-header">
          <div className="t2t-resource-header-main">
            <div className="t2t-resource-icon">📎</div>

            <div className="t2t-resource-header-copy">
              <h2>{title}</h2>
              <p>{subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close resources modal"
            className="t2t-resource-close"
          >
            ×
          </button>
        </header>

        <main className="t2t-resource-body">
          <div className="t2t-resource-stats">
            <StatPill label="Resources" value={resourceStats.total} tone="blue" />
            <StatPill label="Files" value={resourceStats.files} tone="purple" />
            <StatPill label="Links" value={resourceStats.links} tone="green" />
            <StatPill label="Notes" value={resourceStats.notes} tone="slate" />
          </div>

          {!hasTarget ? (
            <div className="t2t-resource-warning">
              Resource manager is ready, but no project or task target was
              provided.
            </div>
          ) : null}

          {errorMessage ? (
            <div className="t2t-resource-error">
              <span>{errorMessage}</span>

              <button type="button" onClick={() => setErrorMessage("")}>
                Dismiss
              </button>
            </div>
          ) : null}

          <div className="t2t-resource-grid">
            <section className="t2t-resource-left">
              <div className="t2t-resource-tabs">
                <TabButton
                  active={activeTab === "link"}
                  label="Link"
                  desktopLabel="Add link"
                  icon="🔗"
                  onClick={() => setActiveTab("link")}
                />

                <TabButton
                  active={activeTab === "file"}
                  label="File"
                  desktopLabel="Upload file"
                  icon="⬆"
                  onClick={() => setActiveTab("file")}
                />

                <TabButton
                  active={activeTab === "note"}
                  label="Note"
                  desktopLabel="Add note"
                  icon="✍"
                  onClick={() => setActiveTab("note")}
                />
              </div>

              {activeTab === "link" ? (
                <div className="t2t-resource-form-card">
                  <FormHeader
                    icon="🔗"
                    title="Add a useful link"
                    subtitle="Website, Drive, Figma, Dropbox, YouTube, brief, or client reference."
                  />

                  <label className="t2t-resource-field">
                    <span>Type</span>
                    <select
                      value={linkType}
                      onChange={(event) =>
                        setLinkType(event.target.value as TaskResourceType)
                      }
                    >
                      {LINK_RESOURCE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {getResourceTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="t2t-resource-field">
                    <span>Title</span>
                    <input
                      value={linkTitle}
                      onChange={(event) => setLinkTitle(event.target.value)}
                      placeholder="Client website, Figma file, product page..."
                    />
                  </label>

                  <label className="t2t-resource-field">
                    <span>URL</span>
                    <input
                      value={linkUrl}
                      onChange={(event) => setLinkUrl(event.target.value)}
                      placeholder="https://example.com"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleCreateLink}
                    disabled={!hasTarget || isSavingLink}
                    className="t2t-resource-primary"
                  >
                    {isSavingLink ? "Adding link..." : "Add link"}
                  </button>
                </div>
              ) : null}

              {activeTab === "file" ? (
                <div className="t2t-resource-form-card">
                  <FormHeader
                    icon="⬆"
                    title="Upload a project file"
                    subtitle="Attach logos, screenshots, documents, PDFs, briefs, or reference files up to 10MB."
                  />

                  <label className="t2t-resource-field">
                    <span>File type</span>
                    <select
                      value={fileType}
                      onChange={(event) =>
                        setFileType(event.target.value as TaskResourceType)
                      }
                    >
                      {FILE_RESOURCE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {getResourceTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="t2t-resource-upload">
                    <div className="t2t-resource-upload-icon">⬆</div>

                    <strong>
                      {selectedFile ? selectedFile.name : "Choose a file"}
                    </strong>

                    <p>
                      {selectedFile
                        ? formatResourceFileSize(selectedFile.size)
                        : "PNG, JPG, WEBP, GIF, PDF, TXT, CSV, DOCX, XLSX up to 10MB"}
                    </p>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse file
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    />
                  </div>

                  <label className="t2t-resource-field">
                    <span>Title</span>
                    <input
                      value={fileTitle}
                      onChange={(event) => setFileTitle(event.target.value)}
                      placeholder="Logo, banner reference, client brief..."
                    />
                  </label>

                  <label className="t2t-resource-field">
                    <span>Notes</span>
                    <textarea
                      value={fileNotes}
                      onChange={(event) => setFileNotes(event.target.value)}
                      placeholder="Use this logo, current homepage reference..."
                      rows={3}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleUploadFile}
                    disabled={!hasTarget || !selectedFile || isUploadingFile}
                    className="t2t-resource-primary"
                  >
                    {isUploadingFile ? "Uploading..." : "Upload resource"}
                  </button>
                </div>
              ) : null}

              {activeTab === "note" ? (
                <div className="t2t-resource-form-card">
                  <FormHeader
                    icon="✍"
                    title="Add an internal note"
                    subtitle="Save instructions, client preferences, design direction, or important context."
                  />

                  <label className="t2t-resource-field">
                    <span>Title</span>
                    <input
                      value={noteTitle}
                      onChange={(event) => setNoteTitle(event.target.value)}
                      placeholder="Logo instructions, design direction..."
                    />
                  </label>

                  <label className="t2t-resource-field">
                    <span>Note</span>
                    <textarea
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      placeholder="Write the note here..."
                      rows={5}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleCreateNote}
                    disabled={!hasTarget || isSavingNote}
                    className="t2t-resource-primary"
                  >
                    {isSavingNote ? "Adding note..." : "Add note"}
                  </button>
                </div>
              ) : null}
            </section>

            <section className="t2t-resource-right">
              <div className="t2t-resource-saved-header">
                <div>
                  <h3>Saved resources</h3>
                  <p>Files, links, and notes attached to this project.</p>
                </div>

                <button
                  type="button"
                  onClick={loadResources}
                  disabled={isLoading || !hasTarget}
                >
                  {isLoading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {isLoading ? (
                <EmptyState
                  icon="⌛"
                  title="Loading resources..."
                  text="Pulling the latest project context."
                />
              ) : resources.length === 0 ? (
                <EmptyState
                  icon="📎"
                  title="No resources yet"
                  text="Add a link, upload a file, or write a note to keep the full client context in one place."
                />
              ) : (
                <div className="t2t-resource-list">
                  {resources.map((resource) => (
                    <ResourceRow
                      key={resource.id}
                      resource={resource}
                      isDeleting={deletingResourceId === resource.id}
                      onDelete={() => requestDeleteResource(resource)}
                      onEditNote={() => {
                        setNoteEditorError("");
                        setEditingNoteResource(resource);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </section>

      <ResourceNoteEditorModal
        isOpen={Boolean(editingNoteResource)}
        resource={editingNoteResource}
        isSaving={isUpdatingNote}
        errorMessage={noteEditorError}
        onClose={() => {
          if (!isUpdatingNote) {
            setEditingNoteResource(null);
            setNoteEditorError("");
          }
        }}
        onSave={handleUpdateNoteResource}
      />

      {resourcePendingDelete ? (
        <div
          role="presentation"
          className="t2t-resource-delete-confirm-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelDeleteConfirmation();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="resource-delete-confirm-title"
            className="t2t-resource-delete-confirm"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="t2t-resource-delete-confirm-icon">!</div>

            <div>
              <h3 id="resource-delete-confirm-title">Delete this resource?</h3>
              <p>This will remove the resource from this project.</p>
            </div>

            {deleteConfirmationError ? (
              <div
                role="alert"
                className="t2t-resource-delete-confirm-error"
              >
                {deleteConfirmationError}
              </div>
            ) : null}

            <div className="t2t-resource-delete-confirm-actions">
              <button
                type="button"
                onClick={cancelDeleteConfirmation}
                disabled={Boolean(deletingResourceId)}
                className="t2t-resource-delete-confirm-cancel"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteResource}
                disabled={Boolean(deletingResourceId)}
                className="t2t-resource-delete-confirm-submit"
              >
                {deletingResourceId ? "Deleting..." : "Delete resource"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <style jsx global>{`
        .t2t-resource-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(15, 23, 42, 0.42);
          backdrop-filter: blur(4px);
          overflow: hidden;
          box-sizing: border-box;
        }

        .t2t-resource-modal {
          width: min(1240px, calc(100vw - 36px));
          max-height: calc(100dvh - 36px);
          display: flex;
          flex-direction: column;
          border-radius: 24px;
          border: 1px solid rgba(203, 213, 225, 0.72);
          background: #f8fafc;
          box-shadow:
            0 24px 64px rgba(15, 23, 42, 0.16),
            0 4px 14px rgba(15, 23, 42, 0.05);
          overflow: hidden;
          box-sizing: border-box;
        }

        .t2t-resource-header {
          flex: 0 0 auto;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 17px 20px 14px;
          border-bottom: 1px solid rgba(226, 232, 240, 0.72);
          background: rgba(255, 255, 255, 0.98);
        }

        .t2t-resource-header-main {
          min-width: 0;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .t2t-resource-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          background: rgba(239, 246, 255, 0.92);
          border: 1px solid rgba(191, 219, 254, 0.74);
          color: #2563eb;
          box-shadow: none;
        }

        .t2t-resource-header-copy {
          min-width: 0;
        }

        .t2t-resource-eyebrow {
          color: #2563eb;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .t2t-resource-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 26px;
          line-height: 1.12;
          font-weight: 900;
          letter-spacing: 0;
        }

        .t2t-resource-header p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.5;
          font-weight: 650;
        }

        .t2t-resource-close {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          border: 1px solid rgba(226, 232, 240, 0.82);
          background: #ffffff;
          color: #64748b;
          font-size: 23px;
          line-height: 1;
          cursor: pointer;
          flex-shrink: 0;
        }

        .t2t-resource-body {
          flex: 1 1 auto;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 14px 20px 20px;
          background: #f8fafc;
          box-sizing: border-box;
        }

        .t2t-resource-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
          margin-bottom: 12px;
        }

        .t2t-resource-stat {
          min-width: 0;
          min-height: 38px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          border-radius: 9px;
          border: 1px solid;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 750;
          box-sizing: border-box;
        }

        .t2t-resource-warning {
          border-radius: 10px;
          border: 1px solid rgba(253, 230, 138, 0.72);
          background: rgba(255, 251, 235, 0.72);
          color: #92400e;
          padding: 11px 12px;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .t2t-resource-error {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-radius: 10px;
          border: 1px solid rgba(254, 202, 202, 0.78);
          background: rgba(254, 242, 242, 0.74);
          color: #be123c;
          padding: 11px 12px;
          font-size: 13px;
          font-weight: 750;
          margin-bottom: 12px;
        }

        .t2t-resource-error button {
          border: 0;
          background: transparent;
          color: #be123c;
          font-size: 12px;
          font-weight: 950;
          cursor: pointer;
          white-space: nowrap;
        }

        .t2t-resource-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
          gap: 14px;
          min-width: 0;
          align-items: start;
        }

        .t2t-resource-left {
          display: grid;
          align-content: start;
          gap: 12px;
          min-width: 0;
        }

        .t2t-resource-right {
          min-width: 0;
          border-radius: 12px;
          border: 1px solid rgba(226, 232, 240, 0.72);
          background: rgba(255, 255, 255, 0.72);
          padding: 12px;
          display: grid;
          align-content: start;
          gap: 12px;
          box-shadow: none;
          box-sizing: border-box;
        }

        .t2t-resource-tabs {
          display: grid;
          grid-template-columns: repeat(3, max-content);
          justify-content: start;
          gap: 5px;
          width: 100%;
          max-width: 100%;
          border-radius: 10px;
          border: 1px solid rgba(226, 232, 240, 0.76);
          background: rgba(255, 255, 255, 0.72);
          padding: 3px;
          overflow: hidden;
          box-sizing: border-box;
        }

        .t2t-resource-tab {
          min-height: 38px;
          border-radius: 8px;
          border: 1px solid transparent;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .t2t-resource-tab-mobile-label {
          display: none;
        }

        .t2t-resource-form-card {
          display: grid;
          gap: 12px;
          border-radius: 12px;
          border: 1px solid rgba(226, 232, 240, 0.72);
          background: rgba(255, 255, 255, 0.78);
          padding: 14px;
          box-shadow: none;
          min-width: 0;
          box-sizing: border-box;
        }

        .t2t-resource-form-header {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-width: 0;
        }

        .t2t-resource-form-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: rgba(239, 246, 255, 0.82);
          border: 1px solid rgba(191, 219, 254, 0.68);
          color: #2563eb;
          flex-shrink: 0;
        }

        .t2t-resource-form-header h3 {
          margin: 0;
          color: #0f172a;
          font-size: 16px;
          font-weight: 850;
          letter-spacing: 0;
        }

        .t2t-resource-form-header p {
          margin: 3px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
          font-weight: 650;
        }

        .t2t-resource-field {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .t2t-resource-field span {
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .t2t-resource-field input,
        .t2t-resource-field select,
        .t2t-resource-field textarea {
          width: 100%;
          min-width: 0;
          border-radius: 10px;
          border: 1px solid rgba(203, 213, 225, 0.76);
          background: #ffffff;
          color: #0f172a;
          font-size: 13px;
          font-weight: 650;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.16s ease, box-shadow 0.16s ease;
        }

        .t2t-resource-field input:focus,
        .t2t-resource-field select:focus,
        .t2t-resource-field textarea:focus {
          border-color: rgba(37, 99, 235, 0.42);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.07);
        }

        .t2t-resource-field input,
        .t2t-resource-field select {
          min-height: 43px;
          padding: 0 12px;
        }

        .t2t-resource-field textarea {
          min-height: 96px;
          padding: 10px 12px;
          line-height: 1.5;
          resize: vertical;
        }

        .t2t-resource-primary {
          width: 100%;
          min-height: 44px;
          border-radius: 10px;
          border: 1px solid #2563eb;
          background: #2563eb;
          color: #ffffff;
          font-size: 13px;
          font-weight: 850;
          padding: 0 15px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.14);
        }

        .t2t-resource-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .t2t-resource-upload {
          display: grid;
          justify-items: center;
          gap: 7px;
          border-radius: 12px;
          border: 1px dashed rgba(147, 197, 253, 0.86);
          background: rgba(248, 250, 252, 0.82);
          padding: 18px 12px;
          text-align: center;
          min-width: 0;
          box-sizing: border-box;
        }

        .t2t-resource-upload-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: rgba(239, 246, 255, 0.84);
          border: 1px solid rgba(191, 219, 254, 0.72);
          color: #2563eb;
          font-size: 15px;
          font-weight: 850;
        }

        .t2t-resource-upload strong {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #0f172a;
          font-size: 13px;
          font-weight: 950;
        }

        .t2t-resource-upload p {
          margin: 0;
          color: #64748b;
          font-size: 11px;
          line-height: 1.45;
          font-weight: 650;
        }

        .t2t-resource-upload button {
          min-height: 38px;
          border-radius: 9px;
          border: 1px solid rgba(191, 219, 254, 0.76);
          background: #ffffff;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 800;
          padding: 0 13px;
          cursor: pointer;
        }

        .t2t-resource-saved-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          min-width: 0;
        }

        .t2t-resource-saved-header h3 {
          margin: 0;
          color: #0f172a;
          font-size: 15px;
          font-weight: 850;
          letter-spacing: 0;
        }

        .t2t-resource-saved-header p {
          margin: 2px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.45;
          font-weight: 650;
        }

        .t2t-resource-saved-header button {
          min-height: 34px;
          border-radius: 9px;
          border: 1px solid rgba(203, 213, 225, 0.72);
          background: #ffffff;
          color: #475569;
          font-size: 11px;
          font-weight: 800;
          padding: 0 10px;
          white-space: nowrap;
          cursor: pointer;
        }

        .t2t-resource-saved-header button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .t2t-resource-empty {
          border-radius: 10px;
          border: 1px solid rgba(226, 232, 240, 0.68);
          background: rgba(255, 255, 255, 0.66);
          padding: 26px 16px;
          display: grid;
          justify-items: center;
          gap: 7px;
          text-align: center;
        }

        .t2t-resource-empty-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: rgba(239, 246, 255, 0.8);
          border: 1px solid rgba(191, 219, 254, 0.68);
          color: #2563eb;
          font-size: 17px;
        }

        .t2t-resource-empty h3 {
          margin: 0;
          color: #0f172a;
          font-size: 14px;
          font-weight: 850;
        }

        .t2t-resource-empty p {
          margin: 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.55;
          font-weight: 650;
          max-width: 310px;
        }

        .t2t-resource-list {
          display: grid;
          gap: 0;
          min-width: 0;
        }

        .t2t-resource-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: start;
          border-radius: 0;
          border: none;
          border-bottom: 1px solid rgba(226, 232, 240, 0.38);
          background: transparent;
          padding: 9px 2px;
          min-width: 0;
          box-sizing: border-box;
          transition: background 0.16s ease;
        }

        .t2t-resource-row:hover {
          background: rgba(248, 250, 252, 0.56);
        }

        .t2t-resource-row-icon {
          display: none;
        }

        .t2t-resource-row-main {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .t2t-resource-row-top {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          min-width: 0;
        }

        .t2t-resource-row-title {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #0f172a;
          font-size: 13px;
          font-weight: 780;
        }

        .t2t-resource-type {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 0;
          border: none;
          background: transparent;
          color: #526277;
          padding: 0;
          font-size: 9.5px;
          font-weight: 800;
          line-height: 1.25;
          text-transform: uppercase;
          letter-spacing: 0.075em;
          white-space: nowrap;
          transition: color 0.16s ease;
        }

        .t2t-resource-type::before {
          content: "";
          width: 4px;
          height: 4px;
          border-radius: 999px;
          background: rgba(59, 130, 246, 0.72);
          flex-shrink: 0;
        }

        .t2t-resource-row:hover .t2t-resource-type {
          color: #1d4ed8;
        }

        .t2t-resource-url {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #2563eb;
          font-size: 12px;
          font-weight: 680;
          text-decoration: none;
        }

        .t2t-resource-meta {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #64748b;
          font-size: 12px;
          font-weight: 650;
        }

        .t2t-resource-notes {
          color: #475569;
          font-size: 12px;
          line-height: 1.45;
          font-weight: 650;
          word-break: break-word;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .t2t-resource-file-error {
          color: #b91c1c;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.4;
        }

        .t2t-resource-row-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          flex-wrap: wrap;
        }

        .t2t-resource-open,
        .t2t-resource-delete {
          min-height: 28px;
          display: inline-flex;
          align-items: center;
          border-radius: 7px;
          padding: 0 7px;
          font-size: 11px;
          font-weight: 750;
          text-decoration: none;
          cursor: pointer;
          transition:
            color 0.16s ease,
            background 0.16s ease,
            border-color 0.16s ease;
        }

        .t2t-resource-open {
          border: 1px solid transparent;
          background: transparent;
          color: #1d4ed8;
        }

        .t2t-resource-delete {
          border: 1px solid transparent;
          background: transparent;
          color: #b91c1c;
        }

        .t2t-resource-open:hover {
          border-color: rgba(191, 219, 254, 0.58);
          background: rgba(239, 246, 255, 0.72);
        }

        .t2t-resource-delete:hover {
          border-color: rgba(254, 202, 202, 0.76);
          background: rgba(254, 242, 242, 0.82);
          color: #991b1b;
        }

        .t2t-resource-open:disabled,
        .t2t-resource-delete:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .t2t-resource-delete-confirm-overlay {
          position: fixed;
          inset: 0;
          z-index: 10030;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(15, 23, 42, 0.46);
          backdrop-filter: blur(5px);
          box-sizing: border-box;
        }

        .t2t-resource-delete-confirm {
          width: min(430px, calc(100vw - 36px));
          border-radius: 20px;
          border: 1px solid rgba(254, 202, 202, 0.82);
          background: #ffffff;
          box-shadow: 0 24px 64px rgba(15, 23, 42, 0.2);
          padding: 20px;
          display: grid;
          gap: 16px;
          box-sizing: border-box;
        }

        .t2t-resource-delete-confirm-icon {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(248, 113, 113, 0.28);
          background: rgba(254, 242, 242, 0.92);
          color: #dc2626;
          font-size: 19px;
          font-weight: 950;
        }

        .t2t-resource-delete-confirm h3 {
          margin: 0;
          color: #0f172a;
          font-size: 20px;
          line-height: 1.15;
          font-weight: 900;
        }

        .t2t-resource-delete-confirm p {
          margin: 6px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.55;
          font-weight: 650;
        }

        .t2t-resource-delete-confirm-error {
          border-radius: 10px;
          border: 1px solid rgba(254, 202, 202, 0.78);
          background: rgba(254, 242, 242, 0.82);
          color: #b91c1c;
          padding: 10px 11px;
          font-size: 12px;
          line-height: 1.45;
          font-weight: 750;
        }

        .t2t-resource-delete-confirm-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
        }

        .t2t-resource-delete-confirm-cancel,
        .t2t-resource-delete-confirm-submit {
          min-height: 40px;
          border-radius: 10px;
          padding: 0 14px;
          font-size: 12px;
          font-weight: 850;
          cursor: pointer;
        }

        .t2t-resource-delete-confirm-cancel {
          border: 1px solid rgba(203, 213, 225, 0.82);
          background: #ffffff;
          color: #475569;
        }

        .t2t-resource-delete-confirm-submit {
          border: 1px solid rgba(220, 38, 38, 0.9);
          background: #dc2626;
          color: #ffffff;
          box-shadow: 0 8px 18px rgba(220, 38, 38, 0.16);
        }

        .t2t-resource-delete-confirm-cancel:disabled,
        .t2t-resource-delete-confirm-submit:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        @media (max-width: 760px) {
          .t2t-resource-overlay {
            padding: 0;
            align-items: stretch;
            justify-content: stretch;
            background: rgba(248, 250, 252, 1);
            backdrop-filter: none;
          }

          .t2t-resource-modal {
            width: 100vw;
            height: 100dvh;
            max-height: 100dvh;
            border-radius: 0;
            border: none;
            box-shadow: none;
            background: #f8fafc;
          }

          .t2t-resource-header {
            position: sticky;
            top: 0;
            z-index: 3;
            padding: 12px 14px;
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(8px);
          }

          .t2t-resource-header-main {
            gap: 10px;
          }

          .t2t-resource-icon {
            width: 38px;
            height: 38px;
            border-radius: 15px;
          }

          .t2t-resource-eyebrow {
            font-size: 9px;
          }

          .t2t-resource-header h2 {
            font-size: 20px;
            line-height: 1.05;
            letter-spacing: -0.045em;
          }

          .t2t-resource-header p {
            margin-top: 5px;
            font-size: 11.5px;
            line-height: 1.45;
            max-width: 270px;
          }

          .t2t-resource-close {
            width: 35px;
            height: 35px;
            border-radius: 13px;
          }

          .t2t-resource-body {
            padding: 10px 12px 24px;
          }

          .t2t-resource-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
            margin-bottom: 10px;
          }

          .t2t-resource-stat {
            min-height: 38px;
            border-radius: 14px;
            padding: 7px 10px;
            font-size: 11.5px;
          }

          .t2t-resource-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 12px;
          }

          .t2t-resource-tabs {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            border-radius: 10px;
            position: relative;
            top: auto;
            z-index: 0;
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(10px);
          }

          .t2t-resource-tab {
            min-height: 40px;
            padding: 0 6px;
            gap: 5px;
            font-size: 12px;
          }

          .t2t-resource-tab-desktop-label {
            display: none;
          }

          .t2t-resource-tab-mobile-label {
            display: inline;
          }

          .t2t-resource-form-card,
          .t2t-resource-right {
            border-radius: 12px;
            padding: 13px;
          }

          .t2t-resource-form-card {
            box-shadow: none;
          }

          .t2t-resource-form-header h3 {
            font-size: 15px;
          }

          .t2t-resource-form-header p {
            font-size: 12px;
          }

          .t2t-resource-field input,
          .t2t-resource-field select {
            min-height: 42px;
          }

          .t2t-resource-field textarea {
            min-height: 112px;
          }

          .t2t-resource-upload {
            padding: 16px 10px;
          }

          .t2t-resource-primary {
            min-height: 44px;
          }

          .t2t-resource-saved-header {
            align-items: center;
          }

          .t2t-resource-saved-header h3 {
            font-size: 14px;
          }

          .t2t-resource-saved-header p {
            font-size: 11.5px;
            max-width: 210px;
          }

          .t2t-resource-row {
            grid-template-columns: minmax(0, 1fr);
            border-radius: 0;
          }

          .t2t-resource-row-actions {
            grid-column: 1;
            justify-content: flex-start;
            margin-top: 6px;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
}

function ResourceRow({
  resource,
  isDeleting,
  onDelete,
  onEditNote,
}: {
  resource: TaskResource;
  isDeleting: boolean;
  onDelete: () => void;
  onEditNote: () => void;
}) {
  const [isOpeningFile, setIsOpeningFile] = useState(false);
  const [isDownloadingFile, setIsDownloadingFile] = useState(false);
  const [fileActionError, setFileActionError] = useState("");

  const isLink = isLinkResource(resource);
  const isFile = isFileResource(resource);
  const isNote = isNoteResource(resource);

  const displayTitle =
    resource.title ||
    resource.file_name ||
    resource.url ||
    getResourceTypeLabel(resource.resource_type);
  const cleanFileName = resource.file_name?.trim() || "";
  const titleMatchesFileName =
    Boolean(cleanFileName) &&
    displayTitle.trim().toLocaleLowerCase() === cleanFileName.toLocaleLowerCase();
  const fileMeta = [
    cleanFileName && !titleMatchesFileName ? cleanFileName : "",
    resource.size_bytes ? formatResourceFileSize(resource.size_bytes) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  async function handleOpenFile() {
    if (!isFile || isOpeningFile) return;

    try {
      setIsOpeningFile(true);
      setFileActionError("");

      const fileUrl = await getTaskResourceFileUrl(resource.id, {
        download: false,
      });

      window.open(fileUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      setFileActionError(error?.message || "Failed to open file.");
    } finally {
      setIsOpeningFile(false);
    }
  }

  async function handleDownloadFile() {
    if (!isFile || isDownloadingFile) return;

    try {
      setIsDownloadingFile(true);
      setFileActionError("");

      const fileUrl = await getTaskResourceFileUrl(resource.id, {
        download: true,
      });

      window.open(fileUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      setFileActionError(error?.message || "Failed to download file.");
    } finally {
      setIsDownloadingFile(false);
    }
  }

  return (
    <div className="t2t-resource-row">
      <div className="t2t-resource-row-icon">
        {getResourceIcon(resource.resource_type)}
      </div>

      <div className="t2t-resource-row-main">
        <div className="t2t-resource-row-top">
          <span className="t2t-resource-type">
            {getResourceTypeLabel(resource.resource_type)}
          </span>

          <div className="t2t-resource-row-title">{displayTitle}</div>
        </div>

        {resource.url ? (
          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="t2t-resource-url"
          >
            {resource.url}
          </a>
        ) : null}

        {isFile && fileMeta ? (
          <div className="t2t-resource-meta">{fileMeta}</div>
        ) : null}

        {resource.notes ? (
          <div className="t2t-resource-notes">{resource.notes}</div>
        ) : null}

        {fileActionError ? (
          <div className="t2t-resource-file-error">{fileActionError}</div>
        ) : null}
      </div>

      <div className="t2t-resource-row-actions">
        {isLink && resource.url ? (
          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="t2t-resource-open"
          >
            Open
          </a>
        ) : null}

        {isFile ? (
          <>
            <button
              type="button"
              onClick={handleOpenFile}
              disabled={isOpeningFile}
              className="t2t-resource-open"
            >
              {isOpeningFile ? "Opening..." : "Open file"}
            </button>

            <button
              type="button"
              onClick={handleDownloadFile}
              disabled={isDownloadingFile}
              className="t2t-resource-open"
            >
              {isDownloadingFile ? "Downloading..." : "Download"}
            </button>
          </>
        ) : null}

        {isNote ? (
          <button
            type="button"
            onClick={onEditNote}
            className="t2t-resource-open"
          >
            View / Edit
          </button>
        ) : null}

        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="t2t-resource-delete"
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  desktopLabel,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  desktopLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="t2t-resource-tab"
      style={{
        color: active ? "#1d4ed8" : "#64748b",
        background: active ? "rgba(239,246,255,0.92)" : "transparent",
        borderColor: active ? "rgba(191,219,254,0.72)" : "transparent",
        boxShadow: "none",
      }}
    >
      <span>{icon}</span>
      <span className="t2t-resource-tab-desktop-label">{desktopLabel}</span>
      <span className="t2t-resource-tab-mobile-label">{label}</span>
    </button>
  );
}

function FormHeader({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="t2t-resource-form-header">
      <div className="t2t-resource-form-icon">{icon}</div>

      <div style={{ minWidth: 0 }}>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="t2t-resource-empty">
      <div className="t2t-resource-empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "purple" | "slate";
}) {
  const palette: Record<
    "blue" | "green" | "purple" | "slate",
    CSSProperties
  > = {
    blue: {
      background: "rgba(255,255,255,0.78)",
      borderColor: "rgba(191,219,254,0.68)",
      color: "#1d4ed8",
    },
    green: {
      background: "rgba(255,255,255,0.78)",
      borderColor: "rgba(226,232,240,0.68)",
      color: "#475569",
    },
    purple: {
      background: "rgba(255,255,255,0.78)",
      borderColor: "rgba(226,232,240,0.68)",
      color: "#475569",
    },
    slate: {
      background: "rgba(255,255,255,0.78)",
      borderColor: "rgba(226,232,240,0.68)",
      color: "#475569",
    },
  };

  return (
    <div className="t2t-resource-stat" style={palette[tone]}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
