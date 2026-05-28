import type { CSSProperties } from "react";

const ACCENT_COLOR = "#4338ca";

export const historyOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  background: "rgba(15, 23, 42, 0.52)",
  backdropFilter: "blur(7px)",
};

export const historyModalStyle: CSSProperties = {
  width: "min(1120px, 96vw)",
  maxHeight: "92vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  borderRadius: 30,
  border: "1px solid rgba(226, 232, 240, 0.92)",
  background:
    "radial-gradient(circle at 95% 0%, rgba(224,231,255,0.94), transparent 34%),"
    + " linear-gradient(135deg, rgba(255,255,255,0.99), rgba(248,250,252,0.96))",
  boxShadow: "0 26px 56px rgba(15, 23, 42, 0.18), 0 6px 18px rgba(15, 23, 42, 0.08)",
};

export const historyHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  padding: "20px 24px 16px",
  borderBottom: "1px solid rgba(226, 232, 240, 0.74)",
};

export const historyHeaderLeftStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  minWidth: 0,
};

export const historyHeaderIconStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  background: "rgba(238, 242, 255, 0.96)",
  border: "1px solid rgba(199, 210, 254, 0.88)",
  color: ACCENT_COLOR,
  fontSize: 16,
  fontWeight: 950,
  boxShadow: "0 12px 26px rgba(67, 56, 202, 0.09)",
};

export const historyTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 26,
  fontWeight: 950,
  lineHeight: 1.1,
  letterSpacing: "-0.04em",
};

export const historySubtitleStyle: CSSProperties = {
  margin: "7px 0 0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 720,
};

export const historyCloseButtonStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 14,
  border: "1px solid rgba(226, 232, 240, 0.92)",
  background: "rgba(255,255,255,0.92)",
  color: "#64748b",
  fontSize: 22,
  lineHeight: 1,
  cursor: "pointer",
};

export const historyContentStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  padding: "16px 20px 20px",
  overflowY: "auto",
};

export const summaryStripStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  padding: 10,
  borderRadius: 20,
  border: "1px solid rgba(199, 210, 254, 0.42)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(248,250,252,0.72))",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.035), inset 0 1px 0 rgba(255,255,255,0.82)",
};

export const summaryMetricStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 3,
  padding: "10px 12px",
  borderRadius: 15,
  border: "1px solid rgba(226, 232, 240, 0.72)",
  background: "rgba(255,255,255,0.68)",
};

export const summaryMetricValueStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 950,
  lineHeight: 1.12,
};

export const summaryMetricLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 850,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export const projectContextStripStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
  gap: 10,
  padding: 12,
  borderRadius: 18,
  border: "1px solid rgba(226, 232, 240, 0.78)",
  background: "rgba(255, 255, 255, 0.78)",
};

export const projectContextStatStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(226, 232, 240, 0.82)",
  background: "rgba(248,250,252,0.82)",
};

export const projectContextLabelStyle: CSSProperties = {
  color: ACCENT_COLOR,
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

export const projectContextValueStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1.25,
};

export const historyToolbarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

export const historyCountStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 820,
};

export const refreshButtonStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(199, 210, 254, 0.62)",
  background: "rgba(255,255,255,0.8)",
  color: ACCENT_COLOR,
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

export const historyListStyle: CSSProperties = {
  display: "grid",
  gap: 0,
};

export const timelineEntryStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "26px minmax(0, 1fr)",
  gap: 10,
  alignItems: "stretch",
};

export const timelineRailStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "18px 1fr",
  justifyItems: "center",
  paddingTop: 17,
};

export const timelineDotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  border: "2px solid rgba(255,255,255,0.95)",
};

export const timelineLineStyle: CSSProperties = {
  width: 1,
  minHeight: 18,
  background: "linear-gradient(180deg, rgba(203,213,225,0.92), rgba(203,213,225,0.18))",
};

