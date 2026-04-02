"use client";

type TrustSectionProps = {
  jakartaClassName: string;
};

export default function TrustSection({
  jakartaClassName,
}: TrustSectionProps) {
  const sectionCardStyle = {
    background: "#ffffff",
    borderRadius: "30px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.06)",
  } as const;

  return (
    <section
      style={{
        marginTop: "46px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          ...sectionCardStyle,
          padding: "28px 30px",
          maxWidth: "1100px",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "20px",
        }}
      >
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            padding: "22px",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              marginBottom: "10px",
            }}
          >
            🔐
          </div>
          <div
            className={jakartaClassName}
            style={{
              fontSize: "20px",
              fontWeight: 800,
              marginBottom: "10px",
            }}
          >
            Secure Google sign-in
          </div>
          <div
            style={{
              fontSize: "17px",
              color: "#64748b",
              lineHeight: "1.8",
              fontWeight: 500,
            }}
          >
            Connect with Google OAuth and revoke access anytime.
          </div>
        </div>

        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            padding: "22px",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              marginBottom: "10px",
            }}
          >
            ✅
          </div>
          <div
            className={jakartaClassName}
            style={{
              fontSize: "20px",
              fontWeight: 800,
              marginBottom: "10px",
            }}
          >
            No automatic changes
          </div>
          <div
            style={{
              fontSize: "17px",
              color: "#64748b",
              lineHeight: "1.8",
              fontWeight: 500,
            }}
          >
            InboxShaper never auto-deletes or auto-archives your emails.
          </div>
        </div>

        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            padding: "22px",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              marginBottom: "10px",
            }}
          >
            🛡️
          </div>
          <div
            className={jakartaClassName}
            style={{
              fontSize: "20px",
              fontWeight: 800,
              marginBottom: "10px",
            }}
          >
            Privacy-first design
          </div>
          <div
            style={{
              fontSize: "17px",
              color: "#64748b",
              lineHeight: "1.8",
              fontWeight: 500,
            }}
          >
            We only access the Gmail metadata required to provide the product
            functionality.
          </div>
        </div>
      </div>
    </section>
  );
}