import type { CSSProperties } from "react";

const indigo = "#2563eb";
const indigoDark = "#1d4ed8";
const slate900 = "#0f172a";
const slate700 = "#334155";
const slate600 = "#475569";
const slate500 = "#64748b";

export const responsiveClassNames = {
  overlay: "project-update-modal-overlay",
  modal: "project-update-modal-shell",
  header: "project-update-modal-header",
  body: "project-update-modal-body",
  mainGrid: "project-update-modal-grid",
  inputCard: "project-update-input-card",
  inputTabs: "project-update-input-tabs",
  imagePreview: "project-update-image-preview",
  reviewCard: "project-update-review-card",
  reviewSummary: "project-update-review-summary",
  reviewItemHeader: "project-update-review-item-header",
  reviewFields: "project-update-review-fields",
  footer: "project-update-modal-footer",
} as const;

export const responsiveCss = `
  @media (max-width: 760px) {
    .${responsiveClassNames.overlay} {
      padding: 12px !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(15, 23, 42, 0.42) !important;
      backdrop-filter: none !important;
    }

    .${responsiveClassNames.modal} {
      width: calc(100vw - 24px) !important;
      max-width: calc(100vw - 24px) !important;
      max-height: calc(100dvh - 24px) !important;
      min-width: 0 !important;
      border-radius: 20px !important;
    }

    .${responsiveClassNames.header} {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      padding: 15px 16px 12px !important;
      box-sizing: border-box !important;
    }

    .${responsiveClassNames.header} > * {
      min-width: 0 !important;
    }

    .${responsiveClassNames.body} {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      padding: 14px !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      box-sizing: border-box !important;
    }

    .${responsiveClassNames.mainGrid} {
      width: 100% !important;
      max-width: 100% !important;
    }

    .${responsiveClassNames.mainGrid} > * {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
    }

    .${responsiveClassNames.inputCard},
    .${responsiveClassNames.reviewCard} {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
    }

    .${responsiveClassNames.inputCard} {
      padding: 14px !important;
    }

    .${responsiveClassNames.reviewCard} {
      padding: 15px !important;
    }

    .${responsiveClassNames.inputTabs} {
      width: 100% !important;
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      overflow: visible !important;
    }

    .${responsiveClassNames.inputTabs} > button {
      width: 100% !important;
      min-width: 0 !important;
      padding-left: 9px !important;
      padding-right: 9px !important;
    }

    .${responsiveClassNames.imagePreview} {
      --project-update-image-preview-columns: minmax(0, 1fr);
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
    }

    .${responsiveClassNames.imagePreview} > * {
      min-width: 0 !important;
      max-width: 100% !important;
    }

    .${responsiveClassNames.reviewSummary} {
      align-items: flex-start !important;
      flex-wrap: wrap !important;
    }

    .${responsiveClassNames.reviewItemHeader} {
      --project-update-review-item-header-columns: minmax(0, 1fr);
    }

    .${responsiveClassNames.reviewFields} {
      --project-update-review-field-columns: minmax(0, 1fr);
    }

    .${responsiveClassNames.footer} {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
      padding: 12px 14px 14px !important;
      box-sizing: border-box !important;
    }

    .${responsiveClassNames.footer} > button {
      width: 100% !important;
      min-width: 0 !important;
      padding-left: 12px !important;
      padding-right: 12px !important;
    }
  }

  @media (max-width: 380px) {
    .${responsiveClassNames.inputTabs},
    .${responsiveClassNames.footer} {
      grid-template-columns: minmax(0, 1fr) !important;
    }
  }
`;

export const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  background: "rgba(15, 23, 42, 0.42)",
  backdropFilter: "blur(8px)",
  overflow: "hidden",
  boxSizing: "border-box",
};

export const modal: CSSProperties = {
  width: "min(1240px, calc(100vw - 36px))",
  maxHeight: "calc(100dvh - 36px)",
  display: "flex",
  flexDirection: "column",
  borderRadius: 28,
  border: "1px solid rgba(191,219,254,0.78)",
  background:
    "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  boxShadow:
    "0 30px 90px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.96)",
  overflow: "hidden",
  boxSizing: "border-box",
};

export const header: CSSProperties = {
  flex: "0 0 auto",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 14,
  padding: "17px 24px 13px",
  borderBottom: "1px solid rgba(226,232,240,0.84)",
  background: "#ffffff",
};

export const headerMain: CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
};

