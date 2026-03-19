"use client";

import { useEffect, useRef, useState } from "react";

type SampleScanCtaProps = {
  loadingScan: boolean;
  onRunSampleScan: () => void;
  plan?: "free" | "pro";
};

const SAMPLE_SCAN_STEPS = [
  "Connecting to Gmail...",
  "Reading recent inbox emails...",
  "Grouping top senders...",
  "Preparing smart views...",
  "Finalizing scan results...",
];

const FULL_SCAN_STEPS = [
  "Connecting to Gmail...",
  "Scanning your full inbox...",
  "Reading sender metadata...",
  "Building smart views...",
  "Finalizing full scan results...",
];

export default function SampleScanCta({
  loadingScan,
  onRunSampleScan,
  plan = "free",
}: SampleScanCtaProps) {
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

  useEffect(() => {
    clearTimers();

    if (!loadingScan) {
      if (progress > 0) {
        setProgress(100);
        setStatusText(plan === "pro" ? "Full Scan completed." : "Sample Scan completed.");

        const timeout = setTimeout(() => {
          setProgress(0);
          setStatusText("");
        }, 1000);

        return () => clearTimeout(timeout);
      }

      setProgress(0);
      setStatusText("");
      return;
    }

    const steps = plan === "pro" ? FULL_SCAN_STEPS : SAMPLE_SCAN_STEPS;

    setProgress(6);
    setStatusText(steps[0]);

    let currentStep = 0;

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        if (prev < 25) return prev + 4;
        if (prev < 45) return prev + 3;
        if (prev < 65) return prev + 2;
        if (prev < 82) return prev + 1;
        return prev + 0.5;
      });
    }, 500);

    statusIntervalRef.current = setInterval(() => {
      currentStep = Math.min(currentStep + 1, steps.length - 1);
      setStatusText(steps[currentStep]);
    }, 1800);

    return () => clearTimers();
  }, [loadingScan, plan, progress]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  return (
    <div
      style={{
        border: "1px solid #dbe4ff",
        borderRadius: "24px",
        padding: "24px",
        background: "#f8fbff",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "8px 14px",
          borderRadius: "999px",
          background: "#e8f0ff",
          color: "#2f66f6",
          fontWeight: 600,
          fontSize: "14px",
          marginBottom: "18px",
        }}
      >
        {plan === "pro" ? "Pro Full Scan available" : "Sample Scan required"}
      </div>

      <h2
        style={{
          margin: "0 0 16px 0",
          fontSize: "32px",
          lineHeight: 1.15,
          color: "#0f172a",
        }}
      >
        {plan === "pro" ? "Run a full scan of your inbox" : "Start by scanning your inbox"}
      </h2>

      <p
        style={{
          margin: "0 0 22px 0",
          fontSize: "15px",
          lineHeight: 1.7,
          color: "#475569",
          maxWidth: "760px",
        }}
      >
        {plan === "pro" ? (
          <>
            InboxShaper does not scan automatically. Nothing is analyzed until you
            click <strong>Run Full Scan</strong>. Pro plan analyzes your{" "}
            <strong>full inbox</strong> and unlocks deeper cleanup and better
            visibility.
          </>
        ) : (
          <>
            InboxShaper does not scan automatically. Nothing is analyzed until you
            click <strong>Run Sample Scan</strong>. Free plan analyzes up to{" "}
            <strong>1000 latest emails</strong> and lets you clean up to{" "}
            <strong>250 emails per week</strong>.
          </>
        )}
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={onRunSampleScan}
          disabled={loadingScan}
          style={{
            background: loadingScan ? "#94a3b8" : "#2563eb",
            color: "white",
            border: "none",
            padding: "14px 18px",
            borderRadius: "14px",
            cursor: loadingScan ? "not-allowed" : "pointer",
            fontSize: "15px",
            fontWeight: 700,
            minWidth: "180px",
            boxShadow: loadingScan
              ? "none"
              : "0 12px 24px rgba(37, 99, 235, 0.22)",
          }}
        >
          {loadingScan
            ? plan === "pro"
              ? "Running Full Scan..."
              : "Scanning..."
            : plan === "pro"
            ? "Run Full Scan"
            : "Run Sample Scan"}
        </button>

        {plan === "free" ? (
          <button
            type="button"
            style={{
              background: "white",
              color: "#2563eb",
              border: "1px solid #c7d2fe",
              padding: "14px 18px",
              borderRadius: "14px",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: 700,
            }}
          >
            Unlock Full Scan (Pro)
          </button>
        ) : null}
      </div>

      {(loadingScan || progress > 0) && (
        <div style={{ marginTop: "18px", maxWidth: "560px" }}>
          <div
            style={{
              width: "100%",
              height: "10px",
              background: "#e2e8f0",
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
              color: "#475569",
            }}
          >
            <span>{statusText || "Preparing scan..."}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}