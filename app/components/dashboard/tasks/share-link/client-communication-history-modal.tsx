"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

import { DashboardButton } from "../../ui/button";
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "../../ui/tokens";
import type { OwnerShareMessage, OwnerShareMessageStatus } from "@/lib/share/share-contracts";
import { useOwnerShareMessages } from "./use-owner-share-messages";

/*
  Phase 5D -- the owner's Client Communication History surface. Mirrors
  the UX shape of project-update-history-modal.tsx (header + toolbar +
  chronological list, loading/empty/error states) but shares NONE of its
  data, types, or styles -- this reads only share_messages via
  useOwnerShareMessages/GET /api/share-links/[id]/messages, never
  project_timeline_events or Project Update history. Deliberately not a
  standalone ResponsiveDialog: it is rendered as swapped-in CONTENT
  inside ShareLinkPanel's own already-open ResponsiveDialog (see that
  file's `view === "messages"` branch), the exact same pattern
  ShareLinkPanel already uses for its "Client preview" view -- this
  avoids ever having two independent top-level dialogs (each with its
  own Escape/focus-trap handling) open at once.

  Opening this view never mutates anything -- only the explicit "Mark
  reviewed"/"Resolve"/"Dismiss"/"Send reply" actions below do.
*/

const STATUS_LABELS: Record<OwnerShareMessageStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  resolved: "Resolved",
  dismissed: "Dismissed",
  // 'converted' is read-only, Phase 6-exclusive vocabulary -- never
  // reachable through any action in this component, but the type this
  // label map covers includes it since a read CAN observe it once
  // Phase 6 exists. No action ever sets it.
  converted: "Converted",
};

