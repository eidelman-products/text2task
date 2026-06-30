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

type DetailRow = {
  label: string;
  value: string;
};

type HomepageDemoReviewPanelProps = {
  draft: HomepageDemoPublicReviewDraft;
};

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

  const formattedAmount = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(amountValue);

  return currencyCode === null ? formattedAmount : `${formattedAmount} ${currencyCode}`;
}

function formatDeadline(deadlineText: string | null, deadlineDate: string | null): string | null {
  return deadlineText ?? deadlineDate;
}

function buildProjectDetails(draft: HomepageDemoPublicReviewDraft): DetailRow[] {
  const rows: Array<DetailRow | null> = [
    draft.clientName === null ? null : { label: "Client", value: draft.clientName },
    draft.contactName === null ? null : { label: "Contact", value: draft.contactName },
    draft.clientEmail === null ? null : { label: "Email", value: draft.clientEmail },
    draft.clientPhone === null ? null : { label: "Phone", value: draft.clientPhone },
    draft.clientNotes === null ? null : { label: "Notes", value: draft.clientNotes },
    (() => {
      const amount = formatAmount(draft.amountText, draft.amountValue, draft.currencyCode);
      return amount === null ? null : { label: "Amount", value: amount };
    })(),
    (() => {
      const deadline = formatDeadline(draft.deadlineText, draft.deadlineDate);
      return deadline === null ? null : { label: "Deadline", value: deadline };
    })(),
    draft.priority === null ? null : { label: "Priority", value: draft.priority },
  ];

  return rows.filter((row): row is DetailRow => row !== null);
}

function buildSubtaskDetails(subtask: HomepageDemoPublicReviewSubtask): DetailRow[] {
  const rows: Array<DetailRow | null> = [
    subtask.priority === null ? null : { label: "Priority", value: subtask.priority },
    (() => {
      const deadline = formatDeadline(subtask.deadlineText, subtask.deadlineDate);
      return deadline === null ? null : { label: "Deadline", value: deadline };
    })(),
    (() => {
      const amount = formatAmount(subtask.amountText, subtask.amountValue, subtask.currencyCode);
      return amount === null ? null : { label: "Amount", value: amount };
    })(),
  ];

  return rows.filter((row): row is DetailRow => row !== null);
}

export default function HomepageDemoReviewPanel({ draft }: HomepageDemoReviewPanelProps) {
  const projectDetails = buildProjectDetails(draft);

  return (
    <section className={styles.reviewPanel} aria-labelledby="homepage-demo-review-heading">
      <div className={styles.panelHeader}>
        <p className={styles.kicker}>Ready</p>
        <h2 id="homepage-demo-review-heading" className={styles.panelTitle}>
          Your project is ready to review
        </h2>
        <p className={styles.panelIntro}>
          Nothing has been saved to an account yet. Review the draft below, then choose how to
          continue.
        </p>
      </div>

      <article className={styles.draftCard}>
        <div className={styles.draftHeader}>
          <p className={styles.sectionLabel}>Project</p>
          <h3 className={styles.draftTitle}>{draft.title}</h3>
          {draft.summary === null ? null : <p className={styles.summary}>{draft.summary}</p>}
        </div>

        {projectDetails.length === 0 ? null : (
          <section className={styles.detailSection} aria-labelledby="project-details-heading">
            <h4 id="project-details-heading" className={styles.subsectionTitle}>
              Project details
            </h4>
            <dl className={styles.detailGrid}>
              {projectDetails.map((detail) => (
                <div className={styles.detailItem} key={detail.label}>
                  <dt className={styles.detailLabel}>{detail.label}</dt>
                  <dd className={styles.detailValue}>{detail.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section className={styles.subtasksSection} aria-labelledby="subtasks-heading">
          <h4 id="subtasks-heading" className={styles.subsectionTitle}>
            Tasks
          </h4>
          <ol className={styles.subtaskList}>
            {draft.subtasks.map((subtask, index) => {
              const subtaskDetails = buildSubtaskDetails(subtask);

              return (
                <li className={styles.subtaskItem} key={`${subtask.order}-${index}`}>
                  <div className={styles.subtaskOrder} aria-label={`Task ${subtask.order}`}>
                    {subtask.order}
                  </div>
                  <div className={styles.subtaskBody}>
                    <h5 className={styles.subtaskTitle}>{subtask.task}</h5>
                    {subtaskDetails.length === 0 ? null : (
                      <dl className={styles.subtaskMeta}>
                        {subtaskDetails.map((detail) => (
                          <div className={styles.subtaskMetaItem} key={detail.label}>
                            <dt className={styles.subtaskMetaLabel}>{detail.label}</dt>
                            <dd className={styles.subtaskMetaValue}>{detail.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </article>

      <p className={styles.privacyNote}>This preview has not been saved to an account.</p>
    </section>
  );
}
