import type { CSSProperties, JSX, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import Link from "next/link";
import type {
  CalendarItem,
  ManualCalendarEventItem,
  ProjectDeadlineCalendarItem,
} from "@/lib/calendar/calendar-types";
import { formatTimeOnlyForDisplay } from "@/lib/calendar/time-only";
import { DashboardButton } from "../ui/button";
import {
  dashboardColors,
  dashboardRadii,
  dashboardShadows,
  dashboardSpacing,
  dashboardTransitions,
  dashboardTypography,
} from "../ui/tokens";

export type CalendarAgendaItemEditCallback = (
  item: ManualCalendarEventItem,
  triggerElement: HTMLElement
) => void;

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
 * A single agenda row for one `CalendarItem`. `ProjectDeadlineRow` remains
 * fully read-only except for its existing "Open Task CRM" link.
 * `ManualEventRow` gains exactly one new interactive element, an explicit
 * Edit button -- never a whole-card click, never a Delete control here
 * (Delete lives entirely inside CalendarDayDialog's edit mode, i.e.
 * CalendarEventForm).
 */
export function CalendarAgendaItem({
  item,
  onEditEvent,
}: {
  item: CalendarItem;
  onEditEvent?: CalendarAgendaItemEditCallback;
}): JSX.Element {
  return (
    <li style={itemShellStyle(item.kind)}>
      {item.kind === "project_deadline" ? (
        <ProjectDeadlineRow item={item} />
      ) : (
        <ManualEventRow item={item} onEditEvent={onEditEvent} />
      )}
    </li>
  );
}

/** Icon + small caption above a value -- e.g. a Project or Client row. Never a nested interactive element. */
function MetaRow({ icon, caption, value }: { icon: ReactNode; caption: string; value: string }): JSX.Element {
  return (
    <div style={metaRowStyle}>
      {icon}
      <span style={metaTextStackStyle}>
        <span style={metaCaptionStyle}>{caption}</span>
        <span style={metaValueStyle}>{value}</span>
      </span>
    </div>
  );
}

function ProjectDeadlineRow({ item }: { item: ProjectDeadlineCalendarItem }): JSX.Element {
  const completed = isDoneStatus(item.status);

  return (
    <div style={rowStackStyle}>
      <div style={topRowStyle}>
        <span style={kindLabelStyle}>Project deadline</span>
        {item.status !== null ? (
          <span style={completed ? completedStatusBadgeStyle : neutralStatusBadgeStyle}>{item.status}</span>
        ) : null}
      </div>

      <div
        style={{
          ...titleStyle,
          color: completed ? dashboardColors.text.muted : dashboardColors.text.primary,
          opacity: completed ? 0.72 : 1,
        }}
      >
        {item.title}
      </div>

      {item.clientName !== null ? <MetaRow icon={<BuildingIcon />} caption="Client" value={item.clientName} /> : null}

      {item.priority !== null || item.isOverdue ? (
        <div style={statusPillRowStyle}>
          {item.priority !== null ? (
            <span style={priorityPillStyle}>
              <FlagIcon />
              {item.priority} priority
            </span>
          ) : null}
          {item.isOverdue ? (
            <span style={overduePillStyle}>
              <ClockIcon />
              Overdue
            </span>
          ) : null}
        </div>
      ) : null}

      <div>
        <Link href="/dashboard?view=tasks" style={linkStyle}>
          Open Task CRM
          <ExternalLinkIcon />
        </Link>
      </div>
    </div>
  );
}

function ManualEventRow({
  item,
  onEditEvent,
}: {
  item: ManualCalendarEventItem;
  onEditEvent?: CalendarAgendaItemEditCallback;
}): JSX.Element {
  const notes = item.notes && item.notes.length > 0 ? truncateNotes(item.notes) : null;

  function handleEditClick(event: ReactMouseEvent<HTMLButtonElement>) {
    onEditEvent?.(item, event.currentTarget);
  }

  return (
    <div style={rowStackStyle}>
      <div style={kindLabelStyle}>Manual event</div>

      <div style={titleStyle}>{item.title}</div>

      {item.time !== null ? (
        <div style={metaRowStyle}>
          <ClockIcon />
          <span style={metaInlineValueStyle}>{formatTimeOnlyForDisplay(item.time)}</span>
        </div>
      ) : null}

      {item.projectTitle !== null ? <MetaRow icon={<FolderIcon />} caption="Project" value={item.projectTitle} /> : null}

      {item.clientName !== null ? <MetaRow icon={<BuildingIcon />} caption="Client" value={item.clientName} /> : null}

      {notes !== null ? <p style={notesStyle}>{notes}</p> : null}

      {onEditEvent ? (
        <div style={editButtonRowStyle}>
          <DashboardButton
            type="button"
            variant="soft"
            size="sm"
            style={editButtonStyle}
            aria-label={`Edit ${item.title}`}
            onClick={handleEditClick}
          >
            Edit
          </DashboardButton>
        </div>
      ) : null}
    </div>
  );
}

const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  style: { flexShrink: 0 },
};

function FolderIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

function BuildingIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1" />
    </svg>
  );
}

function FlagIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M5 3v18" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

function ClockIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function ExternalLinkIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS} width={14} height={14}>
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

/**
 * Subtle per-kind brand accent (left border + a faint top-down wash) so a
 * Project Deadline card and a Manual Event card are tintable-at-a-glance
 * without relying on color alone -- the kind label/icons already carry the
 * meaning; this is a visual-polish reinforcement only, same structure for
 * both kinds.
 */
function itemShellStyle(kind: CalendarItem["kind"]): CSSProperties {
  const accent = kind === "project_deadline" ? "rgba(124, 58, 237, 0.55)" : "rgba(37, 99, 235, 0.55)";
  const wash = kind === "project_deadline" ? "rgba(124, 58, 237, 0.035)" : "rgba(37, 99, 235, 0.035)";
  return {
    listStyle: "none",
    borderRadius: dashboardRadii.lg,
    border: `1px solid ${dashboardColors.border.subtle}`,
    borderLeft: `3px solid ${accent}`,
    background: `linear-gradient(180deg, ${wash} 0%, ${dashboardColors.background.surface} 55%)`,
    boxShadow: dashboardShadows.xs,
    padding: dashboardSpacing[4],
    transition: `border-color ${dashboardTransitions.fast}, box-shadow ${dashboardTransitions.fast}`,
  };
}

const rowStackStyle: CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[2],
  fontFamily: dashboardTypography.fontFamily,
};

const topRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: dashboardSpacing[2],
};

const kindLabelStyle: CSSProperties = {
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.black,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: dashboardColors.text.muted,
};

const titleStyle: CSSProperties = {
  fontSize: dashboardTypography.size.lg,
  fontWeight: dashboardTypography.weight.bold,
  letterSpacing: "-0.01em",
  color: dashboardColors.text.primary,
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: dashboardSpacing[2],
  color: dashboardColors.text.secondary,
};

const metaTextStackStyle: CSSProperties = {
  display: "grid",
  gap: 1,
  minWidth: 0,
};

const metaCaptionStyle: CSSProperties = {
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.bold,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: dashboardColors.text.muted,
};

const metaValueStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.semibold,
  color: dashboardColors.text.secondary,
};

const metaInlineValueStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.medium,
  color: dashboardColors.text.secondary,
};

const editButtonRowStyle: CSSProperties = {
  marginTop: dashboardSpacing[1],
};

const editButtonStyle: CSSProperties = {
  minHeight: 44,
};

const statusPillRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: dashboardSpacing[2],
  marginTop: dashboardSpacing[1],
};

const pillBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: `4px ${dashboardSpacing[2]}px`,
  borderRadius: dashboardRadii.full,
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.bold,
};

const priorityPillStyle: CSSProperties = {
  ...pillBaseStyle,
  color: dashboardColors.status.amber,
  background: dashboardColors.status.amberSoft,
};

const overduePillStyle: CSSProperties = {
  ...pillBaseStyle,
  color: dashboardColors.status.red,
  background: dashboardColors.status.redSoft,
};

const statusBadgeBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: `3px ${dashboardSpacing[2]}px`,
  borderRadius: dashboardRadii.full,
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.black,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  flexShrink: 0,
};

const neutralStatusBadgeStyle: CSSProperties = {
  ...statusBadgeBaseStyle,
  color: dashboardColors.text.secondary,
  background: dashboardColors.background.surfaceMuted,
};

const completedStatusBadgeStyle: CSSProperties = {
  ...statusBadgeBaseStyle,
  color: dashboardColors.status.green,
  background: dashboardColors.status.greenSoft,
};

const linkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: dashboardSpacing[1],
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
