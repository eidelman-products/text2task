"use client";

import { AnimatePresence, motion } from "framer-motion";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function UpgradeModal({ isOpen, onClose }: Props) {
  async function handleUpgrade() {
    try {
      const res = await fetch("/api/creem/checkout", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to start checkout");
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("Checkout URL missing");
    } catch (error) {
      console.error(error);
      alert("Failed to start checkout");
    }
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.42)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          backdropFilter: "blur(4px)",
          padding: 20,
        }}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          style={{
            width: "100%",
            maxWidth: 460,
            background: "#ffffff",
            borderRadius: 22,
            padding: 24,
            boxShadow: "0 24px 70px rgba(15,23,42,0.24)",
            border: "1px solid rgba(226,232,240,0.95)",
          }}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.14), rgba(79,70,229,0.08))",
                color: "#4f46e5",
                display: "grid",
                placeItems: "center",
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              ⚡
            </div>

            <h2
              style={{
                fontSize: 22,
                fontWeight: 950,
                color: "#0f172a",
                margin: 0,
                letterSpacing: "-0.04em",
              }}
            >
              You've reached your free limit
            </h2>

            <p
              style={{
                fontSize: 14,
                color: "#64748b",
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              You’ve used all 30 free extracts. Upgrade to Pro for unlimited AI
              extracts, CSV export, and full task management.
            </p>

            <div
              style={{
                border: "1px solid rgba(99,102,241,0.14)",
                background: "rgba(99,102,241,0.06)",
                borderRadius: 16,
                padding: 14,
                display: "grid",
                gap: 6,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#312e81",
                }}
              >
                Text2Task Pro
              </div>

              <div
                style={{
                  fontSize: 24,
                  fontWeight: 950,
                  color: "#0f172a",
                  letterSpacing: "-0.04em",
                }}
              >
                $12.90
                <span
                  style={{
                    fontSize: 13,
                    color: "#64748b",
                    fontWeight: 700,
                    marginLeft: 4,
                  }}
                >
                  / month
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              marginTop: 22,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                minHeight: 42,
                padding: "0 16px",
                borderRadius: 12,
                border: "1px solid rgba(203,213,225,0.96)",
                background: "#ffffff",
                color: "#334155",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleUpgrade}
              style={{
                minHeight: 42,
                padding: "0 18px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 12px 24px rgba(79,70,229,0.24)",
              }}
            >
              Upgrade to Pro
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}