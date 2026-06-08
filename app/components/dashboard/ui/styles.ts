import type { CSSProperties } from "react";
import {
  dashboardColors,
  dashboardRadii,
  dashboardShadows,
  dashboardSpacing,
  dashboardTransitions,
  dashboardTypography,
  dashboardZIndex,
} from "./tokens";

export const focusRing: CSSProperties = {
  outline: `3px solid ${dashboardColors.border.focus}`,
  outlineOffset: 3,
};

export const truncate: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export const surfaceBase: CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.94) 100%)",
  border: `1px solid ${dashboardColors.border.subtle}`,
  borderRadius: dashboardRadii["2xl"],
  boxShadow: `${dashboardShadows.sm}, ${dashboardShadows.inset}`,
};

export const interactiveBase: CSSProperties = {
  cursor: "pointer",
  transition: dashboardTransitions.interactive,
};

export const modalBackdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: dashboardZIndex.overlay,
  background: dashboardColors.background.overlay,
  backdropFilter: "blur(12px)",
};

export const modalPanel: CSSProperties = {
  ...surfaceBase,
  position: "relative",
  zIndex: dashboardZIndex.modal,
  width: "min(960px, calc(100vw - 32px))",
  maxHeight: "calc(100vh - 32px)",
  overflow: "hidden",
  borderRadius: dashboardRadii["3xl"],
  boxShadow: dashboardShadows.lg,
};

export const pageContent: CSSProperties = {
  width: "100%",
  maxWidth: 1440,
  minWidth: 0,
};

export function stack(gap: keyof typeof dashboardSpacing = 4): CSSProperties {
  return {
    display: "grid",
    gap: dashboardSpacing[gap],
  };
}

export function row(
  gap: keyof typeof dashboardSpacing = 3,
  alignItems: CSSProperties["alignItems"] = "center"
): CSSProperties {
  return {
    display: "flex",
    alignItems,
    gap: dashboardSpacing[gap],
    minWidth: 0,
  };
}

export const fieldLabel: CSSProperties = {
  color: dashboardColors.text.muted,
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export const inputBase: CSSProperties = {
  width: "100%",
  minWidth: 0,
  border: `1px solid ${dashboardColors.border.default}`,
  borderRadius: dashboardRadii.lg,
  background: dashboardColors.background.surface,
  color: dashboardColors.text.primary,
  padding: "11px 13px",
  fontSize: dashboardTypography.size.md,
  fontWeight: dashboardTypography.weight.medium,
  transition: dashboardTransitions.interactive,
};
