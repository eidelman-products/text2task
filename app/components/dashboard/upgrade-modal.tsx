"use client";

type UpgradeModalProps = {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onUpgrade: () => void;
};

export default function UpgradeModal({
  open,
  title,
  description,
  onClose,
  onUpgrade,
}: UpgradeModalProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 24,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
          border: "1px solid rgba(59, 130, 246, 0.16)",
          boxShadow:
            "0 24px 70px rgba(15, 23, 42, 0.20), 0 8px 24px rgba(59, 130, 246, 0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "26px 26px 18px 26px",
            borderBottom: "1px solid #e2e8f0",
            background:
              "radial-gradient(circle at top left, rgba(59,130,246,0.10) 0%, rgba(255,255,255,0.96) 42%, rgba(255,255,255,0.98) 100%)",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              marginBottom: 16,
              background:
                "linear-gradient(135deg, rgba(37,99,235,0.14) 0%, rgba(96,165,250,0.18) 100%)",
              border: "1px solid rgba(59,130,246,0.20)",
            }}
          >
            🚀
          </div>

          <h3
            style={{
              margin: 0,
              fontSize: 28,
              lineHeight: 1.15,
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-0.03em",
            }}
          >
            {title}
          </h3>

          <p
            style={{
              margin: "12px 0 0 0",
              fontSize: 16,
              lineHeight: 1.65,
              color: "#475569",
              fontWeight: 500,
            }}
          >
            {description}
          </p>
        </div>

        <div
          style={{
            padding: "20px 26px 8px 26px",
          }}
        >
          <div
            style={{
              borderRadius: 18,
              background:
                "linear-gradient(135deg, rgba(239,246,255,0.95) 0%, rgba(248,250,252,0.95) 100%)",
              border: "1px solid #dbeafe",
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: "#1d4ed8",
                marginBottom: 10,
                letterSpacing: "-0.01em",
              }}
            >
              Pro unlocks:
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              {[
                "Full inbox scan",
                "Unlimited cleanup actions",
                "Unlimited unread actions",
                "Bulk actions and faster cleanup flow",
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  <span style={{ color: "#2563eb", fontSize: 15 }}>✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
            padding: "22px 26px 26px 26px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: 48,
              padding: "0 18px",
              borderRadius: 14,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            onClick={onUpgrade}
            style={{
              height: 48,
              padding: "0 20px",
              borderRadius: 14,
              border: "none",
              background:
                "linear-gradient(135deg, #2563eb 0%, #3b82f6 55%, #60a5fa 100%)",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 12px 24px rgba(37, 99, 235, 0.22)",
            }}
          >
            Upgrade to Pro 🚀
          </button>
        </div>
      </div>
    </div>
  );
}