import SectionCard from "./section-card";
import MetricCard from "./metric-card";

type ScanResultsViewProps = {
  scanned: number;
  senderGroups: number;
  promotionsFoundInSampleScan: number;
  fullInboxPromotionsCount: number | null;
};

function formatNumber(value: number) {
  return value.toLocaleString();
}

export default function ScanResultsView({
  scanned,
  senderGroups,
  promotionsFoundInSampleScan,
  fullInboxPromotionsCount,
}: ScanResultsViewProps) {
  return (
    <SectionCard
      title="Scan Results"
      subtitle="Review what the latest scan found. Free plan shows partial insights from a 1000-email sample."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "14px",
          marginBottom: "18px",
        }}
      >
        <MetricCard label="Scan type" value="Sample Scan" accent="#2563eb" />
        <MetricCard
          label="Analyzed emails"
          value={formatNumber(scanned)}
          accent="#0f172a"
        />
        <MetricCard
          label="Sender groups found"
          value={String(senderGroups)}
          accent="#0f172a"
        />
        <MetricCard
          label="Promotions in sample"
          value={formatNumber(promotionsFoundInSampleScan)}
          accent="#ea580c"
          helperText="From Gmail Promotions matches only"
        />
      </div>

      {fullInboxPromotionsCount !== null ? (
        <div
          style={{
            background: "#f8fbff",
            border: "1px solid #bfd3ff",
            borderRadius: "18px",
            padding: "16px",
            color: "#1e3a8a",
            fontWeight: 700,
            lineHeight: 1.7,
          }}
        >
          Full inbox Promotions count from Gmail:{" "}
          <b>{formatNumber(fullInboxPromotionsCount)}</b>
        </div>
      ) : null}
    </SectionCard>
  );
}