import type { CSSProperties, ReactNode } from "react";

export type ProjectPreviewPresentationProps = {
  header: ReactNode;
  projectTitle: ReactNode;
  projectSummary?: ReactNode;
  projectDetails: ReactNode;
  clientDetails: ReactNode;
  tasksHeading: ReactNode;
  tasks: ReactNode;
  resources?: ReactNode;
  notice?: ReactNode;
  footer?: ReactNode;
};

export type ProjectPreviewClientHeaderProps = {
  avatarLabel: string;
  children: ReactNode;
};

export default function ProjectPreviewPresentation({
  header,
  projectTitle,
  projectSummary = null,
  projectDetails,
  clientDetails,
  tasksHeading,
  tasks,
  resources = null,
  notice = null,
  footer = null,
}: ProjectPreviewPresentationProps) {
  return (
    <div className="ai-project-review-premium-wrap" style={outerWrapStyle}>
      <style>{responsiveCss}</style>

      <div style={backdropGlowTopStyle} />
      <div style={backdropGlowLeftStyle} />
      <div style={backdropGlowRightStyle} />
      <div style={premiumHaloStyle} />

      <article className="ai-project-review-clean" style={panelStyle}>
        <div style={glassShineStyle} />
        <div style={topAccentLineStyle} />

        <header style={topLineStyle}>{header}</header>

        <div className="ai-review-clean-layout" style={layoutStyle}>
          <section style={projectAreaStyle}>
            <div style={projectSummaryCardStyle}>
              <div style={titleSurfaceStyle}>
                {projectTitle}
                {projectSummary}
              </div>

              <div style={softDividerStyle} />

              <div style={metricsHeaderStyle}>
                <span style={metricsLabelStyle}>Project details</span>
              </div>

              <div className="ai-review-clean-metrics" style={metricsStyle}>
                {projectDetails}
              </div>
            </div>

            <div className="ai-review-client-details" style={contextAreaStyle}>
              <div style={contextHeaderStyle}>
                <span style={labelStyle}>Client details</span>
              </div>

              <div className="ai-review-clean-context" style={contextGridStyle}>
                {clientDetails}
              </div>
            </div>
          </section>

          <section style={tasksAreaStyle}>
            <div style={tasksHeaderStyle}>
              <div>{tasksHeading}</div>
            </div>

            <div style={taskListStyle}>{tasks}</div>

            {resources}
          </section>
        </div>

        {notice}
        {footer}
      </article>
    </div>
  );
}

export function ProjectPreviewClientHeader({
  avatarLabel,
  children,
}: ProjectPreviewClientHeaderProps) {
  return (
    <div style={clientClusterStyle}>
      <div style={avatarOuterStyle}>
        <div style={avatarStyle}>{getInitials(avatarLabel)}</div>
      </div>

      <div style={clientTextStyle}>{children}</div>
    </div>
  );
}

export function ProjectPreviewResourcesLine() {
  return (
    <div className="ai-review-resources-line" style={resourcesLineStyle}>
      <div style={resourcesIconStyle}>{"\u2197"}</div>

      <div style={resourcesContentStyle}>
        <div style={resourcesTitleStyle}>Resources</div>
        <div style={resourcesTextStyle}>
          Files, links, and notes will connect to this project after saving.
        </div>
      </div>

      <span className="ai-review-resources-badge" style={resourcesBadgeStyle}>
        Available after save
      </span>
    </div>
  );
}

function getInitials(value: string) {
  const clean = String(value || "").trim();

  if (!clean) return "AI";

  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const outerWrapStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 980,
  margin: "0 auto 0 0",
  padding: "6px 0 0",
  borderRadius: 24,
  isolation: "isolate",
};

const backdropGlowTopStyle: CSSProperties = {
  display: "none",
  position: "absolute",
  top: -70,
  left: "18%",
  width: 520,
  height: 210,
  borderRadius: 999,
  background:
    "radial-gradient(circle, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.025) 44%, transparent 72%)",
  filter: "blur(28px)",
  opacity: 0.58,
  pointerEvents: "none",
  zIndex: 0,
};

const backdropGlowLeftStyle: CSSProperties = {
  display: "none",
  position: "absolute",
  bottom: -58,
  left: "2%",
  width: 420,
  height: 190,
  borderRadius: 999,
  background:
    "radial-gradient(circle, rgba(14,165,233,0.07) 0%, rgba(14,165,233,0.025) 44%, transparent 72%)",
  filter: "blur(30px)",
  opacity: 0.56,
  pointerEvents: "none",
  zIndex: 0,
};

const backdropGlowRightStyle: CSSProperties = {
  display: "none",
  position: "absolute",
  top: "18%",
  right: -72,
  width: 320,
  height: 300,
  borderRadius: 999,
  background:
    "radial-gradient(circle, rgba(37,99,235,0.045) 0%, rgba(37,99,235,0.018) 44%, transparent 72%)",
  filter: "blur(30px)",
  opacity: 0.42,
  pointerEvents: "none",
  zIndex: 0,
};