export const headerIcon: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 18,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  background:
    "linear-gradient(135deg, rgba(239,246,255,0.98), rgba(255,255,255,0.98))",
  border: "1px solid rgba(191,219,254,0.9)",
  color: indigo,
  boxShadow:
    "0 10px 22px rgba(37,99,235,0.07), inset 0 1px 0 rgba(255,255,255,0.92)",
  fontSize: 20,
  fontWeight: 950,
};

export const headerCopy: CSSProperties = {
  minWidth: 0,
};

export const eyebrow: CSSProperties = {
  color: indigo,
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

export const title: CSSProperties = {
  margin: "4px 0 0",
  color: slate900,
  fontSize: 30,
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: "-0.052em",
};

export const subtitle: CSSProperties = {
  margin: "7px 0 0",
  color: slate600,
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 720,
};

export const headerContextLine: CSSProperties = {
  marginTop: 8,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  maxWidth: "100%",
  padding: "7px 11px",
  borderRadius: 999,
  border: "1px solid rgba(191,219,254,0.72)",
  background: "rgba(239,246,255,0.48)",
  color: "#475569",
  fontSize: 12,
  lineHeight: 1.2,
  fontWeight: 850,
  boxShadow: "none",
};

export const closeButton: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 14,
  border: "1px solid rgba(226,232,240,0.9)",
  background: "#ffffff",
  color: slate500,
  fontSize: 23,
  lineHeight: 1,
  cursor: "pointer",
  flexShrink: 0,
  boxShadow: "0 8px 18px rgba(15,23,42,0.055)",
};

export const body: CSSProperties = {
  flex: "1 1 auto",
  overflowY: "auto",
  overflowX: "hidden",
  padding: "18px 24px 22px",
  background: "#f8fafc",
  boxSizing: "border-box",
};

export const contextGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  gap: 9,
  marginBottom: 14,
};

export const contextPill: CSSProperties = {
  minWidth: 0,
  minHeight: 70,
  display: "grid",
  alignContent: "center",
  gap: 7,
  borderRadius: 16,
  border: "1px solid rgba(226, 232, 240, 0.68)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.88), rgba(248,250,252,0.78))",
  padding: "10px 12px",
  boxSizing: "border-box",
  boxShadow:
    "0 10px 22px rgba(15, 23, 42, 0.035), inset 0 1px 0 rgba(255,255,255,0.9)",
};

export const contextLabel: CSSProperties = {
  color: indigo,
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.11em",
};

export const contextValue: CSSProperties = {
  color: slate900,
  fontSize: 14,
  fontWeight: 950,
  lineHeight: 1.25,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

export const originalUpdate: CSSProperties = {
  display: "grid",
  gap: 5,
  marginBottom: 14,
  padding: "10px 12px",
  borderRadius: 16,
  border: "1px solid rgba(226, 232, 240, 0.76)",
  background: "rgba(255, 255, 255, 0.88)",
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.026)",
};

export const originalLabel: CSSProperties = {
  color: indigoDark,
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

export const originalText: CSSProperties = {
  margin: 0,
  color: slate600,
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 720,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

export const mainGrid: CSSProperties = {
  display: "grid",
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  minWidth: 0,
  alignItems: "start",
};

export const leftColumn: CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: 12,
  minWidth: 0,
};

export const rightColumn: CSSProperties = {
  minWidth: 0,
  borderRadius: 30,
  padding: 18,
  display: "grid",
  alignContent: "start",
  gap: 12,
  background:
    "radial-gradient(circle at 96% -6%, rgba(165,180,252,0.58), transparent 34%), radial-gradient(circle at 0% 100%, rgba(240,253,250,0.26), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,252,0.88))",
  boxShadow:
    "0 36px 86px rgba(15, 23, 42, 0.13), 0 22px 54px rgba(79,70,229,0.12), inset 0 1px 0 rgba(255,255,255,0.96)",
  boxSizing: "border-box",
};

export const card: CSSProperties = {
  display: "grid",
  gap: 12,
  borderRadius: 22,
  border: "1px solid rgba(226,232,240,0.88)",
  background: "#ffffff",
  padding: 17,
  boxShadow:
    "0 12px 28px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.9)",
  minWidth: 0,
  boxSizing: "border-box",
};

export const cardHeader: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  minWidth: 0,
};

export const cardIcon: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, rgba(239,246,255,0.98), rgba(255,255,255,0.98))",
  border: "1px solid rgba(191,219,254,0.86)",
  color: indigoDark,
  flexShrink: 0,
  fontWeight: 950,
  boxShadow: "0 8px 16px rgba(37,99,235,0.06)",
};

export const cardTitle: CSSProperties = {
  margin: 0,
  color: slate900,
  fontSize: 16,
  fontWeight: 950,
  letterSpacing: "-0.025em",
};

