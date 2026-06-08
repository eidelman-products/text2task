import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "./tokens";

type DashboardBadgeVariant =
  | "neutral"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "purple";

type DashboardBadgeSize = "sm" | "md";

export type DashboardBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: DashboardBadgeVariant;
  size?: DashboardBadgeSize;
  children: ReactNode;
};

export function DashboardBadge({
  variant = "neutral",
  size = "md",
  style,
  children,
  ...props
}: DashboardBadgeProps) {
  return (
    <span
      {...props}
      style={{
        ...baseStyle,
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}

const baseStyle: CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: dashboardSpacing[1],
  borderRadius: dashboardRadii.full,
  border: "1px solid transparent",
  fontWeight: dashboardTypography.weight.black,
  lineHeight: 1,
  whiteSpace: "nowrap",
};

const sizeStyles: Record<DashboardBadgeSize, CSSProperties> = {
  sm: {
    minHeight: 22,
    padding: "0 8px",
    fontSize: dashboardTypography.size.xs,
  },
  md: {
    minHeight: 28,
    padding: "0 10px",
    fontSize: dashboardTypography.size.sm,
  },
};

const variantStyles: Record<DashboardBadgeVariant, CSSProperties> = {
  neutral: {
    color: dashboardColors.text.secondary,
    background: dashboardColors.background.surfaceMuted,
    borderColor: dashboardColors.border.subtle,
  },
  blue: {
    color: dashboardColors.primary[700],
    background: dashboardColors.primary[50],
    borderColor: "rgba(191, 219, 254, 0.9)",
  },
  green: {
    color: dashboardColors.status.green,
    background: dashboardColors.status.greenSoft,
    borderColor: "rgba(187, 247, 208, 0.9)",
  },
  amber: {
    color: dashboardColors.status.amber,
    background: dashboardColors.status.amberSoft,
    borderColor: "rgba(253, 230, 138, 0.9)",
  },
  red: {
    color: dashboardColors.status.red,
    background: dashboardColors.status.redSoft,
    borderColor: "rgba(254, 202, 202, 0.9)",
  },
  purple: {
    color: dashboardColors.accent.purple,
    background: dashboardColors.accent.softPurple,
    borderColor: "rgba(221, 214, 254, 0.9)",
  },
};