const premiumHaloStyle: CSSProperties = {
  display: "none",
  position: "absolute",
  inset: 8,
  borderRadius: 28,
  background:
    "linear-gradient(135deg, rgba(37,99,235,0.055), rgba(14,165,233,0.035))",
  filter: "blur(14px)",
  opacity: 0.35,
  pointerEvents: "none",
  zIndex: 0,
};

const panelStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  overflow: "hidden",
  borderRadius: 22,
  background:
    "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.74) 100%)",
  border: "1px solid rgba(191,219,254,0.92)",
  boxShadow:
    "0 18px 44px rgba(15,23,42,0.065), 0 10px 26px rgba(37,99,235,0.055), inset 0 1px 0 rgba(255,255,255,0.98)",
  backdropFilter: "none",
};

const glassShineStyle: CSSProperties = {
  display: "none",
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(118deg, rgba(255,255,255,0.36) 0%, rgba(255,255,255,0.10) 28%, transparent 48%)",
  pointerEvents: "none",
  zIndex: 0,
};

const topAccentLineStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 2,
  background:
    "linear-gradient(90deg, rgba(37,99,235,0.92) 0%, rgba(96,165,250,0.72) 52%, rgba(191,219,254,0.0) 100%)",
  opacity: 0.9,
  zIndex: 2,
};

const topLineStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: 16,
  padding: "20px 24px 18px",
  background:
    "linear-gradient(180deg, rgba(239,246,255,0.62) 0%, rgba(255,255,255,0.96) 100%)",
  borderBottom: "1px solid rgba(191,219,254,0.68)",
};

const clientClusterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 13,
  minWidth: 0,
};

const avatarOuterStyle: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 18,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, rgba(239,246,255,0.96), rgba(255,255,255,0.98))",
  border: "1px solid rgba(191,219,254,0.9)",
  boxShadow: "0 10px 22px rgba(37,99,235,0.08)",
  flexShrink: 0,
};

const avatarStyle: CSSProperties = {
  width: 45,
  height: 45,
  borderRadius: 15,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 950,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.24), 0 8px 18px rgba(37,99,235,0.16)",
};

const clientTextStyle: CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 0,
};

const layoutStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 0,
};

const projectAreaStyle: CSSProperties = {
  padding: "22px 24px 18px",
  display: "grid",
  alignContent: "start",
  gap: 14,
  borderRight: "none",
  borderBottom: "1px solid rgba(226,232,240,0.78)",
  background: "rgba(255,255,255,0.48)",
};

const projectSummaryCardStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gap: 12,
  padding: "0 0 2px",
  borderRadius: 0,
  background: "transparent",
  border: "none",
  boxShadow: "none",
};

const titleSurfaceStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  padding: "0 0 2px",
  borderRadius: 0,
  background: "transparent",
  border: "none",
  boxShadow: "none",
};

const softDividerStyle: CSSProperties = {
  height: 1,
  background:
    "linear-gradient(90deg, transparent 0%, rgba(203,213,225,0.52) 18%, rgba(203,213,225,0.34) 72%, transparent 100%)",
  margin: "0 2px",
};

const metricsHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: 12,
  paddingTop: 2,
};

const metricsLabelStyle: CSSProperties = {
  color: "#2563eb",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: "0.01em",
};

const metricsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
};

const contextAreaStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "14px",
  borderRadius: 16,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.58) 100%)",
  border: "1px solid rgba(226,232,240,0.78)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.76)",
};

const contextHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: 12,
};

const contextGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 9,
};

const tasksAreaStyle: CSSProperties = {
  padding: "20px 24px 24px",
  display: "grid",
  alignContent: "start",
  gap: 14,
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.58) 0%, rgba(255,255,255,0.72) 100%)",
};

const tasksHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const taskListStyle: CSSProperties = {
  display: "grid",
  gap: 9,
};

const labelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.115em",
};

const resourcesLineStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 12,
  marginTop: 4,
  padding: "14px",
  borderRadius: 18,
  border: "1px solid rgba(191,219,254,0.76)",
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.88) 0%, rgba(239,246,255,0.58) 100%)",
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 650,
  boxShadow:
    "0 8px 18px rgba(37,99,235,0.035), inset 0 1px 0 rgba(255,255,255,0.78)",
};

const resourcesIconStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 13,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, rgba(239,246,255,0.96) 0%, rgba(219,234,254,0.82) 100%)",
  border: "1px solid rgba(191,219,254,0.88)",
  color: "#2563eb",
  fontSize: 15,
  fontWeight: 950,
  boxShadow: "0 8px 16px rgba(37,99,235,0.06)",
};

const resourcesContentStyle: CSSProperties = {
  minWidth: 0,
};

const resourcesTitleStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 920,
  letterSpacing: "-0.01em",
};

