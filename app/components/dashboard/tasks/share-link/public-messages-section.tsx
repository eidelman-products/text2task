"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "../../ui/tokens";
import {
  usePublicShareMessages,
  type PublicShareMessage,
} from "./use-public-share-messages";

/*
  Phase 5D -- the public Client Communication History + send form,
  rendered as a sibling section after ClientProjectView (never inside
  it -- that component is deliberately purely presentational/data-free
  and reused unchanged by the owner's own authenticated Preview modal,
  which must never gain a live public-message fetch). Rendered ONLY when
  `commentsEnabled` is true; renders nothing at all otherwise, and the
  underlying hook performs no fetch in that case either.

  Public message projection fields are exactly
  {authorType, authorDisplayName, body, createdAt} -- no id of any kind
  exists to render, thread through a key, or place in a data attribute.
*/

const BODY_MAX_CODEPOINTS = 4000;
const NAME_MAX_CODEPOINTS = 80;

function countCodepoints(value: string): number {
  return [...value].length;
}

export type PublicMessagesSectionProps = {
  publicId: string;
  commentsEnabled: boolean;
  contentDirection: "auto" | "ltr" | "rtl";
};

export function PublicMessagesSection({
  publicId,
  commentsEnabled,
  contentDirection,
}: PublicMessagesSectionProps) {
  const { history, send, submit } = usePublicShareMessages(publicId, commentsEnabled);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  if (!commentsEnabled) {
    return null;
  }

  const sending = send.status === "pending";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (sending) return;

    setJustSent(false);

    const trimmedBody = body.trim();
    const trimmedName = name.trim();

    if (countCodepoints(trimmedBody) < 1) {
      setValidationError("Enter a message.");
      return;
    }
    if (countCodepoints(body) > BODY_MAX_CODEPOINTS) {
      setValidationError("Message must be 4,000 characters or fewer.");
      return;
    }
    if (countCodepoints(trimmedName) > NAME_MAX_CODEPOINTS) {
      setValidationError("Name must be 80 characters or fewer.");
      return;
    }

    setValidationError(null);

    const result = await submit(
      trimmedName.length > 0 ? { body, authorDisplayName: trimmedName } : { body }
    );

    if (result.ok) {
      setBody("");
      // Name is intentionally preserved for convenience during the
      // current page session -- only the message body is cleared.
      setJustSent(true);
    }
  }

  return (
    <section dir={contentDirection} style={sectionStyle} aria-label="Messages">
      <span style={sectionLabelStyle}>Messages</span>

      <MessageHistory history={history} />

      <form onSubmit={handleSubmit} style={formStyle}>
        <div style={fieldStyle}>
          <label htmlFor="public-message-name" style={labelStyle}>
            Your name (optional)
          </label>
          <input
            id="public-message-name"
            type="text"
            dir="auto"
            value={name}
            maxLength={400}
            onChange={(event) => setName(event.target.value)}
            disabled={sending}
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="public-message-body" style={labelStyle}>
            Message
          </label>
          <textarea
            id="public-message-body"
            dir="auto"
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              setJustSent(false);
            }}
            disabled={sending}
            rows={4}
            style={textareaStyle}
          />
        </div>

        {validationError ? (
          <p role="alert" style={errorTextStyle}>
            {validationError}
          </p>
        ) : send.status === "error" ? (
          <p role="alert" style={errorTextStyle}>
            {send.error}
          </p>
        ) : justSent ? (
          <p role="status" style={successTextStyle}>
            Message sent.
          </p>
        ) : null}

        <button type="submit" disabled={sending} style={submitButtonStyle}>
          {sending ? "Sending…" : "Send message"}
        </button>
      </form>
    </section>
  );
}

function MessageHistory({
  history,
}: {
  history: ReturnType<typeof usePublicShareMessages>["history"];
}) {
  if (history.status === "loading" || history.status === "idle") {
    return (
      <p role="status" style={mutedTextStyle}>
        Loading messages…
      </p>
    );
  }

  if (history.status === "error") {
    return (
      <p role="alert" style={mutedTextStyle}>
        {history.error}
      </p>
    );
  }

  if (history.messages.length === 0) {
    return <p style={mutedTextStyle}>No messages yet.</p>;
  }

  return (
    <ul style={messageListStyle} aria-label="Message history">
      {history.messages.map((message, index) => (
        <li key={index} style={messageItemStyle}>
          <MessageBubble message={message} />
        </li>
      ))}
    </ul>
  );
}

function MessageBubble({ message }: { message: PublicShareMessage }) {
  const authorLabel =
    message.authorType === "client"
      ? message.authorDisplayName?.trim() || "Client"
      : "Project team";

  return (
    <div style={messageBubbleStyle}>
      <div style={messageMetaStyle}>
        <span style={messageAuthorStyle}>{authorLabel}</span>
        <time style={messageTimeStyle} dateTime={message.createdAt}>
          {formatMessageTime(message.createdAt)}
        </time>
      </div>
      <p dir="auto" style={messageBodyStyle}>
        {message.body}
      </p>
    </div>
  );
}

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const sectionStyle: CSSProperties = {
  background: dashboardColors.background.surface,
  border: `1px solid ${dashboardColors.border.subtle}`,
  borderRadius: dashboardRadii.xl,
  padding: dashboardSpacing[5],
  display: "grid",
  gap: dashboardSpacing[3],
  maxWidth: 560,
  margin: "0 auto",
};

const sectionLabelStyle: CSSProperties = {
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: dashboardColors.text.muted,
};

const mutedTextStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.text.muted,
};

const messageListStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: dashboardSpacing[2],
};

const messageItemStyle: CSSProperties = {
  minWidth: 0,
};

const messageBubbleStyle: CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[1],
  padding: dashboardSpacing[3],
  borderRadius: dashboardRadii.lg,
  background: dashboardColors.background.surfaceMuted,
  minWidth: 0,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const messageMetaStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: dashboardSpacing[2],
  flexWrap: "wrap",
};

const messageAuthorStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.semibold,
  color: dashboardColors.text.primary,
};

const messageTimeStyle: CSSProperties = {
  fontSize: dashboardTypography.size.xs,
  color: dashboardColors.text.muted,
  whiteSpace: "nowrap",
};

const messageBodyStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.md,
  color: dashboardColors.text.secondary,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const formStyle: CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[3],
  paddingTop: dashboardSpacing[2],
  borderTop: `1px solid ${dashboardColors.border.subtle}`,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[1],
};

const labelStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.medium,
  color: dashboardColors.text.secondary,
};

const inputStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: dashboardRadii.lg,
  border: `1px solid ${dashboardColors.border.subtle}`,
  fontSize: dashboardTypography.size.md,
  fontFamily: dashboardTypography.fontFamily,
};

const textareaStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: dashboardRadii.lg,
  border: `1px solid ${dashboardColors.border.subtle}`,
  fontSize: dashboardTypography.size.md,
  fontFamily: dashboardTypography.fontFamily,
  resize: "vertical",
  minHeight: 88,
};

const errorTextStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.status.red,
};

const successTextStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.status.green,
};

const submitButtonStyle: CSSProperties = {
  justifySelf: "start",
  padding: "10px 18px",
  borderRadius: dashboardRadii.lg,
  border: "none",
  background: dashboardColors.primary[600],
  color: dashboardColors.text.inverse,
  fontWeight: dashboardTypography.weight.semibold,
  fontSize: dashboardTypography.size.md,
  cursor: "pointer",
};
