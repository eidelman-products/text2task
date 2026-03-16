import SectionCard from "./section-card";
import PrimaryButton from "./primary-button";
import SecondaryButton from "./secondary-button";

type NoScanStateProps = {
  loadingScan: boolean;
  onRunSampleScan: () => void;
};

export default function NoScanState({
  loadingScan,
  onRunSampleScan,
}: NoScanStateProps) {
  return (
    <SectionCard
      title="No scan yet"
      subtitle="Run your first Sample Scan to analyze your inbox and unlock cleanup insights."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: "22px",
        }}
      >
        <div
          style={{
            background: "#f8fbff",
            border: "1px solid #dbe7ff",
            borderRadius: "22px",
            padding: "26px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "#dbeafe",
              color: "#1d4ed8",
              border: "1px solid #bfd3ff",
              padding: "8px 14px",
              borderRadius: "999px",
              fontWeight: 700,
              fontSize: "14px",
              marginBottom: "18px",
            }}
          >
            Sample Scan required
          </div>

          <div
            style={{
              fontSize: "34px",
              fontWeight: 800,
              color: "#0f172a",
              lineHeight: 1.05,
              marginBottom: "16px",
              maxWidth: "560px",
            }}
          >
            Start by scanning your inbox
          </div>

          <div
            style={{
              fontSize: "16px",
              color: "#475569",
              lineHeight: 1.8,
              marginBottom: "24px",
              maxWidth: "700px",
            }}
          >
            InboxShaper does not scan automatically. Nothing is analyzed until
            you click <b>Run Sample Scan</b>. Free plan analyzes up to{" "}
            <b>1000 emails</b> and lets you clean up to{" "}
            <b>250 emails per week</b>.
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <PrimaryButton onClick={onRunSampleScan} disabled={loadingScan}>
              {loadingScan ? "Scanning..." : "Run Sample Scan"}
            </PrimaryButton>
            <SecondaryButton>Unlock Full Scan (Pro)</SecondaryButton>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #dbe7ff",
            borderRadius: "22px",
            padding: "22px",
          }}
        >
          <div
            style={{
              fontSize: "17px",
              fontWeight: 800,
              color: "#0f172a",
              marginBottom: "14px",
            }}
          >
            What happens after the scan
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            {[
              ["Inbox Health", "See a clear health score and cleanup opportunities."],
              ["Top Senders", "Review senders grouped by email volume."],
              [
                "Promotions",
                "See exact results from Gmail Promotions and a full inbox Promotions count from Gmail.",
              ],
            ].map(([title, desc]) => (
              <div
                key={title}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e5eefc",
                  borderRadius: "16px",
                  padding: "14px",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    color: "#64748b",
                    fontWeight: 700,
                    marginBottom: "6px",
                  }}
                >
                  {title}
                </div>
                <div
                  style={{
                    color: "#0f172a",
                    fontWeight: 700,
                    lineHeight: 1.55,
                  }}
                >
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}