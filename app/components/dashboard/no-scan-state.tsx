"use client";

import PrimaryButton from "./primary-button";
import SecondaryButton from "./secondary-button";

type NoScanStateProps = {
  loadingScan: boolean;
  onRunSampleScan: () => void;
  onRunFullScan?: () => void;
};

const scanBenefits = [
  {
    title: "Inbox Health",
    text: "See a clear inbox health score and cleanup opportunities.",
    dot: "#2563eb",
  },
  {
    title: "Top Senders",
    text: "Review who fills your inbox the most, grouped by email volume.",
    dot: "#7c3aed",
  },
  {
    title: "Promotions",
    text: "See promotions clearly and understand cleanup potential fast.",
    dot: "#f97316",
  },
  {
    title: "Smart Views",
    text: "Quickly review unread, social, shopping, and job-related emails.",
    dot: "#10b981",
  },
];

export default function NoScanState({
  loadingScan,
  onRunSampleScan,
  onRunFullScan,
}: NoScanStateProps) {
  return (
    <div
      style={{
        display: "grid",
        gap: "30px",
        paddingBottom: "30px",
      }}
    >
      <section
        style={{
          padding: "6px 4px 0 4px",
        }}
      >
        <div
          style={{
            fontSize: "18px",
            fontWeight: 900,
            color: "#0f172a",
            marginBottom: "10px",
            letterSpacing: "-0.01em",
          }}
        >
          Get started
        </div>

        <div
          style={{
            fontSize: "16px",
            color: "#475569",
            maxWidth: "860px",
            lineHeight: 1.8,
          }}
        >
          Start with a free sample scan to analyze up to 1,000 emails, discover
          cleanup opportunities, and unlock real inbox insights.
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
          gap: "28px",
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            padding: "28px 28px 26px 28px",
            borderRadius: "28px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.74) 100%)",
            border: "1px solid rgba(226,232,240,0.92)",
            boxShadow: "0 18px 40px rgba(15,23,42,0.06)",
            backdropFilter: "blur(10px)",
            minHeight: "100%",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "999px",
              background: "#dcfce7",
              color: "#166534",
              padding: "8px 14px",
              fontWeight: 800,
              fontSize: "13px",
              marginBottom: "18px",
              boxShadow: "0 6px 14px rgba(22,101,52,0.08)",
            }}
          >
            Free Scan available
          </div>

          <div
            style={{
              fontSize: "40px",
              lineHeight: 1.06,
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-0.05em",
              marginBottom: "16px",
              maxWidth: "680px",
            }}
          >
            Start with a free inbox scan
          </div>

          <div
            style={{
              fontSize: "18px",
              color: "#475569",
              lineHeight: 1.8,
              maxWidth: "740px",
              marginBottom: "24px",
            }}
          >
            InboxShaper does not scan automatically. Start with a free scan to
            see top senders, detect promotions, and understand what’s filling up
            your inbox.
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <PrimaryButton onClick={onRunSampleScan} disabled={loadingScan}>
              {loadingScan ? "Scanning..." : "Run Free Scan"}
            </PrimaryButton>

            {onRunFullScan ? (
              <SecondaryButton onClick={onRunFullScan}>
                Unlock Full Scan (Pro)
              </SecondaryButton>
            ) : null}
          </div>
        </div>

        <div
          style={{
            padding: "26px 24px",
            borderRadius: "28px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.84) 100%)",
            border: "1px solid rgba(226,232,240,0.96)",
            boxShadow: "0 18px 40px rgba(15,23,42,0.07)",
            backdropFilter: "blur(10px)",
            minHeight: "100%",
          }}
        >
          <div
            style={{
              fontSize: "22px",
              fontWeight: 900,
              color: "#0f172a",
              marginBottom: "18px",
              letterSpacing: "-0.03em",
            }}
          >
            What you’ll unlock after the scan
          </div>

          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >
            {scanBenefits.map((item, index) => (
              <div
                key={item.title}
                style={{
                  display: "grid",
                  gridTemplateColumns: "14px 1fr",
                  gap: "12px",
                  alignItems: "start",
                  padding: "14px 0",
                  borderBottom:
                    index !== scanBenefits.length - 1
                      ? "1px solid rgba(226,232,240,0.82)"
                      : "none",
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "999px",
                    background: item.dot,
                    marginTop: "6px",
                    boxShadow: `0 0 0 5px ${item.dot}14`,
                  }}
                />

                <div>
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: 900,
                      color: "#0f172a",
                      marginBottom: "4px",
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontSize: "15px",
                      color: "#475569",
                      lineHeight: 1.7,
                    }}
                  >
                    {item.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}