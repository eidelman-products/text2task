import SectionCard from "./section-card";
import MetricCard from "./metric-card";
import PrimaryButton from "./primary-button";
import SecondaryButton from "./secondary-button";

type ScanResult = {
  scanned: number;
  senderGroups: number;
  promotionsFoundInSampleScan: number;
  largestSenderCount: number;
  healthScore: number;
};

type DashboardOverviewProps = {
  scanResult: ScanResult;
  email: string;
  loadingScan: boolean;
  toneStyles: {
    cardBg: string;
    cardBorder: string;
    title: string;
    bar: string;
    chipBg: string;
    chipColor: string;
    chipText: string;
  };
  onRunSampleScan: () => void;
};

function formatNumber(value: number) {
  return value.toLocaleString();
}

export default function DashboardOverview({
  scanResult,
  email,
  loadingScan,
  toneStyles,
  onRunSampleScan,
}: DashboardOverviewProps) {
  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <SectionCard
        title="Inbox health overview"
        subtitle="Your latest sample scan shows where the fastest cleanup wins are."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.35fr 0.85fr",
            gap: "20px",
          }}
        >
          <div
            style={{
              background: "#f8fbff",
              border: "1px solid #dbe7ff",
              borderRadius: "22px",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "#dbeafe",
                color: "#2563eb",
                border: "1px solid #bfd3ff",
                padding: "8px 14px",
                borderRadius: "999px",
                fontWeight: 700,
                fontSize: "14px",
                marginBottom: "18px",
              }}
            >
              Inbox health overview
            </div>

            <div
              style={{
                fontSize: "38px",
                fontWeight: 800,
                color: "#0f172a",
                lineHeight: 1,
                marginBottom: "14px",
              }}
            >
              {scanResult.healthScore}% inbox health
            </div>

            <div
              style={{
                fontSize: "16px",
                color: "#475569",
                lineHeight: 1.8,
                maxWidth: "720px",
                marginBottom: "22px",
              }}
            >
              Your inbox is analyzed and ready for cleanup. We scanned{" "}
              <b>{formatNumber(scanResult.scanned)}</b> emails, found{" "}
              <b>{scanResult.senderGroups}</b> sender groups, and highlighted
              the biggest cleanup opportunities.
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <PrimaryButton onClick={onRunSampleScan} disabled={loadingScan}>
                {loadingScan ? "Scanning..." : "Run New Sample Scan"}
              </PrimaryButton>
              <SecondaryButton>Unlock Full Scan (Pro)</SecondaryButton>
            </div>
          </div>

          <div
            style={{
              background: toneStyles.cardBg,
              border: `1px solid ${toneStyles.cardBorder}`,
              borderRadius: "22px",
              padding: "22px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  color: toneStyles.title,
                  fontSize: "14px",
                  fontWeight: 800,
                }}
              >
                Inbox health score
              </div>
              <div
                style={{
                  background: toneStyles.chipBg,
                  color: toneStyles.chipColor,
                  borderRadius: "999px",
                  padding: "8px 14px",
                  fontWeight: 800,
                  fontSize: "14px",
                }}
              >
                {toneStyles.chipText}
              </div>
            </div>

            <div
              style={{
                fontSize: "58px",
                fontWeight: 800,
                color: toneStyles.title,
                lineHeight: 1,
                marginBottom: "14px",
              }}
            >
              {scanResult.healthScore}%
            </div>

            <div
              style={{
                width: "100%",
                height: "12px",
                borderRadius: "999px",
                background: "#e2e8f0",
                overflow: "hidden",
                marginBottom: "18px",
              }}
            >
              <div
                style={{
                  width: `${scanResult.healthScore}%`,
                  height: "100%",
                  background: toneStyles.bar,
                  borderRadius: "999px",
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.55)",
                  borderRadius: "16px",
                  padding: "14px",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    color: "#64748b",
                    fontWeight: 700,
                    marginBottom: "8px",
                  }}
                >
                  Plan
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  Free
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.55)",
                  borderRadius: "16px",
                  padding: "14px",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    color: "#64748b",
                    fontWeight: 700,
                    marginBottom: "8px",
                  }}
                >
                  Largest sender
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  {formatNumber(scanResult.largestSenderCount)}
                </div>
              </div>
            </div>

            <div
              style={{
                color: "#475569",
                fontSize: "14px",
                lineHeight: 1.7,
              }}
            >
              <div style={{ marginBottom: "6px" }}>
                Signed in as <b>{email}</b>
              </div>
              <div>
                Latest Sample Scan is ready. Review sender groups and clean safely.
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "16px",
        }}
      >
        <MetricCard
          label="Emails analyzed"
          value={formatNumber(scanResult.scanned)}
          accent="#15803d"
        />
        <MetricCard
          label="Sender groups"
          value={String(scanResult.senderGroups)}
          accent="#0f172a"
        />
        <MetricCard
          label="Promotions in sample"
          value={formatNumber(scanResult.promotionsFoundInSampleScan)}
          accent="#ea580c"
          helperText="Based on Gmail Promotions matches inside the first 1,000 inbox emails"
        />
        <MetricCard label="Plan" value="Free" accent="#2563eb" />
      </div>
    </div>
  );
}