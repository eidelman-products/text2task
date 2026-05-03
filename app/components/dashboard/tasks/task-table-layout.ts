import type { CSSProperties } from "react";

export const taskTableGridColumns =
  "42px minmax(360px, 1.95fr) minmax(122px, 0.58fr) minmax(182px, 0.82fr) minmax(132px, 0.58fr) minmax(132px, 0.58fr) minmax(156px, 0.74fr)";

export const taskTableMinWidth = 1160;

export const desktopTableStyle: CSSProperties = {
  border: "1px solid rgba(226,232,240,0.98)",
  borderRadius: 26,
  overflowX: "auto",
  overflowY: "visible",
  background:
    "linear-gradient(180deg, rgba(244,247,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
  boxShadow:
    "0 18px 42px rgba(15,23,42,0.07), 0 4px 14px rgba(15,23,42,0.03)",
  padding: 14,
};

export const desktopHeaderRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: taskTableGridColumns,
  minWidth: taskTableMinWidth,
  padding: "14px 16px",
  borderRadius: 18,
  background:
    "linear-gradient(180deg, rgba(255,247,237,1) 0%, rgba(255,251,235,0.98) 100%)",
  border: "1px solid rgba(245,158,11,0.18)",
  color: "#9a3412",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.01em",
  alignItems: "center",
  gap: 10,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.7), 0 4px 10px rgba(245,158,11,0.04)",
};

export const headerCellStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
};