export type UseCaseFaq = {
  question: string;
  answer: string;
};

export type UseCaseExampleTask = {
  client: string;
  task: string;
  deadline: string;
  budget: string;
  priority: "Low" | "Medium" | "High";
};

export type UseCaseScenarioFrameType = "email" | "chat" | "note";

export type UseCaseScenario = {
  title: string;
  description: string;
  frameType: UseCaseScenarioFrameType;
  senderName: string;
  senderMeta: string;
  subject?: string;
  timeLabel: string;
  message: string;
  attachments?: string[];
  outcomeTitle: string;
  outcomeBullets: string[];
};

export type UseCaseV5EmailFrame = {
  senderName: string;
  senderEmail: string;
  subject: string;
  timeLabel: string;
  body: string[];
  attachments: string[];
};

export type UseCaseV5ProofImage = {
  src: string;
  alt: string;
  label: string;
};

export type UseCaseV5FlowStep = {
  title: string;
  description: string;
};

export type UseCaseV5Content = {
  heroEmail: UseCaseV5EmailFrame;
  heroImage: string;
  heroImageAlt: string;
  aiSummaryTitle: string;
  aiSummaryItems: string[];
  transformationTitle: string;
  transformationDescription: string;
  transformationInputs: string[];
  transformationOutputs: string[];
  transformationValue: string;
  flowSteps?: UseCaseV5FlowStep[];
  proofTitle: string;
  proofDescription: string;
  proofImages: UseCaseV5ProofImage[];
  manageTitle?: string;
  manageDescription?: string;
  manageItems: string[];
};

export type UseCase = {
  slug: string;
  audienceLabel: string;
  title: string;
  seoTitle: string;
  metaDescription: string;
  badge: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  primaryCta: string;
  secondaryCta: string;
  problemTitle: string;
  problemDescription: string;
  beforeMessage: string;
  scenario: UseCaseScenario;
  extractedFields: string[];
  exampleTasks: UseCaseExampleTask[];
  productProofTitle: string;
  productProofDescription: string;
  productProofImage: string;
  productProofImageAlt: string;
  productProofBullets: string[];
  workflowTitle: string;
  workflowDescription: string;
  workflowSteps: {
    title: string;
    description: string;
  }[];
  benefitsTitle: string;
  benefitsDescription: string;
  benefits: {
    title: string;
    description: string;
  }[];
  commonTasksTitle: string;
  specificTasks: string[];
  faqTitle: string;
  faq: UseCaseFaq[];
  relatedUseCases: string[];
  finalCtaEyebrow: string;
  finalCtaTitle: string;
  finalCtaDescription: string;
  finalCtaPrimary: string;
  finalCtaSecondary: string;
  v5?: UseCaseV5Content;
};

export const extractedFields = [
  "Client name",
  "Task title",
  "Deadline",
  "Budget",
  "Priority",
  "Client notes",
  "Source message",
];

export type UseCasePageData = UseCase;
