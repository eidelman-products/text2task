"use client";

type ProductPreviewSectionProps = {
  jakartaClassName: string;
};

export default function ProductPreviewSection({
  jakartaClassName,
}: ProductPreviewSectionProps) {
  const sectionCardStyle = {
    background: "#ffffff",
    borderRadius: "30px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.06)",
  } as const;

  const previewImageStyle = {
    width: "100%",
    display: "block",
    margin: "0 auto",
    borderRadius: "18px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
  } as const;

  return (
    <section
      id="product-preview"
      style={{
        ...sectionCardStyle,
        marginTop: "60px",
        padding: "34px 28px 38px",
      }}
    >
      <div
        style={{
          marginBottom: "26px",
          textAlign: "center",
        }}
      >
        <div
          className={jakartaClassName}
          style={{
            fontSize: "34px",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            marginBottom: "10px",
          }}
        >
          What you’ll see after connecting
        </div>

        <div
          style={{
            fontSize: "19px",
            color: "#64748b",
            lineHeight: "1.8",
            maxWidth: "860px",
            margin: "0 auto",
            fontWeight: 500,
          }}
        >
          InboxShaper shows you real sender groups, cleanup opportunities, and
          inbox insights before you apply any action.
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
        }}
      >
        <div
          className={jakartaClassName}
          style={{
            fontSize: "32px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: "12px",
          }}
        >
          Clean emails in one click
        </div>

        <div
          style={{
            fontSize: "18px",
            color: "#64748b",
            lineHeight: "1.8",
            marginBottom: "20px",
            maxWidth: "920px",
            marginLeft: "auto",
            marginRight: "auto",
            fontWeight: 500,
          }}
        >
          Review sender rows, unsubscribe where available, and move or archive
          emails only after you approve the action.
        </div>

        <div
          style={{
            maxWidth: "980px",
            margin: "0 auto",
            padding: "2px",
            borderRadius: "20px",
          }}
        >
          <img
            src="/sender-actions-new.png"
            alt="Sender cleanup table preview"
            style={{
              ...previewImageStyle,
              maxWidth: "920px",
              border: "1px solid rgba(226,232,240,0.9)",
              boxShadow: "0 6px 14px rgba(15, 23, 42, 0.04)",
            }}
          />
        </div>
      </div>
    </section>
  );
}