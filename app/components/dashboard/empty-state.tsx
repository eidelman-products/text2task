type EmptyStateProps = {
  title: string;
  description: string;
};

export default function EmptyState({
  title,
  description,
}: EmptyStateProps) {
  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.94) 100%)",
        border: "1px dashed rgba(203,213,225,0.95)",
        borderRadius: 28,
        padding: 40,
        textAlign: "center",
        color: "#475569",
        boxShadow: "0 12px 30px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          margin: "0 auto 18px",
          borderRadius: 999,
          background:
            "linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(99,102,241,0.12) 100%)",
          border: "1px solid rgba(59,130,246,0.14)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 12px 24px rgba(59,130,246,0.08)",
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: 999,
            background: "linear-gradient(180deg, #60a5fa 0%, #6366f1 100%)",
            boxShadow: "0 0 0 6px rgba(59,130,246,0.10)",
          }}
        />
      </div>

      <h3
        style={{
          margin: 0,
          fontSize: 24,
          fontWeight: 900,
          color: "#0f172a",
          letterSpacing: "-0.03em",
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: "12px auto 0 auto",
          maxWidth: 620,
          fontSize: 15,
          lineHeight: 1.8,
          color: "#64748b",
        }}
      >
        {description}
      </p>
    </div>
  );
}