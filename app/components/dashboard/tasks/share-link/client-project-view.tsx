import type { CSSProperties } from "react";

import type {
  ClientProjectProjection,
  ClientProjectStatus,
  ClientProjectTask,
} from "@/lib/share/client-share-projection-contracts";
import { dashboardColors, dashboardRadii, dashboardSpacing, dashboardTypography } from "../../ui/tokens";

/*
  Phase 2D -- the ONE reusable, purely presentational client-facing view.
  Reused unchanged by both the authenticated owner Preview (Phase 2D) and
  the future public /share route (Phase 3) -- this component receives
  ONLY the strict ClientProjectProjection contract. It has no knowledge
  of Project, ManagedShareLink, a project id, a user id, a share secret,
  raw Resources or raw subtasks, and no data-fetching of its own -- it
  cannot leak anything beyond what its caller already decided to hand it,
  because there is nothing else in scope to leak.

  Deliberately not SiteUpdate's construction-specific design, no
  financial cards, no dashboard chrome, no billing/account navigation.
*/

const STATUS_LABELS: Record<ClientProjectStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

// Objective B client-page redesign: In progress, then Waiting for client
// feedback (only rendered when at least one task actually has it -- the
// filter below already hides an empty group), then Completed, then
// Coming up -- matching the redesign's target hierarchy exactly. Groups
// with zero tasks are still skipped entirely (see the .filter below).
const TASK_GROUP_ORDER: ClientProjectTask["publicGroup"][] = [
  "in_progress",
  "waiting_for_feedback",
  "completed",
  "coming_up",
];

const TASK_GROUP_LABELS: Record<ClientProjectTask["publicGroup"], string> = {
  waiting_for_feedback: "Waiting for your feedback",
  in_progress: "In progress",
  coming_up: "Coming up",
  completed: "Completed",
};

export type ClientProjectViewProps = {
  projection: ClientProjectProjection;
  /**
   * PHASE 4C -- the current public share route's own publicId
   * (`/share/[publicId]`), needed only to construct the FILE-delivery
   * endpoint URL `/api/share/[publicId]/resources/[fileRef]`. Optional
   * and deliberately never defaulted/guessed: when absent (the owner's
   * own authenticated Preview modal, share-link-panel.tsx, which has no
   * public route of its own to derive this from and whose browser has
   * no Client Share session cookie to authorize that endpoint anyway),
   * FILE resources fall back to the original inert-label rendering
   * rather than presenting a link that would 401 for that specific
   * caller. Never a resourceId, shareLinkId, or any other internal
   * identifier -- this component still receives nothing beyond the
   * strict projection plus this one already-public route parameter.
   */
  publicId?: string;
};

/** Constructs the public file-delivery endpoint URL from ONLY the two
 * values that are already public/opaque: the current share route's own
 * publicId and the projection's own opaque fileRef for this resource.
 * Never a resourceId or any other internal identifier -- there is
 * nothing else this function could leak even by mistake, since it
 * receives nothing else. */
function buildShareFileUrl(publicId: string, fileRef: string): string {
  return `/api/share/${encodeURIComponent(publicId)}/resources/${encodeURIComponent(fileRef)}`;
}

