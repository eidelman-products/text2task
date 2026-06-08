import type {
  ButtonHTMLAttributes,
  CSSProperties,
  ReactNode,
} from "react";
import {
  dashboardColors,
  dashboardRadii,
  dashboardShadows,
  dashboardSpacing,
  dashboardTransitions,
  dashboardTypography,
} from "./tokens";

type DashboardButtonVariant =
  | "primary"
  | "secondary"
  | "soft"
  | "ghost"
  | "danger"
  | "icon";

type DashboardButtonSize = "sm" | "md" | "lg";

export type DashboardButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: DashboardButtonVariant;
    size?: DashboardButtonSize;
    fullWidth?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    loading?: boolean;
  };

export function DashboardButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  leftIcon,
  rightIcon,
  loading = false,
  disabled,
  children,
  style,
  type = "button",
  ...props
}: DashboardButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={{
        ...baseButtonStyle,
        ...sizeStyles[size],
        ...variantStyles[variant],
        width: fullWidth ? "100%" : variant === "icon" ? sizeStyles[size].height : undefined,
        opacity: isDisabled ? 0.62 : 1,
        cursor: isDisabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {loading ? <span aria-hidden="true" style={spinnerStyle} /> : leftIcon}
      {variant !== "icon" ? <span style={labelStyle}>{children}</span> : children}
      {rightIcon}
    </button>
  );
}

const baseButtonStyle: CSSProperties = {
  appearance: "none",
  border: "1px solid transparent",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: dashboardSpacing[2],
  borderRadius: dashboardRadii.lg,
  fontFamily: dashboardTypography.fontFamily,
  fontWeight: dashboardTypography.weight.bold,
  lineHeight: 1,
  whiteSpace: "nowrap",
  userSelect: "none",
  transition: dashboardTransitions.interactive,
};

const sizeStyles: Record<DashboardButtonSize, CSSProperties> = {
  sm: {
    minHeight: 34,
    height: 34,
    padding: "0 12px",
    fontSize: dashboardTypography.size.sm,
  },
  md: {
    minHeight: 42,
    height: 42,
    padding: "0 16px",
    fontSize: dashboardTypography.size.md,
  },
  lg: {
    minHeight: 48,
    height: 48,
    padding: "0 20px",
    fontSize: dashboardTypography.size.md,
  },
};

const variantStyles: Record<DashboardButtonVariant, CSSProperties> = {
  primary: {
    color: dashboardColors.text.inverse,
    background: `linear-gradient(135deg, ${dashboardColors.primary[600]} 0%, ${dashboardColors.primary[500]} 100%)`,
    boxShadow: dashboardShadows.primary,
  },
  secondary: {
    color: dashboardColors.primary[700],
    background: dashboardColors.background.surface,
    borderColor: dashboardColors.primary[100],
    boxShadow: dashboardShadows.xs,
  },
  soft: {
    color: dashboardColors.primary[700],
    background: dashboardColors.primary[50],
    borderColor: "rgba(191, 219, 254, 0.82)",
  },
  ghost: {
    color: dashboardColors.text.secondary,
    background: "transparent",
    borderColor: "transparent",
  },
  danger: {
    color: dashboardColors.status.red,
    background: dashboardColors.status.redSoft,
    borderColor: "rgba(254, 202, 202, 0.92)",
  },
  icon: {
    color: dashboardColors.text.secondary,
    background: dashboardColors.background.surface,
    borderColor: dashboardColors.border.subtle,
    padding: 0,
    boxShadow: dashboardShadows.xs,
  },
};

const labelStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const spinnerStyle: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: dashboardRadii.full,
  border: "2px solid rgba(255,255,255,0.45)",
  borderTopColor: "#ffffff",
};
