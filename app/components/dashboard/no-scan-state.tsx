import SectionCard from "./section-card";
import PrimaryButton from "./primary-button";
import SecondaryButton from "./secondary-button";

type NoScanStateProps = {
  loadingScan: boolean;
  onRunSampleScan: () => void;
  onRunFullScan?: () => void;
};

export default function NoScanState({
  loadingScan,
  onRunSampleScan,
  onRunFullScan,
}: NoScanStateProps) {
  return (
    <SectionCard
      title="No scan yet"
      subtitle="Choose a free sample scan or unlock a full inbox scan."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.15fr 0.85fr",
          gap: "22px",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "18px",
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
                background: "#dcfce7",
                color: "#166534",
                border: "1px solid #bbf7d0",
                padding: "8px 14px",
                borderRadius: "999px",
                fontWeight: 700,
                fontSize: "14px",
                marginBottom: "18px",
              }}
            >
              Free Scan available
            </div>

            <div
              style={{
                fontSize: "32px",
                fontWeight: 800,
                color: "#0f172a",
                lineHeight: 1.08,
                marginBottom: "14px",
                maxWidth: "560px",
              }}
            >
              Scan up to 1,000 emails for free
            </div>

            <div
              style={{
                fontSize: "16px",
                color: "#475569",
                lineHeight: 1.8,
                marginBottom: "22px",
                maxWidth: "700px",
              }}
            >
              InboxShaper does not scan automatically. Start with a{" "}
              <b>Free Scan</b> to analyze up to <b>1,000 emails</b>, see your
              top senders, detect promotions, and unlock cleanup insights.
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <PrimaryButton onClick={onRunSampleScan} disabled={loadingScan}>
                {loadingScan ? "Scanning..." : "Run Free Scan"}
              </PrimaryButton>
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #dbe7ff",
              borderRadius: "22px",
              padding: "26px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "#e0e7ff",
                color: "#3730a3",
                border: "1px solid #c7d2fe",
                padding: "8px 14px",
                borderRadius: "999px",
                fontWeight: 700,
                fontSize: "14px",
                marginBottom: "18px",
              }}
            >
              Pro Full Scan available
            </div>

            <div
              style={{
                fontSize: "30px",
                fontWeight: 800,
                color: "#0f172a",
                lineHeight: 1.08,
                marginBottom: "14px",
                maxWidth: "560px",
              }}
            >
              Run a full scan of your inbox
            </div>

            <div
              style={{
                fontSize: "16px",
                color: "#475569",
                lineHeight: 1.8,
                marginBottom: "22px",
                maxWidth: "700px",
              }}
            >
              Pro plan analyzes your <b>full inbox</b> and unlocks deeper
              cleanup, better visibility, and bulk actions across your account.
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <SecondaryButton
                onClick={onRunFullScan}
                disabled={loadingScan || !onRunFullScan}
              >
                {loadingScan ? "Scanning..." : "Run Full Scan"}
              </SecondaryButton>
            </div>
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
              [
                "Inbox Health",
                "See a clear health score and cleanup opportunities.",
              ],
              [
                "Top Senders",
                "Review senders grouped by email volume and take action faster.",
              ],
              [
                "Promotions",
                "See exact Gmail Promotions results and cleanup opportunities.",
              ],
              [
                "Smart Views",
                "Quickly review unread, social, shopping, and job-related emails.",
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