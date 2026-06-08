import type { CSSProperties } from "react";

const ACCENT_COLOR = "#2563eb";

export const historyOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  background: "rgba(15, 23, 42, 0.44)",
  backdropFilter: "blur(3px)",
};

export const historyModalStyle: CSSProperties = {
  width: "min(1120px, 96vw)",
  maxHeight: "92vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  borderRadius: 24,
  border: "1px solid rgba(203, 213, 225, 0.7)",
  background: "#ffffff",
  boxShadow:
    "0 24px 64px rgba(15, 23, 42, 0.16), 0 4px 14px rgba(15, 23, 42, 0.05)",
};

export const historyHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  padding: "18px 22px 15px",
  borderBottom: "1px solid rgba(226, 232, 240, 0.72)",
  background: "rgba(255, 255, 255, 0.98)",
};

export const historyHeaderLeftStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 11,
  minWidth: 0,
};

export const historyHeaderIconStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  background: "rgba(239, 246, 255, 0.92)",
  border: "1px solid rgba(191, 219, 254, 0.72)",
  color: ACCENT_COLOR,
  fontSize: 16,
  fontWeight: 950,
  boxShadow: "none",
};

export const historyTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1.15,
  letterSpacing: "0",
};

export const historySubtitleStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 650,
};

export const historyCloseButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: "1px solid rgba(226, 232, 240, 0.82)",
  background: "#ffffff",
  color: "#64748b",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
};

export const historyContentStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "14px 20px 20px",
  overflowY: "auto",
  background: "#f8fafc",
};

export const summaryStripStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 0,
  padding: "7px 0 0",
  borderRadius: 0,
  border: "none",
  background: "transparent",
  boxShadow: "none",
};

export const summaryMetricStyle: CSSProperties = {
  minWidth: 0,
  display: "inline-flex",
  alignItems: "baseline",
  gap: 4,
  padding: 0,
  borderRadius: 0,
  border: "none",
  background: "transparent",
};

export const summaryMetricValueStyle: CSSProperties = {
  color: "#334155",
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.4,
};

export const summaryMetricLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 650,
  textTransform: "none",
  letterSpacing: "0",
};

export const projectContextStripStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "4px 2px 13px",
  borderRadius: 0,
  border: "none",
  borderBottom: "1px solid rgba(226, 232, 240, 0.72)",
  background: "transparent",
};

export const projectContextStatStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 0,
  minWidth: 0,
  padding: 0,
  borderRadius: 0,
  border: "none",
  background: "transparent",
};

export const projectContextLabelStyle: CSSProperties = {
  color: ACCENT_COLOR,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

export const projectContextValueStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.25,
};

export const projectSummaryTitleStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  flexWrap: "wrap",
  gap: 0,
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 850,
  lineHeight: 1.35,
};

export const projectSummaryClientStyle: CSSProperties = {
  color: "#475569",
  fontWeight: 750,
};

export const projectSummaryMetaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 0,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 650,
  lineHeight: 1.5,
};

export const summarySeparatorStyle: CSSProperties = {
  display: "inline-block",
  padding: "0 7px",
  color: "#cbd5e1",
  fontWeight: 700,
};

export const historyToolbarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "2px 2px 0",
};

export const historyCountStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 750,
};

export const refreshButtonStyle: CSSProperties = {
  minHeight: 34,
  padding: "0 11px",
  borderRadius: 9,
  border: "1px solid rgba(191, 219, 254, 0.72)",
  background: "#ffffff",
  color: ACCENT_COLOR,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
};

export const historyListStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  paddingTop: 2,
};

export const timelineEntryStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "22px minmax(0, 1fr)",
  gap: 8,
  alignItems: "stretch",
};

export const timelineRailStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "16px 1fr",
  justifyItems: "center",
  paddingTop: 16,
};

export const timelineDotStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 999,
  border: "2px solid #ffffff",
};

export const timelineLineStyle: CSSProperties = {
  width: 1,
  minHeight: 18,
  background: "rgba(203, 213, 225, 0.62)",
};

export const updateCardStyle: CSSProperties = {
  display: "grid",
  gap: 9,
  padding: "12px 12px 13px",
  marginBottom: 6,
  borderRadius: 10,
  border: "none",
  borderBottom: "1px solid rgba(226, 232, 240, 0.62)",
  background: "rgba(255, 255, 255, 0.58)",
  boxShadow: "none",
};

export const updateCardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
};

