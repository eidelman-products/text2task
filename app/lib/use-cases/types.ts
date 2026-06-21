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

export type UseCaseFinalCta = {
  eyebrow?: string;
  title: string;
  description: string;
  primary: UseCaseCta;
  secondary: UseCaseCta;
};

export type UseCase = {
  slug: string;
  audienceLabel: string;
  title: string;
  seo: UseCaseSeo;
  listing: UseCaseListing;
  hero: UseCaseHero;
  transformation?: UseCaseTransformation;
  painPoints?: UseCasePainPoints;
  outcomes?: UseCaseOutcomes;
  workflow?: UseCaseWorkflow;
  capabilities?: UseCaseCapabilities;
  proof?: UseCaseProof;
  clientUpdates?: UseCaseClientUpdates;
  faq?: UseCaseFaqSection;
  relatedSlugs?: string[];
  finalCta?: UseCaseFinalCta;
};
