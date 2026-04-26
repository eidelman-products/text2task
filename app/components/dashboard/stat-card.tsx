type StatCardProps = {
  label: string;
  value: string | number;
  sublabel?: string;
};

export default function StatCard({
  label,
  value,
  sublabel,
}: StatCardProps) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 22,
        padding: 20,
        boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#64748b",
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 34,
          lineHeight: 1,
          fontWeight: 900,
          color: "#0f172a",
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>

      {sublabel ? (
        <div
          style={{
            marginTop: 10,
            fontSize: 14,
            color: "#475569",
            lineHeight: 1.6,
          }}
        >
          {sublabel}
        </div>
      ) : null}
    </div>
  );
}