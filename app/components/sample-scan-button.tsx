"use client";

import { useState } from "react";

export default function SampleScanButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

  async function runScan() {
    try {
      setLoading(true);
      setResult(null);
      setError("");

      const res = await fetch("/api/scan/sample", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Scan failed");
        return;
      }

      setResult(data.scanned ?? 0);
    } catch (err) {
      setError("Something went wrong while starting the scan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={runScan}
        disabled={loading}
        style={{
          background: "#111827",
          color: "white",
          border: "none",
          padding: "12px 18px",
          borderRadius: "8px",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "14px",
          fontWeight: 600,
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Scanning..." : "Run Sample Scan"}
      </button>

      {result !== null && (
        <p style={{ marginTop: "12px", color: "#111827" }}>
          Scanned {result} emails
        </p>
      )}

      {error && (
        <p style={{ marginTop: "12px", color: "#dc2626" }}>
          {error}
        </p>
      )}
    </div>
  );
}