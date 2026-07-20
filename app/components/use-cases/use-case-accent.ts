import type { UseCaseAccentTone } from "@/app/lib/use-cases";

export type UseCaseAccentClasses = {
  border: string;
  bg: string;
  text: string;
  dot: string;
};

const ACCENT_CLASSES: Record<UseCaseAccentTone, UseCaseAccentClasses> = {
  blue: {
    border: "border-blue-200",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-600",
  },
  violet: {
    border: "border-violet-200",
    bg: "bg-violet-50",
    text: "text-violet-700",
    dot: "bg-violet-600",
  },
  amber: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-600",
  },
  teal: {
    border: "border-teal-200",
    bg: "bg-teal-50",
    text: "text-teal-700",
    dot: "bg-teal-600",
  },
  rose: {
    border: "border-rose-200",
    bg: "bg-rose-50",
    text: "text-rose-700",
    dot: "bg-rose-600",
  },
  slate: {
    border: "border-slate-300",
    bg: "bg-slate-100",
    text: "text-slate-700",
    dot: "bg-slate-700",
  },
};

export function getUseCaseAccentClasses(
  tone: UseCaseAccentTone | undefined
): UseCaseAccentClasses {
  return ACCENT_CLASSES[tone ?? "blue"];
}
