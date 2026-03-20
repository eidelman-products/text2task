"use client";

import NoScanState from "./no-scan-state";

type SampleScanCtaProps = {
  loadingScan: boolean;
  onRunSampleScan: () => void;
  onRunFullScan?: () => void;
  plan?: "free" | "pro";
};

export default function SampleScanCta({
  loadingScan,
  onRunSampleScan,
  onRunFullScan,
}: SampleScanCtaProps) {
  return (
    <NoScanState
      loadingScan={loadingScan}
      onRunSampleScan={onRunSampleScan}
      onRunFullScan={onRunFullScan}
    />
  );
}