export type UseCaseFaq = {
  question: string;
  answer: string;
};

export type UseCaseCta = {
  label: string;
  href: string;
};

export type UseCaseTextItem = {
  title: string;
  description: string;
};

export type UseCaseImageRole = "source" | "product" | "supporting" | "workflow";

export type UseCaseImage = {
  src: string;
  alt: string;
  label: string;
  width: number;
  height: number;
  role: UseCaseImageRole;
  priority?: boolean;
};

export type UseCaseSeo = {
  title: string;
  description: string;
};

export type UseCaseCategory =
  | "website-development"
  | "creative-content"
  | "operations-teams";

export type UseCaseCategoryMetadata = {
  id: UseCaseCategory;
  heading: string;
  description: string;
  order: number;
};

export type UseCaseListing = {
  category: UseCaseCategory;
  label: string;
  title: string;
  description: string;
  highlights: readonly string[];
};

export type UseCaseHero = {
  badge?: string;
  title: string;
  highlight: string;
  description: string;
  primaryCta: UseCaseCta;
  secondaryCta: UseCaseCta;
  visual: UseCaseImage;
  trustPoints?: string[];
};

export type UseCaseTransformation = {
  title: string;
  description: string;
  beforeLabel: string;
  beforeText: string;
  inputTitle: string;
  inputs: string[];
  outputTitle: string;
  outputs: string[];
  value: string;
};

export type UseCasePainPoints = {
  eyebrow?: string;
  title: string;
  description: string;
  supportingDescription?: string;
  items: string[];
};

export type UseCaseOutcomes = {
  title: string;
  description: string;
  items: UseCaseTextItem[];
};

export type UseCaseWorkflow = {
  title: string;
  description: string;
  steps: UseCaseTextItem[];
};

export type UseCaseCapabilities = {
  title: string;
  description: string;
  items: string[];
};

export type UseCaseProof = {
  title: string;
  description: string;
  images: UseCaseImage[];
};

export type UseCaseClientUpdates = {
  title: string;
  description: string;
  steps: UseCaseTextItem[];
  note: string;
};

export type UseCaseFaqSection = {
  title: string;
  items: UseCaseFaq[];
};

export type UseCaseRelatedLink = {
  label: string;
  description: string;
  href: string;
};

export type UseCaseRelatedLinksSection = {
  title: string;
  links: readonly UseCaseRelatedLink[];
};

export type UseCaseFinalCta = {
  eyebrow?: string;
  title: string;
  description: string;
  primary: UseCaseCta;
  secondary: UseCaseCta;
};

/**
 * Visual-differentiation layer. Every field below is optional so the 4
 * use-cases that don't set them keep rendering through the original,
 * unchanged default layout.
 */
export type UseCaseHeroVariant =
  | "split"
  | "editorial"
  | "centered"
  | "panel"
  | "reversed"
  | "overlap"
  | "wide";

export type UseCaseAccentTone =
  | "blue"
  | "violet"
  | "amber"
  | "teal"
  | "rose"
  | "slate";

export type UseCaseBoardItem = {
  label: string;
  tag?: string;
};

export type UseCaseBoardGroup = {
  label: string;
  items: readonly UseCaseBoardItem[];
};

export type UseCaseBoardModuleData = {
  kind: "board";
  title: string;
  description: string;
  note?: string;
  groups: readonly UseCaseBoardGroup[];
};

export type UseCaseTimelineItem = {
  marker: string;
  label: string;
  description?: string;
};

export type UseCaseTimelineModuleData = {
  kind: "timeline";
  title: string;
  description: string;
  note?: string;
  items: readonly UseCaseTimelineItem[];
};

export type UseCaseChecklistModuleData = {
  kind: "checklist";
  title: string;
  description: string;
  note?: string;
  items: readonly string[];
};

export type UseCaseCalendarEntry = {
  day: string;
  label: string;
  meta: string;
};

export type UseCaseCalendarModuleData = {
  kind: "calendar";
  title: string;
  description: string;
  note?: string;
  entries: readonly UseCaseCalendarEntry[];
};

export type UseCasePipelineRow = {
  client: string;
  project: string;
  owner: string;
  status: string;
};

export type UseCasePipelineModuleData = {
  kind: "pipeline";
  title: string;
  description: string;
  note?: string;
  rows: readonly UseCasePipelineRow[];
};

export type UseCaseSignatureModule =
  | UseCaseBoardModuleData
  | UseCaseTimelineModuleData
  | UseCaseChecklistModuleData
  | UseCaseCalendarModuleData
  | UseCasePipelineModuleData;

export type UseCaseSectionKey =
  | "transformation"
  | "signatureModule"
  | "secondaryModule"
  | "painPoints"
  | "workflow"
  | "capabilities"
  | "proof"
  | "clientUpdates"
  | "faq"
  | "relatedLinks"
  | "related"
  | "finalCta";

export type UseCase = {
  slug: string;
  audienceLabel: string;
  title: string;
  seo: UseCaseSeo;
  listing: UseCaseListing;
  hero: UseCaseHero;
  heroVariant?: UseCaseHeroVariant;
  accentTone?: UseCaseAccentTone;
  transformation?: UseCaseTransformation;
  signatureModule?: UseCaseSignatureModule;
  secondaryModule?: UseCaseSignatureModule;
  painPoints?: UseCasePainPoints;
  outcomes?: UseCaseOutcomes;
  workflow?: UseCaseWorkflow;
  capabilities?: UseCaseCapabilities;
  proof?: UseCaseProof;
  clientUpdates?: UseCaseClientUpdates;
  faq?: UseCaseFaqSection;
  relatedSlugs?: string[];
  relatedLinks?: UseCaseRelatedLinksSection;
  finalCta?: UseCaseFinalCta;
  sectionOrder?: readonly UseCaseSectionKey[];
};
