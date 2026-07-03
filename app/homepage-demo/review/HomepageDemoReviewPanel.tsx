import type { ReactNode } from "react";

import ProjectPreviewPresentation, {
  ProjectPreviewClientHeader,
  ProjectPreviewClientNameField,
  ProjectPreviewDetailField,
  ProjectPreviewDetailText,
  ProjectPreviewMetricCard,
  ProjectPreviewMetricText,
  ProjectPreviewProjectTitleField,
  ProjectPreviewProjectTitleText,
  ProjectPreviewResourcesLine,
  ProjectPreviewSummaryText,
  ProjectPreviewTaskRow,
  ProjectPreviewTasksHeading,
  ProjectPreviewTaskText,
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

  return (
    <ProjectPreviewPresentation
      header={
        <ProjectPreviewClientHeader avatarLabel={draft.clientName ?? ""}>
          <ProjectPreviewClientNameField>
            <span className={styles.publicClientName}>
              {displayValue(draft.clientName)}
            </span>
          </ProjectPreviewClientNameField>
        </ProjectPreviewClientHeader>
      }
      projectTitle={
        <ProjectPreviewProjectTitleField>
          <ProjectPreviewProjectTitleText>
            {draft.title}
          </ProjectPreviewProjectTitleText>
        </ProjectPreviewProjectTitleField>
      }
      projectSummary={
        draft.summary === null ? null : (
          <ProjectPreviewSummaryText>{draft.summary}</ProjectPreviewSummaryText>
        )
      }
      projectDetails={
        <>
          <ProjectPreviewMetricCard label="Budget" tone="green">
            <ProjectPreviewMetricText>{projectAmount}</ProjectPreviewMetricText>
          </ProjectPreviewMetricCard>

          <ProjectPreviewMetricCard label="Deadline" tone="blue">
            <ProjectPreviewMetricText>
              {projectDeadline}
            </ProjectPreviewMetricText>
          </ProjectPreviewMetricCard>

          <ProjectPreviewMetricCard label="Priority" tone="orange">
            <ProjectPreviewMetricText>
              {projectPriority}
            </ProjectPreviewMetricText>
          </ProjectPreviewMetricCard>
        </>
      }
      clientDetails={
        <>
          <ProjectPreviewDetailField label="Contact">
            <ProjectPreviewDetailText placeholder={NOT_SPECIFIED}>
              {draft.contactName}
            </ProjectPreviewDetailText>
          </ProjectPreviewDetailField>

          <ProjectPreviewDetailField label="Phone">
            <ProjectPreviewDetailText placeholder={NOT_SPECIFIED}>
              {draft.clientPhone}
            </ProjectPreviewDetailText>
          </ProjectPreviewDetailField>

          <ProjectPreviewDetailField label="Email">
            <ProjectPreviewDetailText placeholder={NOT_SPECIFIED}>
              {draft.clientEmail}
            </ProjectPreviewDetailText>
          </ProjectPreviewDetailField>

          <ProjectPreviewDetailField label="Notes" fullWidth>
            <ProjectPreviewDetailText placeholder={NOT_SPECIFIED}>
              {draft.clientNotes}
            </ProjectPreviewDetailText>
          </ProjectPreviewDetailField>
        </>
      }
      tasksHeading={
        <ProjectPreviewTasksHeading count={draft.subtasks.length} />
      }
      tasks={
        <>
          {draft.subtasks.map((subtask, index) => {
            return (
              <ProjectPreviewTaskRow
                key={`${subtask.order}-${index}-${subtask.task}`}
              >
                <ProjectPreviewTaskText>{subtask.task}</ProjectPreviewTaskText>
              </ProjectPreviewTaskRow>
            );
          })}
        </>
      }
      resources={<ProjectPreviewResourcesLine />}
      notice={notice}
      footer={footer}
    />
  );
}
