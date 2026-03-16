type SectionCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function SectionCard({
  title,
  subtitle,
  children,
}: SectionCardProps) {
  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #dbe7ff",
        borderRadius: "24px",
        padding: "24px",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
      }}
    >
      {(title || subtitle) && (
        <div style={{ marginBottom: "18px" }}>
          {title ? (
            <h2
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              {title}
            </h2>
          ) : null}

          {subtitle ? (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.6,
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      )}

      {children}
    </section>
  );
}