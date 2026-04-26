import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description?: string;
  subtitle?: string;
  children: ReactNode;
  rightSlot?: ReactNode;
};

export default function SectionCard({
  title,
  description,
  subtitle,
  children,
  rightSlot,
}: SectionCardProps) {
  const text = description ?? subtitle;

  return (
    <section
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.88) 100%)",
        border: "1px solid rgba(226,232,240,0.9)",
        borderRadius: 30,
        padding: 28,
        boxShadow:
          "0 12px 32px rgba(15,23,42,0.05), 0 2px 10px rgba(15,23,42,0.03)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 18,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 22,
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              color: "#0f172a",
              lineHeight: 1.05,
            }}
          >
            {title}
          </h2>

          {text ? (
            <p
              style={{
                margin: 0,
                color: "#64748b",
                fontSize: 15,
                lineHeight: 1.7,
                maxWidth: 860,
                fontWeight: 500,
              }}
            >
              {text}
            </p>
          ) : null}
        </div>

        {rightSlot ? rightSlot : null}
      </div>

      {children}
    </section>
  );
}