export const cardText: CSSProperties = {
  margin: "3px 0 0",
  color: slate500,
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 720,
};

export const tabs: CSSProperties = {
  display: "inline-flex",
  alignSelf: "flex-start",
  gap: 8,
  width: "fit-content",
  maxWidth: "100%",
  borderRadius: 999,
  border: "none",
  background: "transparent",
  padding: 0,
  overflow: "hidden",
  boxSizing: "border-box",
  boxShadow: "none",
};

export const tab: CSSProperties = {
  flex: "0 0 auto",
  minHeight: 36,
  borderRadius: 999,
  border: "1px solid rgba(203,213,225,0.78)",
  padding: "9px 15px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 850,
  cursor: "pointer",
  whiteSpace: "nowrap",
  background: "#ffffff",
  color: "#64748b",
  boxShadow: "none",
  transition:
    "transform 160ms ease, background 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease",
};

export const tabActive: CSSProperties = {
  color: "#1d4ed8",
  background: "rgba(239,246,255,0.82)",
  border: "1px solid rgba(147,197,253,0.9)",
  boxShadow: "0 8px 18px rgba(37,99,235,0.08)",
};

export const field: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

export const label: CSSProperties = {
  color: slate500,
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

export const textarea: CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: 134,
  borderRadius: 16,
  border: "1px solid rgba(203,213,225,0.92)",
  background: "#ffffff",
  color: slate900,
  fontSize: 13,
  fontWeight: 650,
  lineHeight: 1.55,
  outline: "none",
  boxSizing: "border-box",
  padding: "15px 16px",
  resize: "vertical",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
};

export const helperRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  color: slate600,
  fontSize: 11,
  lineHeight: 1.4,
  fontWeight: 850,
};

export const uploadBox: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 8,
  borderRadius: 18,
  border: "1.5px dashed rgba(147,197,253,0.72)",
  background: "rgba(239,246,255,0.44)",
  padding: "22px 14px",
  textAlign: "center",
  minWidth: 0,
  boxSizing: "border-box",
  cursor: "default",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.78)",
};

export const uploadIcon: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 15,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, rgba(239,246,255,1), rgba(219,234,254,0.86))",
  border: "1px solid rgba(191,219,254,0.9)",
  color: indigo,
  fontSize: 15,
  fontWeight: 950,
  boxShadow: "0 8px 16px rgba(37,99,235,0.07)",
};

export const uploadTitle: CSSProperties = {
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: slate900,
  fontSize: 13,
  fontWeight: 950,
};

export const uploadHelp: CSSProperties = {
  margin: 0,
  color: slate500,
  fontSize: 11,
  lineHeight: 1.45,
  fontWeight: 720,
};

export const smallButton: CSSProperties = {
  minHeight: 40,
  borderRadius: 14,
  border: "1px solid rgba(191,219,254,0.86)",
  background: "#ffffff",
  color: indigoDark,
  fontSize: 12,
  fontWeight: 930,
  padding: "0 13px",
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(37,99,235,0.065)",
};

export const imagePreview: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "var(--project-update-image-preview-columns, 160px minmax(0, 1fr))",
  gap: 14,
  alignItems: "stretch",
  borderRadius: 18,
  border: "1px solid rgba(226,232,240,0.86)",
  background: "#ffffff",
  padding: 13,
  boxShadow: "0 10px 24px rgba(15,23,42,0.055)",
};

export const imageFrame: CSSProperties = {
  minHeight: 118,
  borderRadius: 16,
  border: "1px solid rgba(226, 232, 240, 0.84)",
  background: "rgba(248, 250, 252, 0.9)",
  overflow: "hidden",
  display: "grid",
  placeItems: "center",
};

export const image: CSSProperties = {
  width: "100%",
  height: "100%",
  maxHeight: 142,
  objectFit: "cover",
  display: "block",
};

export const previewDetails: CSSProperties = {
  minWidth: 0,
  display: "grid",
  alignContent: "center",
  gap: 7,
};

