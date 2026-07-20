import type { UseCase } from "@/app/lib/use-cases";
import UseCaseBoardModule from "./use-case-board-module";
import UseCaseCalendarModule from "./use-case-calendar-module";
import UseCaseChecklistModule from "./use-case-checklist-module";
import UseCasePipelineModule from "./use-case-pipeline-module";
import UseCaseTimelineModule from "./use-case-timeline-module";

export default function UseCaseSignatureModule({
  useCase,
  field,
}: {
  useCase: UseCase;
  field: "signatureModule" | "secondaryModule";
}) {
  const moduleData = useCase[field];
  if (!moduleData) return null;

  switch (moduleData.kind) {
    case "board":
      return (
        <UseCaseBoardModule module={moduleData} accentTone={useCase.accentTone} />
      );
    case "timeline":
      return (
        <UseCaseTimelineModule
          module={moduleData}
          accentTone={useCase.accentTone}
        />
      );
    case "checklist":
      return (
        <UseCaseChecklistModule
          module={moduleData}
          accentTone={useCase.accentTone}
        />
      );
    case "calendar":
      return (
        <UseCaseCalendarModule
          module={moduleData}
          accentTone={useCase.accentTone}
        />
      );
    case "pipeline":
      return (
        <UseCasePipelineModule
          module={moduleData}
          accentTone={useCase.accentTone}
        />
      );
    default:
      return null;
  }
}