export const updateCardStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 15,
  marginBottom: 12,
  borderRadius: 20,
  border: "1px solid rgba(226, 232, 240, 0.86)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.82))",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
};

export const updateCardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

export const updateMetaStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  alignItems: "center",
};

export const sourceBadgeStyle: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  border: "1px solid rgba(199, 210, 254, 0.65)",
  background: "rgba(238,242,255,0.7)",
  color: ACCENT_COLOR,
  fontSize: 11,
  fontWeight: 920,
};

export const statusBadgeStyle: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  border: "1px solid rgba(226, 232, 240, 0.76)",
  background: "rgba(255,255,255,0.76)",
  color: "#334155",
  fontSize: 11,
  fontWeight: 900,
};

export const updateDateStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 780,
  whiteSpace: "nowrap",
};

export const rawInputStyle: CSSProperties = {
  margin: 0,
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 720,
};

export const summaryRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 7,
};

export const summaryPillStyle: CSSProperties = {
  padding: "5px 9px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.72)",
  border: "1px solid rgba(226,232,240,0.72)",
  color: "#475569",
  fontSize: 11,
  fontWeight: 850,
};

export const detailsToggleButtonStyle: CSSProperties = {
  justifySelf: "start",
  padding: "7px 10px",
  borderRadius: 999,
  border: "1px solid rgba(199, 210, 254, 0.58)",
  background: "rgba(255,255,255,0.78)",
  color: ACCENT_COLOR,
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

export const itemListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

export const itemCardStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  padding: 11,
  borderRadius: 15,
  border: "1px solid rgba(226, 232, 240, 0.78)",
  background: "rgba(255,255,255,0.72)",
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
  padding: "4px 7px",
  borderRadius: 999,
  background: "rgba(238,242,255,0.7)",
  border: "1px solid rgba(199,210,254,0.62)",
  color: ACCENT_COLOR,
  fontSize: 10,
  fontWeight: 920,
};

export const itemStatusBadgeStyle: CSSProperties = {
  padding: "4px 7px",
  borderRadius: 999,
  background: "rgba(248,250,252,0.88)",
  border: "1px solid rgba(226,232,240,0.78)",
  color: "#475569",
  fontSize: 10,
  fontWeight: 900,
};

export const itemTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 930,
  lineHeight: 1.3,
};

export const itemDescriptionStyle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 720,
};

export const valueRowsStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  padding: "7px 8px",
  borderRadius: 12,
  border: "1px solid rgba(226,232,240,0.68)",
  background: "rgba(248,250,252,0.72)",
};

export const valueRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px minmax(0, 1fr)",
  gap: 8,
};

export const valueLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 860,
};

export const valueTextStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 820,
  lineHeight: 1.35,
};

export const statePanelStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 8,
  padding: "36px 18px",
  borderRadius: 20,
  border: "1px solid rgba(199,210,254,0.46)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(248,250,252,0.72))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.82)",
  textAlign: "center",
};

export const stateIconStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "rgba(238,242,255,0.82)",
  border: "1px solid rgba(199,210,254,0.76)",
  color: ACCENT_COLOR,
  fontSize: 13,
  fontWeight: 950,
};

export const stateTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 940,
};

export const stateTextStyle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 720,
  maxWidth: 360,
};

export const historyButtonStyle: CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 26,
  padding: "0 9px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(226,232,240,0.68)",
  background: "rgba(255,255,255,0.72)",
  color: "#475569",
  fontSize: 11,
  fontWeight: 900,
  transition: "all 0.18s ease",
  cursor: "pointer",
};

export const historyButtonHoverStyle: CSSProperties = {
  ...historyButtonStyle,
  background: "rgba(238,242,255,0.66)",
  borderColor: "rgba(199,210,254,0.78)",
  color: ACCENT_COLOR,
};

export const historyButtonDisabledStyle: CSSProperties = {
  ...historyButtonStyle,
  opacity: 0.55,
  cursor: "not-allowed",
};