export const previewLabel: CSSProperties = {
  color: indigoDark,
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

export const previewTitle: CSSProperties = {
  color: slate900,
  fontSize: 14,
  fontWeight: 950,
  lineHeight: 1.3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const previewMeta: CSSProperties = {
  color: slate500,
  fontSize: 12,
  fontWeight: 750,
};

export const previewActions: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

export const reviewHeader: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
  minWidth: 0,
};

export const reviewTitle: CSSProperties = {
  margin: 0,
  color: slate900,
  fontSize: 15,
  fontWeight: 950,
  letterSpacing: "-0.025em",
};

export const reviewText: CSSProperties = {
  margin: "2px 0 0",
  color: slate500,
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 720,
};

export const emptyState: CSSProperties = {
  borderRadius: 20,
  border: "1px solid rgba(226, 232, 240, 0.92)",
  background: "rgba(248, 250, 252, 0.88)",
  padding: "28px 16px",
  display: "grid",
  justifyItems: "center",
  gap: 7,
  textAlign: "center",
};

export const emptyIcon: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  background: "rgba(238, 242, 255, 0.92)",
  border: "1px solid rgba(199, 210, 254, 0.95)",
  color: indigo,
  fontSize: 17,
  fontWeight: 950,
};

export const emptyTitle: CSSProperties = {
  margin: 0,
  color: slate900,
  fontSize: 14,
  fontWeight: 950,
};

export const emptyText: CSSProperties = {
  margin: 0,
  color: slate500,
  fontSize: 12,
  lineHeight: 1.55,
  fontWeight: 720,
  maxWidth: 310,
};

export const loadingSpinner: CSSProperties = {
  display: "inline-block",
  width: 16,
  height: 16,
  borderRadius: "50%",
  border: "2px solid rgba(67, 56, 202, 0.22)",
  borderTopColor: indigoDark,
  animation: "spin 0.7s linear infinite",
};

export const reviewContent: CSSProperties = {
  display: "grid",
  gap: 12,
};

export const summaryCard: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 14,
  borderRadius: 20,
  border: "1px solid rgba(199, 210, 254, 0.72)",
  background:
    "linear-gradient(180deg, rgba(238,242,255,0.74), rgba(255,255,255,0.94))",
  boxShadow: "0 14px 30px rgba(67, 56, 202, 0.06)",
};

export const summaryTop: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
};

export const summaryHeadline: CSSProperties = {
  margin: "3px 0 0",
  color: slate900,
  fontSize: 16,
  lineHeight: 1.25,
  fontWeight: 950,
  letterSpacing: "-0.025em",
};

export const riskBadge: CSSProperties = {
  flexShrink: 0,
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(255, 255, 255, 0.9)",
  border: "1px solid rgba(199, 210, 254, 0.78)",
  color: slate600,
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
};

export const statPill: CSSProperties = {
  minHeight: 38,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  borderRadius: 15,
  border: "1px solid",
  padding: "7px 10px",
  fontSize: 11,
  fontWeight: 900,
  boxSizing: "border-box",
};

export const section: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 12,
  borderRadius: 20,
  border: "1px solid rgba(226, 232, 240, 0.86)",
  background: "rgba(255, 255, 255, 0.72)",
};

export const sectionHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
};

export const sectionTitle: CSSProperties = {
  margin: 0,
  color: slate900,
  fontSize: 14,
  fontWeight: 950,
  letterSpacing: "-0.02em",
};

export const sectionText: CSSProperties = {
  margin: "3px 0 0",
  color: slate500,
  fontSize: 11,
  lineHeight: 1.4,
  fontWeight: 730,
};

export const countBadge: CSSProperties = {
  minWidth: 30,
  height: 28,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  border: "1px solid",
  fontSize: 12,
  fontWeight: 950,
  flexShrink: 0,
};

export const itemList: CSSProperties = {
  display: "grid",
  gap: 9,
};

export const reviewItem: CSSProperties = {
  display: "grid",
  gap: 9,
  padding: 13,
  borderRadius: 17,
  border: "1px solid rgba(226, 232, 240, 0.86)",
  background: "rgba(255,255,255,0.92)",
  boxShadow: "0 10px 22px rgba(15, 23, 42, 0.045)",
};

export const itemHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

export const chip: CSSProperties = {
  width: "fit-content",
  padding: "5px 9px",
  borderRadius: 999,
  border: "1px solid",
  fontSize: 10,
  fontWeight: 950,
};

export const includeControl: CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "5px 8px",
  borderRadius: 999,
  border: "1px solid rgba(199, 210, 254, 0.68)",
  background: "rgba(255, 255, 255, 0.82)",
  color: slate700,
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
  userSelect: "none",
};

export const checkbox: CSSProperties = {
  width: 15,
  height: 15,
  margin: 0,
  accentColor: indigoDark,
  cursor: "pointer",
};

export const itemTitle: CSSProperties = {
  margin: 0,
  color: slate900,
  fontSize: 14,
  lineHeight: 1.35,
  fontWeight: 950,
  letterSpacing: "-0.018em",
};