const resourcesTextStyle: CSSProperties = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 680,
};

const resourcesBadgeStyle: CSSProperties = {
  borderRadius: 999,
  padding: "7px 10px",
  background: "rgba(255,255,255,0.78)",
  border: "1px solid rgba(191,219,254,0.9)",
  color: "#1d4ed8",
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
  boxShadow: "0 8px 16px rgba(37,99,235,0.045)",
};

const responsiveCss = `
  .ai-project-review-clean input:focus,
  .ai-project-review-clean select:focus,
  .ai-project-review-clean textarea:focus {
    box-shadow: none !important;
  }

  .ai-project-review-clean input::selection,
  .ai-project-review-clean textarea::selection {
    background: rgba(37,99,235,0.14);
  }

  .ai-review-clean-task {
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      box-shadow 160ms ease,
      background 160ms ease;
  }

  .ai-review-clean-task:hover {
    transform: translateY(-1px);
    border-color: rgba(191,219,254,0.95) !important;
    background: rgba(255,255,255,0.92) !important;
    box-shadow:
      0 12px 24px rgba(15,23,42,0.045),
      inset 0 1px 0 rgba(255,255,255,0.86) !important;
  }

  .ai-review-clean-metrics label:hover {
    transform: translateY(-1px);
    border-color: rgba(191,219,254,0.86) !important;
    box-shadow:
      0 10px 20px rgba(15,23,42,0.035),
      inset 0 1px 0 rgba(255,255,255,0.9) !important;
  }

  @media (max-width: 1180px) {
    .ai-review-clean-layout {
      grid-template-columns: 1fr !important;
    }

    .ai-review-clean-layout > section:first-child {
      border-right: none !important;
      border-bottom: 1px solid rgba(226,232,240,0.78);
    }
  }

  @media (max-width: 780px) {
    .ai-project-review-premium-wrap {
      padding: 8px !important;
      border-radius: 30px !important;
    }

    .ai-project-review-clean > header {
      flex-direction: column !important;
      align-items: flex-start !important;
    }

    .ai-review-clean-metrics,
    .ai-review-clean-context {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 620px) {
    .ai-project-review-clean {
      border-radius: 24px !important;
    }

    .ai-project-review-clean > header,
    .ai-review-clean-layout > section {
      padding-left: 16px !important;
      padding-right: 16px !important;
    }
  }

  @media (max-width: 520px) {
    .ai-project-review-premium-wrap {
      padding: 2px !important;
      border-radius: 24px !important;
    }

    .ai-project-review-clean {
      border-radius: 22px !important;
    }

    .ai-project-review-clean > header {
      padding: 15px !important;
    }

    .ai-review-clean-layout > section {
      padding: 14px !important;
    }

    .ai-project-review-clean h3 {
      font-size: 21px !important;
    }

    .ai-review-clean-metrics {
      gap: 8px !important;
    }

    .ai-review-clean-metrics label {
      padding: 9px 11px !important;
      border-radius: 15px !important;
    }

    .ai-review-client-details {
      padding: 11px 12px 12px !important;
      border-radius: 18px !important;
      gap: 8px !important;
    }

    .ai-review-clean-context {
      gap: 8px !important;
    }

    .ai-review-clean-context label {
      padding: 7px 9px 8px !important;
      border-radius: 13px !important;
    }

    .ai-review-clean-task {
      gap: 7px !important;
      padding: 8px 10px !important;
      min-height: auto !important;
      align-items: start !important;
    }

    .ai-review-clean-task textarea {
      min-height: 34px !important;
      line-height: 1.38 !important;
    }

    .ai-review-client-notes textarea {
      min-height: 72px !important;
      max-height: 144px !important;
      line-height: 1.45 !important;
      padding-bottom: 3px !important;
    }

    .ai-review-resources-line {
      grid-template-columns: 34px minmax(0, 1fr) !important;
      align-items: start !important;
      gap: 10px !important;
      padding: 13px !important;
    }

    .ai-review-resources-badge {
      grid-column: 2 / -1 !important;
      width: fit-content !important;
      margin-top: 2px !important;
    }
  }

  @media (max-width: 480px) {
    .ai-review-clean-layout {
      min-width: 0 !important;
    }

    .ai-project-review-clean input,
    .ai-project-review-clean select,
    .ai-project-review-clean textarea {
      font-size: 16px !important;
    }

    .ai-project-review-clean {
      overflow: hidden !important;
    }

    .ai-review-clean-task {
      grid-template-columns: 22px minmax(0, 1fr) !important;
      align-items: start !important;
    }

    .ai-review-clean-task-remove {
      grid-column: 2;
      justify-self: end;
      margin-top: 0;
      padding: 5px 8px !important;
    }

    .ai-project-review-premium-wrap {
      overflow: visible !important;
    }
  }

  @media (max-width: 430px) {
    .ai-project-review-clean-context {
      grid-template-columns: 1fr !important;
    }
  }
`;
