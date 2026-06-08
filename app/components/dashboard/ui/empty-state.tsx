import type { CSSProperties, ReactNode } from "react";
import { DashboardCard } from "./card";
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "./tokens";

type DashboardEmptyStateTone = "neutral" | "success" | "warning" | "danger";

export type DashboardEmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: DashboardEmptyStateTone;
};

export function DashboardEmptyState({
  title,
  description,
  icon,
  action,
  tone = "neutral",
}: DashboardEmptyStateProps) {
  const toneStyle = toneStyles[tone];

  return (
    <DashboardCard tone="soft" padding="lg" style={rootStyle}>
      <div
        style={{
          ...iconWrapStyle,
          color: toneStyle.color,
          background: toneStyle.background,
          borderColor: toneStyle.border,
        }}
      >
        {icon ?? <span style={defaultDotStyle} />}
      </div>

      <h3 style={titleStyle}>{title}</h3>
      {description ? <p style={descriptionStyle}>{description}</p> : null}
      {action ? <div style={actionStyle}>{action}</div> : null}
    </DashboardCard>
  );
}

const rootStyle: CSSProperties = {
  textAlign: "center",
  borderStyle: "dashed",
};

const iconWrapStyle: CSSProperties = {
  width: 54,
  height: 54,
  margin: "0 auto 18px",
  borderRadius: dashboardRadii.full,
  border: "1px solid",
  display: "grid",
  placeItems: "center",
};

const defaultDotStyle: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: dashboardRadii.full,
  background: "currentColor",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: dashboardColors.text.primary,
  fontSize: dashboardTypography.size.xl,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.black,
};

const descriptionStyle: CSSProperties = {
  margin: "12px auto 0",
  maxWidth: 620,
  color: dashboardColors.text.muted,
  fontSize: dashboardTypography.size.md,
  lineHeight: dashboardTypography.lineHeight.relaxed,
  fontWeight: dashboardTypography.weight.medium,
};

const actionStyle: CSSProperties = {
  marginTop: dashboardSpacing[5],
  display: "flex",
  justifyContent: "center",
};

const toneStyles: Record<
  DashboardEmptyStateTone,
  { color: string; background: string; border: string }
> = {
  neutral: {
    color: dashboardColors.primary[600],
    background: dashboardColors.primary[50],
    border: "rgba(191, 219, 254, 0.9)",
  },
  success: {
    color: dashboardColors.status.green,
    background: dashboardColors.status.greenSoft,
    border: "rgba(187, 247, 208, 0.9)",
  },
  warning: {
    color: dashboardColors.status.amber,
    background: dashboardColors.status.amberSoft,
    border: "rgba(253, 230, 138, 0.9)",
  },
  danger: {
    color: dashboardColors.status.red,
    background: dashboardColors.status.redSoft,
    border: "rgba(254, 202, 202, 0.9)",
  },
};
