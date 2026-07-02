import type { ReactNode } from "react";

import ProjectPreviewPresentation, {
  ProjectPreviewClientHeader,
  ProjectPreviewResourcesLine,
} from "../../components/dashboard/extract/project-preview-presentation";
import styles from "./homepage-demo-review.module.css";

export type HomepageDemoReviewPriority = "Low" | "Medium" | "High";

export type HomepageDemoPublicReviewSubtask = {
  task: string;
  priority: HomepageDemoReviewPriority | null;
  deadlineText: string | null;
  deadlineDate: string | null;
  amountText: string | null;
  amountValue: number | null;
  currencyCode: string | null;
  order: number;
};

export type HomepageDemoPublicReviewDraft = {
  title: string;
  summary: string | null;
  clientName: string | null;
  contactName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientNotes: string | null;
  amountText: string | null;
  amountValue: number | null;
  currencyCode: string | null;
  deadlineText: string | null;
  deadlineDate: string | null;
  priority: HomepageDemoReviewPriority | null;
  subtasks: HomepageDemoPublicReviewSubtask[];
};

type HomepageDemoReviewPanelProps = {
  draft: HomepageDemoPublicReviewDraft;
  notice?: ReactNode;
  footer?: ReactNode;
};

type DetailRow = {
  label: string;
  value: string;
};

const NOT_SPECIFIED = "Not specified";

function formatAmount(
  amountText: string | null,
  amountValue: number | null,
  currencyCode: string | null,
): string | null {
  if (amountText !== null) {
    return amountText;
  }

  if (amountValue === null || !Number.isFinite(amountValue)) {
    return null;
  }

  const formattedAmount = amountValue.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });

  return currencyCode === null
    ? formattedAmount
    : `${formattedAmount} ${currencyCode}`;
}

function formatDeadline(
  deadlineText: string | null,
  deadlineDate: string | null,
): string | null {
  return deadlineText ?? deadlineDate;
}

function displayValue(value: string | null): string {
  return value ?? NOT_SPECIFIED;
}

function buildClientDetails(
  draft: HomepageDemoPublicReviewDraft,
): DetailRow[] {
  const details: ReadonlyArray<readonly [string, string | null]> = [
    ["Contact", draft.contactName],
    ["Email", draft.clientEmail],
    ["Phone", draft.clientPhone],
    ["Notes", draft.clientNotes],
  ];

  return details.flatMap(([label, value]) =>
    typeof value === "string" ? [{ label, value }] : [],
  );
}

function buildSubtaskDetails(
  subtask: HomepageDemoPublicReviewSubtask,
): DetailRow[] {
  const amount = formatAmount(
    subtask.amountText,
    subtask.amountValue,
    subtask.currencyCode,
  );
  const deadline = formatDeadline(subtask.deadlineText, subtask.deadlineDate);

  const details: ReadonlyArray<readonly [string, string | null]> = [
    ["Priority", subtask.priority],
    ["Deadline", deadline],
    ["Amount", amount],
  ];

  return details.flatMap(([label, value]) =>
    typeof value === "string" ? [{ label, value }] : [],
  );
}

function ReadOnlyMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={styles.publicMetric}>
      <dt className={styles.publicMetricLabel}>{label}</dt>
      <dd className={styles.publicMetricValue}>{value}</dd>
    </div>
  );
}

function ReadOnlyDetail({ label, value }: DetailRow) {
  return (
    <div className={styles.publicDetail}>
      <dt className={styles.publicDetailLabel}>{label}</dt>
      <dd className={styles.publicDetailValue}>{value}</dd>
    </div>
  );
}

export default function HomepageDemoReviewPanel({
  draft,
  notice,
  footer,
}: HomepageDemoReviewPanelProps) {
  const projectAmount = displayValue(
    formatAmount(draft.amountText, draft.amountValue, draft.currencyCode),
  );
  const projectDeadline = displayValue(
    formatDeadline(draft.deadlineText, draft.deadlineDate),
  );
  const projectPriority = displayValue(draft.priority);
  const clientDetails = buildClientDetails(draft);

  return (
    <ProjectPreviewPresentation
      header={
        <ProjectPreviewClientHeader avatarLabel={draft.clientName ?? ""}>
          <div className={styles.publicHeaderText}>
            <span className={styles.publicHeaderLabel}>Client</span>
            <span className={styles.publicHeaderValue}>
              {displayValue(draft.clientName)}
            </span>
          </div>
        </ProjectPreviewClientHeader>
      }
      projectTitle={
        <h2 id="homepage-demo-review-heading" className={styles.previewTitle}>
          {draft.title}
        </h2>
      }
      projectSummary={
        draft.summary === null ? null : (
          <p className={styles.previewSummary}>{draft.summary}</p>
        )
      }
      projectDetails={
        <dl className={styles.publicMetricGrid}>
          <ReadOnlyMetric label="Budget" value={projectAmount} />
          <ReadOnlyMetric label="Deadline" value={projectDeadline} />
          <ReadOnlyMetric label="Priority" value={projectPriority} />
        </dl>
      }
      clientDetails={
        clientDetails.length === 0 ? (
          <p className={styles.publicEmptyDetail}>Not specified</p>
        ) : (
          <dl className={styles.publicDetailGrid}>
            {clientDetails.map((detail) => (
              <ReadOnlyDetail key={detail.label} {...detail} />
            ))}
          </dl>
        )
      }
      tasksHeading={
        <h3 className={styles.publicTasksTitle}>
          {draft.subtasks.length === 1
            ? "1 task ready"
            : `${draft.subtasks.length} tasks ready`}
        </h3>
      }
      tasks={
        <div className={styles.publicTaskList}>
          {draft.subtasks.map((subtask, index) => {
            const subtaskDetails = buildSubtaskDetails(subtask);

            return (
              <article
                key={`${subtask.order}-${index}-${subtask.task}`}
                className={styles.publicTaskRow}
              >
                <span className={styles.publicTaskCheck} aria-hidden="true">
                  {"\u2713"}
                </span>
                <div className={styles.publicTaskBody}>
                  <span className={styles.publicTaskEyebrow}>
                    Task {subtask.order}
                  </span>
                  <h4 className={styles.publicTaskTitle}>{subtask.task}</h4>
                  {subtaskDetails.length === 0 ? null : (
                    <dl className={styles.publicTaskMeta}>
                      {subtaskDetails.map((detail) => (
                        <div
                          key={detail.label}
                          className={styles.publicTaskMetaItem}
                        >
                          <dt className={styles.publicTaskMetaLabel}>
                            {detail.label}
                          </dt>
                          <dd className={styles.publicTaskMetaValue}>
                            {detail.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      }
      resources={<ProjectPreviewResourcesLine />}
      notice={notice}
      footer={footer}
    />
  );
}
