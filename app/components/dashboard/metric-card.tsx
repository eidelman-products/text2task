type MetricCardProps = {
  label: string;
  value: string;
  accent?: string;
  helperText?: string;
};

export default function MetricCard({
  label,
  value,
  accent = "#16a34a",
  helperText,
}: MetricCardProps) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #dbe7ff",
        borderRadius: "20px",
        padding: "20px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          color: "#64748b",
          fontWeight: 700,
          marginBottom: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "28px",
          fontWeight: 800,
          color: accent,
        }}
      >
        {value}
      </div>
      {helperText ? (
        <div
          style={{
            marginTop: "8px",
            fontSize: "13px",
            color: "#64748b",
            lineHeight: 1.5,
            fontWeight: 600,
          }}
        >
          {helperText}
        </div>
      ) : null}
    </div>
  );
}