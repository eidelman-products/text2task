"use client";

import type React from "react";
import Image from "next/image";
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "./ui/tokens";

type FirstRunDashboardProps = {
  onExtractFirstRequest: () => void;
  onTryExample: () => void;
};

const workflowSteps = [
  "Paste / upload",
  "Review",
  "Save to CRM",
  "Track progress",
];

const flowImageSrc = "/landing/website-homepage-update-flow.png";

export default function FirstRunDashboard({
  onExtractFirstRequest,
}: FirstRunDashboardProps) {
  return (
    <section className="first-run-dashboard" style={rootStyle}>
      <style>{responsiveCss}</style>

      <div className="first-run-hero" style={heroStyle}>
        <div className="first-run-copy" style={copyStyle}>
          <h1 style={titleStyle}>
            Create your first project from a client message
          </h1>

          <p style={subtitleStyle}>
            Paste an email, WhatsApp message, or screenshot. Text2Task turns it
            into tasks you can review and save.
          </p>

          <button
            type="button"
            onClick={onExtractFirstRequest}
            style={primaryButtonStyle}
          >
            Extract your first request
          </button>
        </div>

        <div className="first-run-visual-wrap" style={visualWrapStyle}>
          <div style={visualGlowStyle} />

          <Image
            src={flowImageSrc}
            alt="Text2Task workflow from messy client message to organized project tasks"
            width={1672}
            height={941}
            className="first-run-flow-image"
            style={flowImageStyle}
          />
        </div>
      </div>

      <section className="first-run-how" style={howItWorksStyle}>
        <div style={sectionLabelStyle}>How it works</div>

        <div className="first-run-steps" style={stepsStyle}>
          {workflowSteps.map((step, index) => (
            <div
              key={step}
              className="first-run-step-group"
              style={stepGroupStyle}
            >
              <div style={stepItemStyle}>
                <span style={stepNumberStyle}>{index + 1}</span>
                <span style={stepTextStyle}>{step}</span>
              </div>

              {index < workflowSteps.length - 1 ? (
                <span className="first-run-step-arrow" style={stepArrowStyle}>
                  {"\u2192"}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

const responsiveCss = `
  .first-run-dashboard,
  .first-run-dashboard * {
    box-sizing: border-box;
  }

  .first-run-dashboard button {
    font-family: inherit;
    transition:
      transform 160ms ease,
      box-shadow 160ms ease,
      border-color 160ms ease,
      background 160ms ease;
  }

  .first-run-dashboard button:hover {
    transform: translateY(-1px);
  }

  .first-run-flow-image {
    transition:
      transform 180ms ease,
      box-shadow 180ms ease;
  }

  @media (min-width: 1081px) {
    .first-run-visual-wrap {
      padding-top: clamp(118px, 13vh, 164px);
    }
  }

  @media (max-width: 1080px) {
    .first-run-hero {
      grid-template-columns: 1fr !important;
      gap: 34px !important;
    }

    .first-run-copy {
      max-width: 720px !important;
      padding-top: 0 !important;
    }

    .first-run-visual-wrap {
      max-width: 860px !important;
      padding-top: 0 !important;
      justify-self: stretch !important;
    }

    .first-run-how {
      margin-top: 10px !important;
    }
  }

  @media (max-width: 760px) {
    .first-run-dashboard {
      gap: 30px !important;
      padding-bottom: 96px !important;
    }

    .first-run-hero {
      padding-top: 0 !important;
    }

    .first-run-how {
      gap: 18px !important;
    }

    .first-run-steps {
      align-items: stretch !important;
      flex-direction: column !important;
      gap: 12px !important;
    }

    .first-run-step-group {
      width: 100% !important;
    }

    .first-run-step-arrow {
      display: none !important;
    }

    .first-run-step-item {
      width: 100% !important;
    }
  }

  @media (max-width: 640px) {
    .first-run-flow-image {
      border-radius: 18px !important;
    }

    .first-run-primary-button {
      width: 100% !important;
    }
  }
`;

const rootStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 1260,
  minWidth: 0,
  margin: "0 auto",
  minHeight: "calc(100vh - 96px)",
  paddingBottom: "clamp(150px, 18vh, 260px)",
  display: "grid",
  gap: "clamp(34px, 5vh, 56px)",
  overflowX: "hidden",
};

const heroStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.82fr) minmax(520px, 1.18fr)",
  alignItems: "start",
  gap: "clamp(48px, 6vw, 86px)",
  paddingTop: dashboardSpacing[4],
};

const copyStyle: React.CSSProperties = {
  minWidth: 0,
  maxWidth: 600,
  display: "grid",
  alignContent: "start",
  gap: dashboardSpacing[5],
  paddingTop: "clamp(58px, 7vh, 94px)",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: 590,
  color: dashboardColors.text.primary,
  fontSize: "clamp(31px, 3.15vw, 39px)",
  lineHeight: 1.12,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.026em",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: 530,
  color: dashboardColors.text.muted,
  fontSize: 15.5,
  lineHeight: dashboardTypography.lineHeight.relaxed,
  fontWeight: dashboardTypography.weight.medium,
};

const primaryButtonStyle: React.CSSProperties = {
  justifySelf: "start",
  border: `1px solid ${dashboardColors.primary[600]}`,
  borderRadius: dashboardRadii.full,
  padding: "13px 19px",
  cursor: "pointer",
  color: dashboardColors.text.inverse,
  fontSize: 13,
  fontWeight: dashboardTypography.weight.black,
  background: dashboardColors.primary[600],
  boxShadow: "0 16px 30px rgba(37, 99, 235, 0.22)",
  whiteSpace: "nowrap",
};

const visualWrapStyle: React.CSSProperties = {
  position: "relative",
  minWidth: 0,
  width: "100%",
  maxWidth: 700,
  alignSelf: "start",
  justifySelf: "end",
};

const visualGlowStyle: React.CSSProperties = {
  position: "absolute",
  inset: "14% 2% auto 7%",
  height: "68%",
  borderRadius: dashboardRadii["3xl"],
  background:
    "radial-gradient(circle at center, rgba(37,99,235,0.12), rgba(239,246,255,0.2) 44%, rgba(255,255,255,0) 76%)",
  filter: "blur(20px)",
  pointerEvents: "none",
};

const flowImageStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  height: "auto",
  display: "block",
  borderRadius: dashboardRadii["2xl"],
  border: "1px solid rgba(191, 219, 254, 0.86)",
  background: "#ffffff",
  boxShadow: "0 24px 58px rgba(15, 23, 42, 0.10)",
};

const howItWorksStyle: React.CSSProperties = {
  minWidth: 0,
  width: "100%",
  maxWidth: 1040,
  margin: "0 auto",
  display: "grid",
  justifyItems: "center",
  gap: dashboardSpacing[5],
};

const sectionLabelStyle: React.CSSProperties = {
  color: dashboardColors.text.primary,
  fontSize: 21,
  lineHeight: 1.1,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.03em",
  textAlign: "center",
};

const stepsStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "clamp(14px, 1.7vw, 24px)",
  flexWrap: "wrap",
};

const stepGroupStyle: React.CSSProperties = {
  minWidth: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: "clamp(12px, 1.4vw, 18px)",
};

const stepItemStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "44px minmax(0, max-content)",
  alignItems: "center",
  gap: dashboardSpacing[3],
  padding: "8px 0",
};

const stepNumberStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: dashboardRadii.full,
  display: "grid",
  placeItems: "center",
  color: dashboardColors.primary[700],
  background: dashboardColors.primary[50],
  border: `1px solid ${dashboardColors.primary[100]}`,
  fontSize: 14,
  fontWeight: dashboardTypography.weight.black,
};

const stepTextStyle: React.CSSProperties = {
  color: dashboardColors.text.secondary,
  fontSize: 16,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.black,
  whiteSpace: "nowrap",
};

const stepArrowStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 26,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
};