import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import {
  dashboardColors,
  dashboardRadii,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
} from "./tokens";
import { surfaceBase } from "./styles";

type DashboardCardTone = "default" | "soft" | "elevated";
type DashboardCardPadding = "sm" | "md" | "lg" | "none";

export type DashboardCardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: DashboardCardTone;
  padding?: DashboardCardPadding;
};

export function DashboardCard({
  tone = "default",
  padding = "md",
  style,
  children,
  ...props
}: DashboardCardProps) {
  return (
    <div
      {...props}
      style={{
        ...cardToneStyles[tone],
        padding: cardPadding[padding],
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type DashboardSectionProps = DashboardCardProps & {
  title?: string;
  description?: string;
  rightSlot?: ReactNode;
};

export function DashboardSection({
  title,
  description,
  rightSlot,
  children,
  ...props
}: DashboardSectionProps) {
  return (
    <DashboardCard {...props}>
      {(title || description || rightSlot) && (
        <DashboardSurfaceHeader
          title={title}
          description={description}
          rightSlot={rightSlot}
        />
      )}
      {children}
    </DashboardCard>
  );
}

export function DashboardSurfaceHeader({
  title,
  description,
  rightSlot,
  style,
}: {
  title?: string;
  description?: string;
  rightSlot?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ ...headerStyle, ...style }}>
      <div style={headerCopyStyle}>
        {title ? <h2 style={titleStyle}>{title}</h2> : null}
        {description ? <p style={descriptionStyle}>{description}</p> : null}
      </div>
      {rightSlot ? <div style={rightSlotStyle}>{rightSlot}</div> : null}
    </div>
  );
}

const cardPadding: Record<DashboardCardPadding, CSSProperties["padding"]> = {
  none: 0,
  sm: dashboardSpacing[4],
  md: dashboardSpacing[6],
  lg: dashboardSpacing[8],
};

const cardToneStyles: Record<DashboardCardTone, CSSProperties> = {
  default: surfaceBase,
  soft: {
    ...surfaceBase,
    background: dashboardColors.background.surfaceSoft,
    boxShadow: dashboardShadows.xs,
  },
  elevated: {
    ...surfaceBase,
    borderRadius: dashboardRadii["3xl"],
    boxShadow: dashboardShadows.md,
  },
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: dashboardSpacing[4],
  marginBottom: dashboardSpacing[5],
};

const headerCopyStyle: CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[2],
  minWidth: 0,
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: dashboardColors.text.primary,
  fontSize: dashboardTypography.size.xl,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.black,
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: dashboardColors.text.muted,
  fontSize: dashboardTypography.size.md,
  lineHeight: dashboardTypography.lineHeight.relaxed,
  fontWeight: dashboardTypography.weight.medium,
};

const rightSlotStyle: CSSProperties = {
  flexShrink: 0,
};
