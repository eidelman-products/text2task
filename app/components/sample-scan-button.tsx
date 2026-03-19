"use client";

import { useEffect, useRef, useState } from "react";

const SCAN_STEPS = [
  "Connecting to Gmail...",
  "Reading recent inbox emails...",
  "Grouping top senders...",
  "Preparing smart views...",
  "Finalizing scan results...",
];

export default function SampleScanButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  function clearTimers() {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
  }

  function startFakeProgress() {
    setProgress(6);
    setStatusText(SCAN_STEPS[0]);

    let currentStep = 0;

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;

        if (prev < 30) return prev + 6;
        if (prev < 55) return prev + 4;
        if (prev < 75) return prev + 3;
        if (prev < 88) return prev + 2;

        return prev + 1;
      });
    }, 350);

    statusIntervalRef.current = setInterval(() => {
      currentStep = (currentStep + 1) % SCAN_STEPS.length;
      setStatusText(SCAN_STEPS[currentStep]);
    }, 1400);
  }

  async function runScan() {
    try {
      setLoading(true);
      setResult(null);
      setError("");
      setProgress(0);
      setStatusText("");

      startFakeProgress();

      const res = await fetch("/api/scan/sample", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        clearTimers();
        setError(data.error || "Scan failed");
        setProgress(0);
        setStatusText("");
        return;
      }

      clearTimers();
      setProgress(100);
      setStatusText("Scan completed.");

      setResult(data.scanned ?? 0);

      setTimeout(() => {
        setStatusText("");
      }, 1200);
    } catch (err) {
      clearTimers();
      setError("Something went wrong while starting the scan");
      setProgress(0);
      setStatusText("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  return (
    <div style={{ maxWidth: "420px" }}>
      <button
        onClick={runScan}
        disabled={loading}
        style={{
          background: loading ? "#2563eb" : "#111827",
          color: "white",
          border: "none",
          padding: "12px 18px",
          borderRadius: "10px",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "14px",
          fontWeight: 600,
          opacity: loading ? 0.92 : 1,
          minWidth: "180px",
          boxShadow: loading
            ? "0 8px 20px rgba(37, 99, 235, 0.22)"
            : "0 6px 18px rgba(17, 24, 39, 0.16)",
          transition: "all 0.2s ease",
        }}
      >
        {loading ? "Scanning inbox..." : "Run Sample Scan"}
      </button>

      {loading && (
        <div style={{ marginTop: "14px" }}>
          <div
            style={{
              width: "100%",
              height: "10px",
              background: "#e5e7eb",
              borderRadius: "999px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #2563eb, #60a5fa)",
                borderRadius: "999px",
                transition: "width 0.35s ease",
              }}
            />
          </div>

          <div
            style={{
              marginTop: "8px",
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              fontSize: "13px",
              color: "#374151",
            }}
          >
            <span>{statusText || "Scanning..."}</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}

      {result !== null && !loading && (
        <p
          style={{
            marginTop: "12px",
            color: "#065f46",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: "10px",
            padding: "10px 12px",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          Sample scan completed. Scanned {result} emails.
        </p>
      )}

      {error && (
        <p
          style={{
            marginTop: "12px",
            color: "#b91c1c",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "10px",
            padding: "10px 12px",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}