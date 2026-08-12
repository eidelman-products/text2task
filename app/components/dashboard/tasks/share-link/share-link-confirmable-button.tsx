"use client";

import type { CSSProperties } from "react";

import { DashboardButton } from "../../ui/button";
import { row, stack } from "../../ui/styles";
import { dashboardColors, dashboardTypography } from "../../ui/tokens";

/**
 * Shared two-step confirm control: a single button that, on first click,
 * reveals an explicit confirm/cancel pair (optionally preceded by a
 * warning line) rather than acting immediately. Originally local to
 * share-link-panel.tsx (Phase 2A's Disable/Revoke); extracted here so
 * Phase 2C's Remove PIN, Remove expiry and Rotate can reuse the exact
 * same destructive-confirmation pattern instead of inventing a second
 * modal/confirmation system.
 */
export type ConfirmableActionButtonProps = {
  label: string;
  confirmLabel: string;
  isConfirming: boolean;
  loading: boolean;
  disabled: boolean;
  variant: "secondary" | "danger";
  onClick: () => void;
  onCancel: () => void;
  warning?: string;
};

export function ConfirmableActionButton({
  label,
  confirmLabel,
  isConfirming,
  loading,
  disabled,
  variant,
  onClick,
  onCancel,
  warning,
}: ConfirmableActionButtonProps) {
  if (!isConfirming) {
    return (
      <DashboardButton variant={variant} onClick={onClick} disabled={disabled}>
        {label}
      </DashboardButton>
    );
  }

  return (
    <div style={stack(2)}>
      {warning ? <p style={warningTextStyle}>{warning}</p> : null}
      <div style={row(2)}>
        <DashboardButton
          variant={variant}
          onClick={onClick}
          loading={loading}
          disabled={disabled}
        >
          {confirmLabel}
        </DashboardButton>
        <DashboardButton variant="ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </DashboardButton>
      </div>
    </div>
  );
}

const warningTextStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.status.amber,
};
