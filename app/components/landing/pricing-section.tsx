"use client";

type PricingSectionProps = {
  jakartaClassName: string;
  onSignIn: () => void;
};

export default function PricingSection({
  jakartaClassName,
  onSignIn,
}: PricingSectionProps) {
  const sectionCardStyle = {
    background: "#ffffff",
    borderRadius: "30px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.06)",
  } as const;

  return (
    <section
      id="pricing"
      style={{
        marginTop: "72px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          ...sectionCardStyle,
          maxWidth: "1100px",
          width: "100%",
          padding: "40px 32px 34px",
          textAlign: "center",
        }}
      >
        <div
          className={jakartaClassName}
          style={{
            fontSize: "36px",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            marginBottom: "12px",
          }}
        >
          Simple, transparent pricing
        </div>

        <div
          style={{
            fontSize: "18px",
            color: "#64748b",
            lineHeight: "1.8",
            maxWidth: "760px",
            margin: "0 auto 34px",
            fontWeight: 500,
          }}
        >
          Start free to scan and review your inbox. Upgrade when you need full
          inbox cleanup power.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
            alignItems: "stretch",
            maxWidth: "860px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "24px",
              padding: "30px 26px",
              textAlign: "left",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)",
              opacity: 0.9,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                className={jakartaClassName}
                style={{
                  fontSize: "24px",
                  fontWeight: 800,
                  marginBottom: "10px",
                }}
              >
                Free
              </div>

              <div
                className={jakartaClassName}
                style={{
                  fontSize: "42px",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  marginBottom: "18px",
                }}
              >
                $0
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  color: "#475569",
                  fontSize: "17px",
                  lineHeight: "1.8",
                  fontWeight: 500,
                }}
              >
                <div>✓ Sample scan of up to 1,000 emails</div>
                <div>✓ Up to 250 cleanup actions per week</div>
                <div>✓ Mark emails as read (up to 250/week)</div>
                <div>✓ Sender insights and category breakdown</div>
                <div>✓ No automatic actions</div>
              </div>
            </div>

            <div
              style={{
                marginTop: "22px",
                fontSize: "14px",
                color: "#64748b",
                fontWeight: 600,
              }}
            >
              Best for light weekly cleanup
            </div>
          </div>

          <div
            style={{
              background: "#0f172a",
              color: "#ffffff",
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: "24px",
              padding: "30px 26px",
              textAlign: "left",
              boxShadow: "0 22px 44px rgba(15, 23, 42, 0.16)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.08)",
                  fontSize: "13px",
                  fontWeight: 800,
                  marginBottom: "12px",
                }}
              >
                Most popular
              </div>

              <div
                className={jakartaClassName}
                style={{
                  fontSize: "24px",
                  fontWeight: 800,
                  marginBottom: "10px",
                }}
              >
                Pro
              </div>

              <div
                className={jakartaClassName}
                style={{
                  fontSize: "42px",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  marginBottom: "18px",
                }}
              >
                $6.9
                <span
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    opacity: 0.8,
                    marginLeft: "4px",
                  }}
                >
                  /month
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  color: "rgba(255,255,255,0.88)",
                  fontSize: "17px",
                  lineHeight: "1.8",
                  fontWeight: 500,
                }}
              >
                <div>✓ Full inbox scan</div>
                <div>✓ Unlimited cleanup actions</div>
                <div>✓ Unlimited mark as read actions</div>
                <div>✓ Advanced inbox analytics</div>
                <div>✓ Faster cleanup workflow</div>
                <div>✓ Clean your entire inbox in minutes</div>
              </div>
            </div>

            <div style={{ marginTop: "22px" }}>
              <div
                style={{
                  fontSize: "14px",
                  color: "rgba(255,255,255,0.72)",
                  fontWeight: 600,
                  marginBottom: "14px",
                }}
              >
                Best for full inbox control
              </div>

              <button
                onClick={onSignIn}
                className={jakartaClassName}
                style={{
                  padding: "14px 18px",
                  width: "100%",
                  borderRadius: "14px",
                  border: "none",
                  background: "#ffffff",
                  color: "#0f172a",
                  cursor: "pointer",
                  fontSize: "17px",
                  fontWeight: 800,
                  boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
                }}
              >
                Start Pro Plan
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "18px",
            fontSize: "13px",
            color: "#94a3b8",
            fontWeight: 500,
          }}
        >
          No credit card required to start • Cancel anytime
        </div>
      </div>
    </section>
  );
}