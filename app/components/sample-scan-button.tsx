"use client";

import { useEffect, useRef, useState } from "react";

type ScanStatusResponse = {
  scanId: string;
  scanType: "sample" | "full";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  currentStep: string;
  processedMessages?: number;
  nextPageToken?: string | null;
  errorMessage?: string | null;
};

export default function SampleScanButton() {
  const [loading, setLoading] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const pollingRef = useRef<number | null>(null);

  function stopPolling() {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  async function loadScanStatus(currentScanId: string) {
    try {
      const res = await fetch(`/api/scans/${currentScanId}/status`, {
        method: "GET",
        cache: "no-store",
      });

      const data: ScanStatusResponse = await res.json();

      if (!res.ok) {
        setError((data as any)?.error || "Failed to load scan status");
        setLoading(false);
        stopPolling();
        return;
      }

      setProgress(typeof data.progress === "number" ? data.progress : 0);
      setStatusText(
        typeof data.currentStep === "string" && data.currentStep
          ? data.currentStep
          : "Scanning..."
      );

      if (data.status === "completed") {
        setLoading(false);
        setResult(typeof data.processedMessages === "number" ? data.processedMessages : 0);
        setStatusText("Free Scan completed successfully.");
        stopPolling();
        return;
      }

      if (data.status === "failed" || data.status === "cancelled") {
        setLoading(false);
        setError(data.errorMessage || `Scan ${data.status}.`);
        setStatusText("");
        stopPolling();
      }
    } catch (err) {
      setLoading(false);
      setError("Failed to load scan status");
      setStatusText("");
      stopPolling();
    }
  }

  function startPolling(newScanId: string) {
    stopPolling();

    void loadScanStatus(newScanId);

    pollingRef.current = window.setInterval(() => {
      void loadScanStatus(newScanId);
    }, 2500);
  }

  async function runScan() {
    try {
      setLoading(true);
      setResult(null);
      setError("");
      setProgress(0);
      setStatusText("Starting free scan...");

      const res = await fetch("/api/scans/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ scanType: "sample" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start free scan");
        setLoading(false);
        setStatusText("");
        return;
      }

      const newScanId = String(data.scanId);
      setScanId(newScanId);
      setProgress(typeof data.progress === "number" ? data.progress : 0);
      setStatusText(
        typeof data.currentStep === "string" && data.currentStep
          ? data.currentStep
          : "Starting free scan..."
      );

      startPolling(newScanId);
    } catch (err) {
      setLoading(false);
      setError("Something went wrong while starting the free scan");
      setProgress(0);
      setStatusText("");
    }
  }

  useEffect(() => {
    return () => {
      stopPolling();
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
        {loading ? "Scanning inbox..." : "Run Free Scan"}
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

          {scanId && (
            <div
              style={{
                marginTop: "8px",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              Scan ID: {scanId}
            </div>
          )}
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
          Free scan completed. Scanned {result} emails.
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