export function ClientProjectView({ projection, publicId }: ClientProjectViewProps) {
  const groupedTasks = groupTasksByPublicGroup(projection.tasks);

  return (
    // The projection's contentDirection ("auto" | "ltr" | "rtl") is passed
    // through EXACTLY as the dir attribute value -- "auto" is a valid HTML
    // dir value in its own right and must be set explicitly, never omitted:
    // an omitted attribute can inherit an unrelated direction from an
    // ancestor, which is not the same as an explicit "auto".
    <div dir={projection.contentDirection} style={pageStyle}>
      <div style={columnStyle}>
        <header style={headerStyle}>
          {projection.title ? <h1 style={titleStyle}>{projection.title}</h1> : null}
          {projection.subtitle ? <p style={subtitleStyle}>{projection.subtitle}</p> : null}
          {projection.status || projection.targetDate ? (
            <div style={metaRowStyle}>
              {projection.status ? (
                <span style={statusBadgeStyle}>{STATUS_LABELS[projection.status]}</span>
              ) : null}
              {projection.targetDate ? (
                <span style={targetDateStyle}>Target: {formatTargetDate(projection.targetDate)}</span>
              ) : null}
            </div>
          ) : null}
        </header>

        {projection.progress ? (
          <section style={sectionStyle} aria-label="Progress">
            <div style={progressHeaderStyle}>
              <h2 style={sectionLabelStyle}>Progress</h2>
              <span style={progressCountStyle}>
                {projection.progress.completed} of {projection.progress.total} complete
              </span>
            </div>
            <div style={progressTrackStyle}>
              <div
                style={{
                  ...progressFillStyle,
                  width: `${projection.progress.percent}%`,
                }}
              />
            </div>
          </section>
        ) : null}

        {projection.latestUpdate ? (
          <section style={sectionStyle} aria-label="Latest update">
            <h2 style={sectionLabelStyle}>Latest update</h2>
            <p style={updateBodyStyle}>{projection.latestUpdate.body}</p>
          </section>
        ) : null}

        {projection.tasks.length > 0 ? (
          <section style={sectionStyle} aria-label="Tasks">
            <h2 style={sectionLabelStyle}>Tasks</h2>
            <div style={{ display: "grid", gap: dashboardSpacing[4] }}>
              {TASK_GROUP_ORDER.filter((group) => groupedTasks[group].length > 0).map((group) => (
                <div key={group} style={{ display: "grid", gap: dashboardSpacing[2] }}>
                  <span style={groupLabelStyle}>{TASK_GROUP_LABELS[group]}</span>
                  <ul style={taskListStyle}>
                    {groupedTasks[group].map((task, index) => (
                      <li key={`${group}-${index}`} style={taskItemStyle}>
                        <span dir="auto" style={taskTitleStyle}>
                          {task.title}
                        </span>
                        {task.waitingForClientFeedback ? (
                          <span style={feedbackBadgeStyle}>Feedback needed</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {projection.resources.length > 0 ? (
          <section style={sectionStyle} aria-label="Attachments">
            <h2 style={sectionLabelStyle}>Attachments</h2>
            <ul style={resourceListStyle}>
              {projection.resources.map((resource, index) => {
                if (resource.kind === "link") {
                  return (
                    <li key={index} style={resourceItemStyle}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        dir="auto"
                        style={resourceLinkStyle}
                      >
                        {resource.label}
                      </a>
                    </li>
                  );
                }

                if (resource.kind !== "file") {
                  // Exhaustive, not a catch-all `else`: the server-side
                  // projection can structurally never emit a "note" kind
                  // (assembleClientProjection excludes Note resources
                  // entirely -- there is no "note" member of this
                  // discriminated union at all), but this component does
                  // not additionally trust that as its only safeguard --
                  // any kind other than the two known ones renders
                  // nothing, rather than being silently coerced into the
                  // file branch below.
                  return null;
                }

                // FILE resource. A clickable "Open file"/"Download"
                // action only when this component was given a publicId
                // AND the projection gave this resource a real, non-empty
                // fileRef -- otherwise falls back to the exact original
                // inert-label rendering rather than ever constructing a
                // broken/empty href.
                const fileUrl =
                  publicId && resource.fileRef
                    ? buildShareFileUrl(publicId, resource.fileRef)
                    : null;

                return (
                  <li key={index} style={resourceItemStyle}>
                    <div style={resourceFileRowStyle}>
                      <span dir="auto" style={resourceFileStyle}>
                        {resource.label}
                      </span>
                      {fileUrl ? (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          style={resourceFileActionStyle}
                        >
                          {resource.canDownload ? "Download" : "Open file"}
                        </a>
                      ) : resource.canDownload ? (
                        <span style={mutedInlineStyle}>(downloadable)</span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <footer style={footerStyle}>Shared securely via Text2Task.</footer>
      </div>
    </div>
  );
}

function groupTasksByPublicGroup(
  tasks: ClientProjectTask[]
): Record<ClientProjectTask["publicGroup"], ClientProjectTask[]> {
  const grouped: Record<ClientProjectTask["publicGroup"], ClientProjectTask[]> = {
    coming_up: [],
    in_progress: [],
    completed: [],
    waiting_for_feedback: [],
  };
  for (const task of tasks) {
    grouped[task.publicGroup].push(task);
  }
  return grouped;
}

function formatTargetDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

const pageStyle: CSSProperties = {
  background: dashboardColors.background.page,
  minHeight: "100%",
  padding: `${dashboardSpacing[8]}px ${dashboardSpacing[4]}px`,
  fontFamily: dashboardTypography.fontFamily,
};

const columnStyle: CSSProperties = {
  width: "100%",
  maxWidth: 560,
  margin: "0 auto",
  display: "grid",
  gap: dashboardSpacing[6],
};

const headerStyle: CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[2],
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size["2xl"],
  fontWeight: dashboardTypography.weight.bold,
  color: dashboardColors.text.primary,
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.md,
  color: dashboardColors.text.secondary,
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: dashboardSpacing[3],
  marginTop: dashboardSpacing[1],
};

const statusBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: dashboardRadii.full,
  background: dashboardColors.primary[50],
  color: dashboardColors.primary[700],
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.semibold,
};

const targetDateStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.text.muted,
};

const sectionStyle: CSSProperties = {
  background: dashboardColors.background.surface,
  border: `1px solid ${dashboardColors.border.subtle}`,
  borderRadius: dashboardRadii.xl,
  padding: dashboardSpacing[5],
  display: "grid",
  gap: dashboardSpacing[3],
};

// Phase 7D -- promoted from a styled <span> to a real <h2> (see the
// accessibility audit's "section labels use non-heading elements"
// finding); `margin: 0` keeps the exact same visual spacing a heading
// element would otherwise add on top of this section's own `gap`-based
// layout.
const sectionLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: dashboardColors.text.muted,
};

const progressHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const progressCountStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.text.secondary,
};

const progressTrackStyle: CSSProperties = {
  width: "100%",
  height: 8,
  borderRadius: dashboardRadii.full,
  background: dashboardColors.background.surfaceMuted,
  overflow: "hidden",
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  background: dashboardColors.primary[500],
  borderRadius: dashboardRadii.full,
  transition: "width 200ms ease",
};

const updateBodyStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.md,
  color: dashboardColors.text.secondary,
  whiteSpace: "pre-wrap",
};

const groupLabelStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.semibold,
  color: dashboardColors.text.primary,
};

const taskListStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: dashboardSpacing[2],
};

const taskItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: dashboardSpacing[2],
  padding: "8px 10px",
  borderRadius: dashboardRadii.lg,
  background: dashboardColors.background.surfaceMuted,
  fontSize: dashboardTypography.size.md,
  color: dashboardColors.text.primary,
};

// Phase 7D mobile hardening -- a long, unbroken task title (previously
// unguarded, unlike message bodies) could overflow taskItemStyle's fixed
// container at narrow widths; `minWidth: 0` lets this flex child actually
// shrink instead of forcing the row wider than its parent.
const taskTitleStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const feedbackBadgeStyle: CSSProperties = {
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.semibold,
  color: dashboardColors.status.amber,
  whiteSpace: "nowrap",
};

const resourceListStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: dashboardSpacing[2],
};

const resourceItemStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: dashboardRadii.lg,
  background: dashboardColors.background.surfaceMuted,
};

const resourceLinkStyle: CSSProperties = {
  color: dashboardColors.primary[700],
  fontWeight: dashboardTypography.weight.medium,
  textDecoration: "underline",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const resourceFileStyle: CSSProperties = {
  minWidth: 0,
  color: dashboardColors.text.primary,
  fontWeight: dashboardTypography.weight.medium,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const resourceFileRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: dashboardSpacing[3],
};

// Phase 7D mobile hardening -- flexShrink: 0 keeps the Open/Download
// action from being squeezed illegibly narrow when resourceFileStyle's
// label wraps onto multiple lines at narrow widths.
const resourceFileActionStyle: CSSProperties = {
  flexShrink: 0,
  color: dashboardColors.primary[700],
  fontWeight: dashboardTypography.weight.semibold,
  textDecoration: "underline",
  whiteSpace: "nowrap",
};

const mutedInlineStyle: CSSProperties = {
  color: dashboardColors.text.muted,
  fontWeight: dashboardTypography.weight.regular,
};

const footerStyle: CSSProperties = {
  textAlign: "center",
  fontSize: dashboardTypography.size.xs,
  color: dashboardColors.text.subtle,
  paddingTop: dashboardSpacing[4],
};
