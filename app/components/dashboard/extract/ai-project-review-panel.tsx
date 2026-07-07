"use client";

import type { HybridPreviewMeta } from "@/lib/preview/hybrid-preview";
import { formatDeadline } from "@/lib/tasks/format-deadline";
import type {
  PreviewProjectGroup,
  PreviewProjectPriority,
} from "../editable-preview-list";
import ProjectPreviewPresentation, {
  ProjectPreviewClientHeader,
  ProjectPreviewClientNameField,
  ProjectPreviewClientNameInput,
  ProjectPreviewDetailInput,
  ProjectPreviewDetailTextarea,
  ProjectPreviewMetricInput,
  ProjectPreviewMetricSelect,
  ProjectPreviewMoreTasksLine,
  ProjectPreviewProjectTitleField,
  ProjectPreviewProjectTitleInput,
  ProjectPreviewResourcesLine,
  ProjectPreviewSummaryText,
  ProjectPreviewTaskRemoveButton,
  ProjectPreviewTaskRow,
  ProjectPreviewTaskTextarea,
  ProjectPreviewTasksHeading,
} from "./project-preview-presentation";

type PreviewFieldName =
  | "client"
  | "contact_name"
  | "contactName"
  | "contact_person"
  | "contactPerson"
  | "client_phone"
  | "client_email"
  | "client_notes"
  | "task"
  | "amount"
  | "deadline"
  | "priority"
  | "status"
  | "source"
  | "raw_input"
  | "deadline_date"
  | "deadline_original_text";

type AiProjectReviewPanelProps = {
  groupIndex: number;
  group: PreviewProjectGroup;
  aiMetaByPreviewId: Record<string, HybridPreviewMeta>;
  onChange: (index: number, field: PreviewFieldName, value: string) => void;
  onProjectPriorityChange?: (priority: PreviewProjectPriority) => void;
  onRemovePreviewItem: (previewId: string) => void;
};

const PROJECT_PRIORITY_NOT_SPECIFIED = "Not specified";
const PROJECT_PRIORITY_OPTIONS: readonly PreviewProjectPriority[] = [
  "Low",
  "Medium",
  "High",
];

export default function AiProjectReviewPanel({
  group,
  onChange,
  onProjectPriorityChange,
  onRemovePreviewItem,
}: AiProjectReviewPanelProps) {
  const visibleTasks = group.items.slice(0, 7);
  const hiddenTasks = Math.max(group.items.length - visibleTasks.length, 0);
  const normalizedDeadlineDisplay = group.deadlineDate
    ? formatDeadline(undefined, group.deadlineDate)
    : "";
  const priorityValue = group.priority || PROJECT_PRIORITY_NOT_SPECIFIED;
  const priorityOptions =
    group.priority === ""
      ? [PROJECT_PRIORITY_NOT_SPECIFIED, ...PROJECT_PRIORITY_OPTIONS]
      : PROJECT_PRIORITY_OPTIONS;

  function updateGroupField(field: PreviewFieldName, value: string) {
    group.items.forEach((item) => {
      onChange(item.originalIndex, field, value);
    });
  }

  function updateTask(originalIndex: number, value: string) {
    onChange(originalIndex, "task", value);
  }

  function isPreviewProjectPriority(
    value: string
  ): value is PreviewProjectPriority {
    return PROJECT_PRIORITY_OPTIONS.includes(value as PreviewProjectPriority);
  }

  function updateProjectPriority(value: string) {
    if (!isPreviewProjectPriority(value)) {
      return;
    }

    if (onProjectPriorityChange) {
      onProjectPriorityChange(value);
      return;
    }

    updateGroupField("priority", value);
  }

  return (
    <ProjectPreviewPresentation
      header={
        <ProjectPreviewClientHeader avatarLabel={group.clientName}>
          <ProjectPreviewClientNameField>
            <ProjectPreviewClientNameInput
              value={group.clientName}
              onChange={(value) => updateGroupField("client", value)}
              placeholder="Client or company"
            />
          </ProjectPreviewClientNameField>
        </ProjectPreviewClientHeader>
      }
      projectTitle={
        <ProjectPreviewProjectTitleField>
          <ProjectPreviewProjectTitleInput value={group.projectTitle} readOnly />
        </ProjectPreviewProjectTitleField>
      }
      projectSummary={
        group.projectSummary ? (
          <ProjectPreviewSummaryText>{group.projectSummary}</ProjectPreviewSummaryText>
        ) : null
      }
      projectDetails={
        <>
          <ProjectPreviewMetricInput
            label="Budget"
            value={group.amount}
            placeholder="Budget"
            accent="#047857"
            tone="green"
            onChange={(value) => updateGroupField("amount", value)}
          />

          <ProjectPreviewMetricInput
            label="Deadline"
            value={group.deadline}
            placeholder="Deadline"
            accent="#2563eb"
            tone="blue"
            helperText={
              normalizedDeadlineDisplay
                ? `Date: ${normalizedDeadlineDisplay}`
                : undefined
              }
            onChange={(value) => updateGroupField("deadline", value)}
          />

          <ProjectPreviewMetricSelect
            label="Priority"
            value={priorityValue}
            options={priorityOptions}
            tone="orange"
            onChange={updateProjectPriority}
          />
        </>
      }
      clientDetails={
        <>
          <ProjectPreviewDetailInput
            label="Contact"
            value={group.contactName}
            placeholder="Contact"
            onChange={(value) => updateGroupField("contact_name", value)}
          />

          <ProjectPreviewDetailInput
            label="Phone"
            value={group.client_phone}
            placeholder="Phone"
            onChange={(value) => updateGroupField("client_phone", value)}
          />

          <ProjectPreviewDetailInput
            label="Email"
            value={group.client_email}
            placeholder="Email"
            onChange={(value) => updateGroupField("client_email", value)}
          />

          <ProjectPreviewDetailTextarea
            label="Notes"
            value={group.client_notes}
            placeholder="Notes"
            onChange={(value) => updateGroupField("client_notes", value)}
            rows={2}
          />
        </>
      }
      tasksHeading={
        <ProjectPreviewTasksHeading count={group.items.length} />
      }
      tasks={
        <>
          {visibleTasks.map((item) => (
            <ProjectPreviewTaskRow
              key={item.preview.previewId}
              action={
                <ProjectPreviewTaskRemoveButton
                  onClick={() => onRemovePreviewItem(item.preview.previewId)}
                >
                  Remove
                </ProjectPreviewTaskRemoveButton>
              }
            >
              <ProjectPreviewTaskTextarea
                value={item.preview.task}
                onChange={(value) => updateTask(item.originalIndex, value)}
                placeholder="Subtask title"
                rows={getTaskTextareaRows(item.preview.task)}
              />
            </ProjectPreviewTaskRow>
          ))}

          <ProjectPreviewMoreTasksLine hiddenCount={hiddenTasks} />
        </>
      }
      resources={<ProjectPreviewResourcesLine />}
    />
  );
}

function getTaskTextareaRows(value: string) {
  const clean = String(value || "").trim();

  if (!clean) return 1;

  const explicitLines = clean.split(/\n/).length;
  const estimatedWrappedLines = Math.ceil(clean.length / 34);

  return Math.min(Math.max(explicitLines, estimatedWrappedLines, 1), 4);
}