export const itemDescription: CSSProperties = {
  margin: 0,
  color: slate600,
  fontSize: 11,
  lineHeight: 1.45,
  fontWeight: 720,
};

export const detailBox: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "10px 11px",
  borderRadius: 14,
  background: "rgba(255, 255, 255, 0.72)",
  border: "1px solid rgba(245, 158, 11, 0.3)",
};

export const detailLabel: CSSProperties = {
  color: "#92400e",
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export const detailText: CSSProperties = {
  color: slate900,
  fontSize: 12,
  fontWeight: 880,
  lineHeight: 1.35,
};

export const editBox: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "9px 10px",
  borderRadius: 14,
  border: "1px solid rgba(226, 232, 240, 0.54)",
  background: "rgba(248, 250, 252, 0.62)",
};

export const editHint: CSSProperties = {
  color: slate500,
  fontSize: 10,
  fontWeight: 800,
};

export const twoColumns: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 7,
};

export const input: CSSProperties = {
  minWidth: 0,
  width: "100%",
  boxSizing: "border-box",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(199, 210, 254, 0.82)",
  borderRadius: 10,
  background: "rgba(255, 255, 255, 0.96)",
  color: slate900,
  fontSize: 12,
  fontWeight: 760,
  padding: "7px 9px",
  outline: "none",
};

export const inputDisabled: CSSProperties = {
  ...input,
  cursor: "not-allowed",
  background: "rgba(248, 250, 252, 0.86)",
  borderColor: "rgba(226, 232, 240, 0.86)",
};

export const select: CSSProperties = {
  ...input,
  cursor: "pointer",
};

export const selectDisabled: CSSProperties = {
  ...inputDisabled,
};

export const footer: CSSProperties = {
  flex: "0 0 auto",
  padding: "16px 22px 18px",
  borderTop: "1px solid rgba(226,232,240,0.88)",
  display: "flex",
  gap: 12,
  justifyContent: "flex-end",
  background: "#ffffff",
  backdropFilter: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
};

export const secondaryButton: CSSProperties = {
  minHeight: 48,
  borderRadius: 16,
  border: "1px solid rgba(226,232,240,0.9)",
  background: "#ffffff",
  color: slate600,
  fontSize: 13,
  fontWeight: 850,
  padding: "0 18px",
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15,23,42,0.045)",
  transition: "transform 160ms ease, box-shadow 160ms ease, background 160ms ease",
};

export const primaryButton: CSSProperties = {
  minHeight: 48,
  borderRadius: 18,
  border: "1px solid rgba(29,78,216,0.9)",
  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 950,
  padding: "0 28px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  boxShadow:
    "0 14px 30px rgba(37,99,235,0.18), inset 0 1px 0 rgba(255,255,255,0.24)",
  transition: "transform 160ms ease, box-shadow 160ms ease, filter 160ms ease, background 160ms ease",
};

export const primaryButtonDisabled: CSSProperties = {
  ...primaryButton,
  opacity: 0.55,
  cursor: "not-allowed",
};

export const successButton: CSSProperties = {
  ...primaryButton,
  border: "1px solid rgba(22, 163, 74, 0.88)",
  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
  boxShadow: "0 14px 28px rgba(22, 163, 74, 0.18)",
};

export const errorBox: CSSProperties = {
  padding: 13,
  borderRadius: 16,
  border: "1px solid rgba(248, 113, 113, 0.38)",
  background: "rgba(254, 242, 242, 0.74)",
  color: "#991b1b",
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 760,
};

export const successBox: CSSProperties = {
  padding: 13,
  borderRadius: 16,
  border: "1px solid rgba(187, 247, 208, 0.78)",
  background: "rgba(240, 253, 244, 0.76)",
  color: "#166534",
  fontSize: 12,
  fontWeight: 900,
};

export const tone = {
  blue: {
    background: "rgba(239,246,255,0.94)",
    borderColor: "rgba(191,219,254,0.95)",
    color: "#1d4ed8",
  },
  purple: {
    background: "rgba(245,243,255,0.94)",
    borderColor: "rgba(221,214,254,0.95)",
    color: "#6d28d9",
  },
  amber: {
    background: "rgba(255,251,235,0.94)",
    borderColor: "rgba(253,230,138,0.95)",
    color: "#92400e",
  },
  slate: {
    background: "rgba(248,250,252,0.94)",
    borderColor: "rgba(226,232,240,0.95)",
    color: slate600,
  },
  green: {
    background: "rgba(240,253,244,0.94)",
    borderColor: "rgba(187,247,208,0.95)",
    color: "#15803d",
  },
};
