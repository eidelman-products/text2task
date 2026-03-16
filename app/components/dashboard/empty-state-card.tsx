import SectionCard from "./section-card";
import PrimaryButton from "./primary-button";

type EmptyStateCardProps = {
  title: string;
  description: string;
  loadingScan: boolean;
  onRunSampleScan: () => void;
};

export default function EmptyStateCard({
  title,
  description,
  loadingScan,
  onRunSampleScan,
}: EmptyStateCardProps) {
  return (
    <SectionCard title={title} subtitle={description}>
      <div
        style={{
          border: "1px dashed #cbd5e1",
          borderRadius: "20px",
          padding: "28px",
          background: "#f8fafc",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "22px",
            fontWeight: 800,
            color: "#0f172a",
            marginBottom: "10px",
          }}
        >
          No scan results yet
        </div>
        <div
          style={{
            color: "#64748b",
            fontSize: "15px",
            lineHeight: 1.7,
            marginBottom: "18px",
          }}
        >
          Run Sample Scan first to load inbox insights and cleanup options.
        </div>
        <PrimaryButton onClick={onRunSampleScan} disabled={loadingScan}>
          {loadingScan ? "Scanning..." : "Run Sample Scan"}
        </PrimaryButton>
      </div>
    </SectionCard>
  );
}