export type ClientCommunicationHistoryModalProps = {
  shareLinkId: string;
  onClose: () => void;
  /** PHASE 5F -- true when `shareLinkId` is a historical (no longer
   * active/manageable) link resolved as a fallback, not the project's
   * current share link. Shows a subtle note so the owner cannot infer
   * the underlying link still works -- see share-link-panel.tsx's own
   * `isHistoricalMessagesLink` for how this is determined. */
  isHistorical?: boolean;
  /** PHASE 5F -- false suppresses the Reply affordance entirely.
   * `send_share_message_reply` has no link-state check of its own (only
   * ownership), so a reply on a revoked link would be silently accepted
   * by the RPC yet could never reach the client (public access is
   * already denied for a revoked link) -- an owner action that LOOKS
   * successful but is actually meaningless. Defaults to `true`
   * (unchanged behavior) for every caller that does not pass it. */
  canReply?: boolean;
  /** PHASE 6B -- explicit, owner-initiated "Analyze as client update"
   * action for one eligible client-authored message. Unlike `canReply`,
   * this is NOT gated by link state: conversion eligibility depends only
   * on the message/project relationship (loadShareMessageForConversion),
   * never on whether the originating link is still active -- a revoked
   * link's retained history remains fully convertible. The actual
   * analyze-or-resume call and the hand-off into the existing Client
   * Update review experience both live in this prop's implementation,
   * one level up (share-link-panel.tsx's own caller) -- this component
   * only tracks its own per-message busy/error state around the call. */
  onAnalyzeMessage: (messageId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

export function ClientCommunicationHistoryModal({
  shareLinkId,
  onClose,
  isHistorical = false,
  canReply = true,
  onAnalyzeMessage,
}: ClientCommunicationHistoryModalProps) {
  const { state, mutation, refetch, reply, updateStatus } = useOwnerShareMessages(
    shareLinkId,
    true
  );
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [analyzingMessageId, setAnalyzingMessageId] = useState<string | null>(null);
  const [analyzeErrorByMessageId, setAnalyzeErrorByMessageId] = useState<Record<string, string>>({});

  const busy = mutation.status === "pending";
  const messages = state.status === "loaded" ? state.messages : [];
  const unreadCount = state.status === "loaded" ? state.unreadCount : null;

  async function handleAnalyzeMessage(messageId: string) {
    if (busy || analyzingMessageId) return;

    setAnalyzingMessageId(messageId);
    setAnalyzeErrorByMessageId((prev) => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });

    const result = await onAnalyzeMessage(messageId);

    setAnalyzingMessageId(null);
    if (!result.ok) {
      setAnalyzeErrorByMessageId((prev) => ({ ...prev, [messageId]: result.error }));
    }
  }

  function startReply(messageId: string) {
    if (busy || !canReply) return;
    setReplyingToId(messageId);
    setReplyBody("");
    setReplyError(null);
  }

  function cancelReply() {
    if (busy) return;
    setReplyingToId(null);
    setReplyBody("");
    setReplyError(null);
  }

  async function handleReplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !replyingToId || !canReply) return;

    if (replyBody.trim().length === 0) {
      setReplyError("Enter a reply.");
      return;
    }

    setReplyError(null);
    const ok = await reply(replyingToId, replyBody);
    if (ok) {
      setReplyingToId(null);
      setReplyBody("");
    }
  }

  async function handleStatusChange(messageId: string, status: OwnerShareMessageStatus) {
    if (busy) return;
    if (status === "converted") return;
    await updateStatus(messageId, status);
  }

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={headerTextStyle}>
          <h3 style={titleStyle}>Client messages</h3>
          <p style={subtitleStyle}>Chronological conversation between you and your client.</p>
        </div>
        <DashboardButton variant="ghost" size="sm" onClick={onClose}>
          Back
        </DashboardButton>
      </header>

      {isHistorical ? (
        <p style={historicalNoticeStyle}>
          This share link has been revoked. Clients can no longer send or receive messages
          here, but the history below is preserved.
        </p>
      ) : null}

      <div style={toolbarStyle}>
        <span style={countTextStyle}>
          {state.status === "loading"
            ? "Loading client messages..."
            : unreadCount !== null
              ? `${unreadCount} unread`
              : ""}
        </span>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={state.status === "loading"}
          style={refreshButtonStyle}
        >
          Refresh
        </button>
      </div>

      {state.status === "loading" || state.status === "idle" ? (
        <StatePanel text="Loading client messages..." />
      ) : state.status === "error" ? (
        <StatePanel text={state.error} />
      ) : messages.length === 0 ? (
        <StatePanel text="No client messages yet." />
      ) : (
        <ul style={listStyle} aria-label="Client message history">
          {messages.map((message) => (
            <li key={message.id} style={itemStyle}>
              <MessageCard
                message={message}
                busy={busy}
                canReply={canReply}
                isReplying={replyingToId === message.id}
                replyBody={replyBody}
                replyError={replyError}
                onStartReply={() => startReply(message.id)}
                onCancelReply={cancelReply}
                onReplyBodyChange={setReplyBody}
                onSubmitReply={handleReplySubmit}
                onStatusChange={(status) => handleStatusChange(message.id, status)}
                isAnalyzing={analyzingMessageId === message.id}
                analyzeError={analyzeErrorByMessageId[message.id] ?? null}
                onAnalyzeMessage={() => void handleAnalyzeMessage(message.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {mutation.status === "error" ? (
        <p role="alert" style={mutationErrorStyle}>
          {mutation.error}
        </p>
      ) : null}
    </div>
  );
}

function MessageCard({
  message,
  busy,
  canReply,
  isReplying,
  replyBody,
  replyError,
  onStartReply,
  onCancelReply,
  onReplyBodyChange,
  onSubmitReply,
  onStatusChange,
  isAnalyzing,
  analyzeError,
  onAnalyzeMessage,
}: {
  message: OwnerShareMessage;
  busy: boolean;
  canReply: boolean;
  isReplying: boolean;
  replyBody: string;
  replyError: string | null;
  onStartReply: () => void;
  onCancelReply: () => void;
  onReplyBodyChange: (value: string) => void;
  onSubmitReply: (event: FormEvent<HTMLFormElement>) => void;
  onStatusChange: (status: OwnerShareMessageStatus) => void;
  isAnalyzing: boolean;
  analyzeError: string | null;
  onAnalyzeMessage: () => void;
}) {
  const isClient = message.authorType === "client";
  const authorLabel = isClient ? message.authorDisplayName?.trim() || "Client" : "You";
  // PHASE 6B -- owner-authored replies are never convertible (locked
  // product decision, already independently enforced at the database
  // layer by enforce_share_message_conversion_integrity); an
  // already-converted message is also never re-offered the action.
  // Reviewed/resolved/dismissed client messages remain eligible, and
  // link state (active/disabled/expired/revoked) does not affect
  // eligibility for retained history -- see this component's own
  // onAnalyzeMessage prop doc comment.
  const canAnalyzeAsClientUpdate = isClient && message.status !== "converted";
  // PHASE 6C -- once a message is converted, its owner review lifecycle
  // (Mark reviewed/Resolve/Dismiss) is terminal: set_share_message_status
  // itself now rejects every one of these with SHARE_MESSAGE_STATUS_TERMINAL,
  // so hiding them here is UX convenience, not the enforcement point.
  // Locked product decision (Phase 6 Accepted Plan / Phase 6C plan section
  // 11): Reply is deliberately NOT gated on converted -- "converted" is
  // terminal for the processing/status lifecycle only, not a statement
  // that communication with the client must stop.
  const isConverted = message.status === "converted";
  const canChangeLifecycleStatus = isClient && !isConverted;

  return (
    <article style={{ ...cardStyle, ...(isClient ? clientCardAccentStyle : ownerCardAccentStyle) }}>
      <div style={cardMetaStyle}>
        <span style={cardAuthorStyle}>{authorLabel}</span>
        <time style={cardTimeStyle} dateTime={message.createdAt}>
          {formatDateTime(message.createdAt)}
        </time>
      </div>

      <p dir="auto" style={cardBodyStyle}>
        {message.body}
      </p>

      {isClient ? (
        <div style={cardFooterStyle}>
          <span style={statusBadgeStyle}>{STATUS_LABELS[message.status]}</span>
          <div style={actionsRowStyle}>
            {canChangeLifecycleStatus ? (
              <>
                <button
                  type="button"
                  onClick={() => onStatusChange("reviewed")}
                  disabled={busy}
                  style={actionButtonStyle}
                >
                  Mark reviewed
                </button>
                <button
                  type="button"
                  onClick={() => onStatusChange("resolved")}
                  disabled={busy}
                  style={actionButtonStyle}
                >
                  Resolve
                </button>
                <button
                  type="button"
                  onClick={() => onStatusChange("dismissed")}
                  disabled={busy}
                  style={actionButtonStyle}
                >
                  Dismiss
                </button>
              </>
            ) : null}
            {!isReplying && canReply ? (
              <button type="button" onClick={onStartReply} disabled={busy} style={replyLinkStyle}>
                Reply
              </button>
            ) : null}
            {canAnalyzeAsClientUpdate ? (
              <button
                type="button"
                onClick={onAnalyzeMessage}
                disabled={busy || isAnalyzing}
                style={actionButtonStyle}
              >
                {isAnalyzing ? "Analyzing…" : "Analyze as client update"}
              </button>
            ) : null}
          </div>
          {analyzeError ? (
            <p role="alert" style={replyErrorStyle}>
              {analyzeError}
            </p>
          ) : null}
        </div>
      ) : null}

      {isClient && isReplying && canReply ? (
        <form onSubmit={onSubmitReply} style={replyFormStyle}>
          <label htmlFor={`reply-${message.id}`} style={replyLabelStyle}>
            Reply
          </label>
          <textarea
            id={`reply-${message.id}`}
            dir="auto"
            value={replyBody}
            onChange={(event) => onReplyBodyChange(event.target.value)}
            disabled={busy}
            rows={3}
            style={replyTextareaStyle}
          />
          {replyError ? (
            <p role="alert" style={replyErrorStyle}>
              {replyError}
            </p>
          ) : null}
          <div style={replyActionsStyle}>
            <button type="submit" disabled={busy} style={submitReplyButtonStyle}>
              {busy ? "Sending…" : "Submit reply"}
            </button>
            <button type="button" onClick={onCancelReply} disabled={busy} style={cancelReplyButtonStyle}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

function StatePanel({ text }: { text: string }) {
  return (
    <div style={statePanelStyle}>
      <p style={statePanelTextStyle}>{text}</p>
    </div>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const containerStyle: CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[4],
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: dashboardSpacing[3],
};

const headerTextStyle: CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[1],
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.lg,
  fontWeight: dashboardTypography.weight.semibold,
  color: dashboardColors.text.primary,
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.text.muted,
};

const historicalNoticeStyle: CSSProperties = {
  margin: 0,
  padding: `${dashboardSpacing[2]}px ${dashboardSpacing[3]}px`,
  borderRadius: dashboardRadii.md,
  background: dashboardColors.status.amberSoft,
  color: dashboardColors.status.amber,
  fontSize: dashboardTypography.size.sm,
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: dashboardSpacing[2],
};

const countTextStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.text.secondary,
  fontWeight: dashboardTypography.weight.medium,
};

const refreshButtonStyle: CSSProperties = {
  padding: "4px 10px",
  borderRadius: dashboardRadii.md,
  border: `1px solid ${dashboardColors.border.subtle}`,
  background: dashboardColors.background.surface,
  color: dashboardColors.text.secondary,
  fontSize: dashboardTypography.size.sm,
  cursor: "pointer",
};

const statePanelStyle: CSSProperties = {
  padding: dashboardSpacing[5],
  textAlign: "center",
};

const statePanelTextStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.md,
  color: dashboardColors.text.muted,
};

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: dashboardSpacing[3],
  maxHeight: "50vh",
  overflowY: "auto",
};

const itemStyle: CSSProperties = {
  minWidth: 0,
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[2],
  padding: dashboardSpacing[3],
  borderRadius: dashboardRadii.lg,
  background: dashboardColors.background.surfaceMuted,
  borderLeft: "3px solid transparent",
  minWidth: 0,
};

const clientCardAccentStyle: CSSProperties = {
  borderLeftColor: dashboardColors.primary[500],
};

const ownerCardAccentStyle: CSSProperties = {
  borderLeftColor: dashboardColors.border.subtle,
};

const cardMetaStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: dashboardSpacing[2],
  flexWrap: "wrap",
};

const cardAuthorStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.semibold,
  color: dashboardColors.text.primary,
};

const cardTimeStyle: CSSProperties = {
  fontSize: dashboardTypography.size.xs,
  color: dashboardColors.text.muted,
  whiteSpace: "nowrap",
};

const cardBodyStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.md,
  color: dashboardColors.text.secondary,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const cardFooterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: dashboardSpacing[2],
  flexWrap: "wrap",
};

const statusBadgeStyle: CSSProperties = {
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.semibold,
  color: dashboardColors.text.muted,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const actionsRowStyle: CSSProperties = {
  display: "flex",
  gap: dashboardSpacing[2],
  flexWrap: "wrap",
};

const actionButtonStyle: CSSProperties = {
  padding: "4px 8px",
  borderRadius: dashboardRadii.md,
  border: `1px solid ${dashboardColors.border.subtle}`,
  background: dashboardColors.background.surface,
  color: dashboardColors.text.secondary,
  fontSize: dashboardTypography.size.xs,
  cursor: "pointer",
};

const replyLinkStyle: CSSProperties = {
  padding: "4px 8px",
  borderRadius: dashboardRadii.md,
  border: "none",
  background: "transparent",
  color: dashboardColors.primary[700],
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.semibold,
  cursor: "pointer",
};

const replyFormStyle: CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[2],
  paddingTop: dashboardSpacing[2],
  borderTop: `1px solid ${dashboardColors.border.subtle}`,
};

const replyLabelStyle: CSSProperties = {
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.medium,
  color: dashboardColors.text.secondary,
};

const replyTextareaStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: dashboardRadii.lg,
  border: `1px solid ${dashboardColors.border.subtle}`,
  fontSize: dashboardTypography.size.md,
  fontFamily: dashboardTypography.fontFamily,
  resize: "vertical",
  minHeight: 64,
};

const replyErrorStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.status.red,
};

const replyActionsStyle: CSSProperties = {
  display: "flex",
  gap: dashboardSpacing[2],
};

const submitReplyButtonStyle: CSSProperties = {
  padding: "6px 14px",
  borderRadius: dashboardRadii.md,
  border: "none",
  background: dashboardColors.primary[600],
  color: dashboardColors.text.inverse,
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.semibold,
  cursor: "pointer",
};

const cancelReplyButtonStyle: CSSProperties = {
  padding: "6px 14px",
  borderRadius: dashboardRadii.md,
  border: `1px solid ${dashboardColors.border.subtle}`,
  background: "transparent",
  color: dashboardColors.text.secondary,
  fontSize: dashboardTypography.size.sm,
  cursor: "pointer",
};

const mutationErrorStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.status.red,
};
