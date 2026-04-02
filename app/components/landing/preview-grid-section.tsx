"use client";

type PreviewGridSectionProps = {
  jakartaClassName: string;
};

export default function PreviewGridSection({
  jakartaClassName,
}: PreviewGridSectionProps) {
  const previewImageStyle = {
    width: "100%",
    display: "block",
    margin: "0 auto",
    borderRadius: "18px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
  } as const;

  return (
    <div
      style={{
        marginTop: "46px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "20px",
        alignItems: "start",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "22px",
          border: "1px solid #e2e8f0",
          padding: "10px",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          className={jakartaClassName}
          style={{
            fontSize: "15px",
            fontWeight: 800,
            color: "#2563eb",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "10px",
          }}
        >
          Inbox health overview
        </div>

        <img
          src="/inbox-health.png"
          alt="Inbox health preview"
          style={{
            ...previewImageStyle,
            maxWidth: "480px",
          }}
        />
      </div>

      <div
        style={{
          background: "#ffffff",
          borderRadius: "22px",
          border: "1px solid #e2e8f0",
          padding: "10px",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          className={jakartaClassName}
          style={{
            fontSize: "15px",
            fontWeight: 800,
            color: "#2563eb",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "10px",
          }}
        >
          Email categories breakdown
        </div>

        <img
          src="/email-categories.png"
          alt="Email categories preview"
          style={{
            ...previewImageStyle,
            maxWidth: "480px",
          }}
        />
      </div>
    </div>
  );
}