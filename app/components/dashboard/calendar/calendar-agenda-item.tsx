import type { CSSProperties, JSX } from "react";
import Link from "next/link";
import type {
  CalendarItem,
  ManualCalendarEventItem,
  ProjectDeadlineCalendarItem,
} from "@/lib/calendar/calendar-types";
import { formatTimeOnlyForDisplay } from "@/lib/calendar/time-only";
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "../ui/tokens";

/**
 * Maximum characters of manual-event notes rendered before truncation.
 * Short/normal notes are never truncated -- only notes longer than this are
 * cut, with a trailing "…" appended.
 */
const NOTES_TRUNCATE_LENGTH = 400;

/**
 * This codebase's established completion convention (see
 * lib/tasks/get-dashboard-alerts.ts's `isDone` and
 * lib/tasks/get-deadline-ui.ts's `normalizedStatus === "done"` check): a
 * case-insensitive, trimmed comparison against "done".
 */
function isDoneStatus(status: string | null): boolean {
  return status?.trim().toLowerCase() === "done";
}

function truncateNotes(notes: string): string {
  if (notes.length <= NOTES_TRUNCATE_LENGTH) return notes;
  return `${notes.slice(0, NOTES_TRUNCATE_LENGTH)}…`;
}

/**
 * A single read-only agenda row for one `CalendarItem`. Renders either a
 * project-deadline projection or a manual calendar event -- never any
 * edit/delete/create control. The only interactive element across both
 * kinds is the "Open Task CRM" link on project-deadline items.
 */
export function CalendarAgendaItem({ item }: { item: CalendarItem }): JSX.Element {
  return (
    <li style={itemShellStyle}>
      {item.kind === "project_deadline" ? (
        <ProjectDeadlineRow item={item} />
      ) : (
        <ManualEventRow item={item} />
      )}
    </li>
  );
}

function ProjectDeadlineRow({ item }: { item: ProjectDeadlineCalendarItem }): JSX.Element {
  const completed = isDoneStatus(item.status);

  return (
    <div style={rowStackStyle}>
      <div style={kindLabelStyle}>Project deadline</div>

      <div
        style={{
          ...titleStyle,
          color: completed ? dashboardColors.text.muted : dashboardColors.text.primary,
          opacity: completed ? 0.72 : 1,
        }}
      >
        {item.title}
      </div>

      {item.clientName !== null ? <div style={metaLineStyle}>{item.clientName}</div> : null}

      <div style={badgeRowStyle}>
        {item.status !== null ? (
          <span style={neutralBadgeStyle}>{item.status}</span>
        ) : null}

        {item.priority !== null ? (
          <span style={neutralBadgeStyle}>{item.priority}</span>
        ) : null}

        {completed ? (
          <span style={{ ...badgeStyle, color: dashboardColors.status.green, background: dashboardColors.status.greenSoft }}>
            Completed
          </span>
        ) : null}

        {item.isOverdue ? (
          <span style={{ ...badgeStyle, color: dashboardColors.status.red, background: dashboardColors.status.redSoft }}>
            Overdue
          </span>
        ) : null}
      </div>

      <div>
        <Link href="/dashboard?view=tasks" style={linkStyle}>
          Open Task CRM
        </Link>
      </div>
    </div>
  );
}

function ManualEventRow({ item }: { item: ManualCalendarEventItem }): JSX.Element {
  const notes = item.notes && item.notes.length > 0 ? truncateNotes(item.notes) : null;

  return (
    <div style={rowStackStyle}>
      <div style={kindLabelStyle}>Manual event</div>

      <div style={titleStyle}>{item.title}</div>

      {item.time !== null ? (
        <div style={metaLineStyle}>{formatTimeOnlyForDisplay(item.time)}</div>
      ) : null}

      {item.clientName !== null ? <div style={metaLineStyle}>{item.clientName}</div> : null}

      {item.projectTitle !== null ? (
        <div style={metaLineStyle}>Project: {item.projectTitle}</div>
      ) : null}

      {notes !== null ? <p style={notesStyle}>{notes}</p> : null}
    </div>
  );
}

const itemShellStyle: CSSProperties = {
  listStyle: "none",
  borderRadius: dashboardRadii.md,
  border: `1px solid ${dashboardColors.border.subtle}`,
  background: dashboardColors.background.surface,
  padding: dashboardSpacing[4],
};

const rowStackStyle: CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[1],
  fontFamily: dashboardTypography.fontFamily,
};

const kindLabelStyle: CSSProperties = {
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.black,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: dashboardColors.text.muted,
};

const titleStyle: CSSProperties = {
  fontSize: dashboardTypography.size.md,
  fontWeight: dashboardTypography.weight.semibold,
  color: dashboardColors.text.primary,
};

const metaLineStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.medium,
  color: dashboardColors.text.secondary,
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: dashboardSpacing[2],
  marginTop: dashboardSpacing[1],
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: `2px ${dashboardSpacing[2]}px`,
  borderRadius: dashboardRadii.full,
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.bold,
};

const neutralBadgeStyle: CSSProperties = {
  ...badgeStyle,
  color: dashboardColors.text.secondary,
  background: dashboardColors.background.surfaceMuted,
};

const linkStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.semibold,
  color: dashboardColors.primary[600],
};

const notesStyle: CSSProperties = {
  whiteSpace: "pre-line",
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.regular,
  color: dashboardColors.text.secondary,
  margin: 0,
};