export const updateMetaStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 5,
  alignItems: "center",
};

export const sourceBadgeStyle: CSSProperties = {
  padding: "4px 7px",
  borderRadius: 999,
  border: "1px solid rgba(191, 219, 254, 0.66)",
  background: "rgba(239, 246, 255, 0.78)",
  color: ACCENT_COLOR,
  fontSize: 11,
  fontWeight: 800,
};

export const statusBadgeStyle: CSSProperties = {
  padding: "4px 7px",
  borderRadius: 999,
  border: "1px solid rgba(226, 232, 240, 0.76)",
  background: "rgba(248, 250, 252, 0.86)",
  color: "#334155",
  fontSize: 11,
  fontWeight: 800,
};

export const updateDateStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

export const rawInputStyle: CSSProperties = {
  margin: 0,
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 650,
  padding: "6px 10px",
  borderRadius: 0,
  borderLeft: "2px solid rgba(147, 197, 253, 0.72)",
  background: "transparent",
  fontStyle: "italic",
};

export const summaryRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

export const summaryPillStyle: CSSProperties = {
  padding: 0,
  borderRadius: 0,
  background: "transparent",
  border: "none",
  color: "#475569",
  fontSize: 11,
  fontWeight: 750,
};

export const detailsToggleButtonStyle: CSSProperties = {
  justifySelf: "start",
  minHeight: 30,
  padding: "0 2px",
  borderRadius: 0,
  border: "none",
  background: "transparent",
  color: ACCENT_COLOR,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

export const itemListStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  paddingTop: 3,
  borderTop: "1px solid rgba(226, 232, 240, 0.46)",
};

export const itemCardStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "9px 2px",
  borderRadius: 0,
  border: "none",
  borderBottom: "1px solid rgba(226, 232, 240, 0.36)",
  background: "transparent",
};

export const itemHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 8,
};

export const itemBadgesStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 5,
};

export const itemTypeBadgeStyle: CSSProperties = {
  padding: "3px 7px",
  borderRadius: 999,
  background: "rgba(239, 246, 255, 0.72)",
  border: "1px solid rgba(191, 219, 254, 0.6)",
  color: ACCENT_COLOR,
  fontSize: 10,
  fontWeight: 800,
};

export const itemStatusBadgeStyle: CSSProperties = {
  padding: "3px 7px",
  borderRadius: 999,
  background: "rgba(248,250,252,0.88)",
  border: "1px solid rgba(226,232,240,0.78)",
  color: "#475569",
  fontSize: 10,
  fontWeight: 800,
};

export const itemTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 850,
  lineHeight: 1.3,
};

export const itemDescriptionStyle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 650,
};

export const valueRowsStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  padding: "2px 0 0",
  borderRadius: 0,
  border: "none",
  background: "transparent",
};

export const valueRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "110px minmax(0, 1fr)",
  gap: 10,
  padding: "4px 0",
  borderBottom: "1px solid rgba(226, 232, 240, 0.3)",
};

export const valueLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 750,
};

export const valueTextStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 750,
  lineHeight: 1.35,
};

export const statePanelStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 7,
  padding: "34px 18px",
  borderRadius: 14,
  border: "1px solid rgba(226, 232, 240, 0.72)",
  background: "#ffffff",
  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.03)",
  textAlign: "center",
};

export const stateIconStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  background: "rgba(239, 246, 255, 0.8)",
  border: "1px solid rgba(191, 219, 254, 0.66)",
  color: ACCENT_COLOR,
  fontSize: 13,
  fontWeight: 850,
};

export const stateTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 850,
};

export const stateTextStyle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 650,
  maxWidth: 360,
};

export const historyButtonStyle: CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 34,
  padding: "0 11px",
  borderRadius: 9,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(203, 213, 225, 0.68)",
  background: "#ffffff",
  color: "#1d4ed8",
  fontSize: 11.5,
  fontWeight: 800,
  boxShadow: "none",
  transition:
    "background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease",
  cursor: "pointer",
};

export const historyButtonHoverStyle: CSSProperties = {
  ...historyButtonStyle,
  background: "rgba(239, 246, 255, 0.88)",
  borderColor: "rgba(37, 99, 235, 0.3)",
  color: "#1d4ed8",
  transform: "translateY(-1px)",
};

export const historyButtonDisabledStyle: CSSProperties = {
  ...historyButtonStyle,
  opacity: 0.55,
  cursor: "not-allowed",
};
