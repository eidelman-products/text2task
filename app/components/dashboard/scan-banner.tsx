"use client";

import { useState } from "react";

type ScanBannerProps = {
  error?: string;
  success?: string;
  progress?: {
    step: string;
    progress: number;
    scanId: string;
  } | null;
};

export default function ScanBanner({
  error,
  success,
  progress,
}: ScanBannerProps) {
  const [isCancelling, setIsCancelling] = useState(false);

  async function handleCancelScan() {
    if (!progress?.scanId || isCancelling) return;

    try {
      setIsCancelling(true);

      const res = await fetch(`/api/scans/${progress.scanId}/status`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to cancel scan");
      }
    } catch (err: any) {
      console.error("Cancel scan failed:", err);
      alert(err?.message || "Failed to cancel scan");
    } finally {
      setIsCancelling(false);
    }
  }

  if (!error && !success && !progress) return null;

  if (error) {
    return (
      <div
        style={{
          marginBottom: "18px",
          maxWidth: "760px",
          borderRadius: "20px",
          border: "1px solid #fecaca",
          background: "linear-gradient(180deg, #fff5f5 0%, #fef2f2 100%)",
          color: "#b91c1c",
          padding: "14px 16px",
          boxShadow: "0 8px 24px rgba(185,28,28,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "999px",
              background: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: "14px",
            }}
          >
            !
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: "14px",
                lineHeight: 1.2,
                marginBottom: "4px",
              }}
            >
              Something went wrong
            </div>

            <div
              style={{
                fontWeight: 700,
                fontSize: "13px",
                lineHeight: 1.6,
                color: "#991b1b",
              }}
            >
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: "18px",
        maxWidth: success && !progress ? "760px" : "820px",
        borderRadius: "22px",
        border: "1px solid #bbf7d0",
        background: "linear-gradient(180deg, #f8fffb 0%, #f0fdf4 100%)",
        color: "#166534",
        padding: "14px 16px",
        boxShadow: "0 10px 28px rgba(22,101,52,0.06)",
      }}
    >
      {success ? (
        <div
          style={{
            display: "flex",
            alignItems: progress ? "flex-start" : "center",
            gap: "10px",
            marginBottom: progress ? "10px" : 0,
          }}
        >
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "999px",
              background: "#dcfce7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: "15px",
            }}
          >
            ✨
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: "14px",
                lineHeight: 1.2,
                marginBottom: "4px",
                color: "#14532d",
              }}
            >
              Nice work
            </div>

            <div
              style={{
                fontWeight: 700,
                fontSize: "13px",
                lineHeight: 1.6,
                color: "#166534",
              }}
            >
              {success}
            </div>
          </div>
        </div>
      ) : null}

      {progress ? (
        <div
          style={{
            display: "grid",
            gap: "9px",
            paddingLeft: success ? "40px" : 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 800,
                color: "#166534",
                letterSpacing: "0.01em",
              }}
            >
              {progress.step}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 900,
                  color: "#15803d",
                  background: "#dcfce7",
                  border: "1px solid #bbf7d0",
                  borderRadius: "999px",
                  padding: "4px 8px",
                  lineHeight: 1,
                }}
              >
                {progress.progress}%
              </div>

              <button
                type="button"
                onClick={handleCancelScan}
                disabled={isCancelling}
                style={{
                  border: "1px solid #fca5a5",
                  background: isCancelling ? "#fee2e2" : "#fff1f2",
                  color: "#b91c1c",
                  borderRadius: "999px",
                  padding: "5px 10px",
                  fontSize: "12px",
                  fontWeight: 900,
                  lineHeight: 1,
                  cursor: isCancelling ? "not-allowed" : "pointer",
                  opacity: isCancelling ? 0.7 : 1,
                }}
              >
                {isCancelling ? "Cancelling..." : "Cancel"}
              </button>
            </div>
          </div>

          <div
            style={{
              width: "100%",
              height: "8px",
              borderRadius: "999px",
              background: "#dcfce7",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(progress.progress, 100))}%`,
                height: "100%",
                borderRadius: "999px",
                background: "linear-gradient(90deg, #16a34a 0%, #22c55e 100%)",
                boxShadow: "0 0 12px rgba(34,197,94,0.25)",
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}