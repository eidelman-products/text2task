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

const TASK_GROUP_ORDER: ClientProjectTask["publicGroup"][] = [
  "waiting_for_feedback",
  "in_progress",
  "coming_up",
  "completed",
];

const TASK_GROUP_LABELS: Record<ClientProjectTask["publicGroup"], string> = {
  waiting_for_feedback: "Waiting for your feedback",
  in_progress: "In progress",
  coming_up: "Coming up",
  completed: "Completed",
};

export type ClientProjectViewProps = {
  projection: ClientProjectProjection;
};

export function ClientProjectView({ projection }: ClientProjectViewProps) {
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
              <span style={sectionLabelStyle}>Progress</span>
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
            <span style={sectionLabelStyle}>Latest update</span>
            <p style={updateBodyStyle}>{projection.latestUpdate.body}</p>
          </section>
        ) : null}

        {projection.tasks.length > 0 ? (
          <section style={sectionStyle} aria-label="Tasks">
            <span style={sectionLabelStyle}>Tasks</span>
            <div style={{ display: "grid", gap: dashboardSpacing[4] }}>
              {TASK_GROUP_ORDER.filter((group) => groupedTasks[group].length > 0).map((group) => (
                <div key={group} style={{ display: "grid", gap: dashboardSpacing[2] }}>
                  <span style={groupLabelStyle}>{TASK_GROUP_LABELS[group]}</span>
                  <ul style={taskListStyle}>
                    {groupedTasks[group].map((task, index) => (
                      <li key={`${group}-${index}`} style={taskItemStyle}>
                        <span>{task.title}</span>
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
          <section style={sectionStyle} aria-label="Shared files and links">
            <span style={sectionLabelStyle}>Shared files &amp; links</span>
            <ul style={resourceListStyle}>
              {projection.resources.map((resource, index) => (
                <li key={index} style={resourceItemStyle}>
                  {resource.kind === "link" ? (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      style={resourceLinkStyle}
                    >
                      {resource.label}
                    </a>
                  ) : (
                    <span style={resourceFileStyle}>
                      {resource.label}
                      {resource.canDownload ? (
                        <span style={mutedInlineStyle}> (downloadable)</span>
                      ) : null}
                    </span>
                  )}
                </li>
              ))}
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

const sectionLabelStyle: CSSProperties = {
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
  gap: dashboardSpacing[2],
  padding: "8px 10px",
  borderRadius: dashboardRadii.lg,
  background: dashboardColors.background.surfaceMuted,
  fontSize: dashboardTypography.size.md,
  color: dashboardColors.text.primary,
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
};

const resourceFileStyle: CSSProperties = {
  color: dashboardColors.text.primary,
  fontWeight: dashboardTypography.weight.medium,
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
