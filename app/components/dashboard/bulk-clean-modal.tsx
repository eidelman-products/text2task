"use client";

import { useMemo } from "react";

type TopSender = {
  sender: string;
  count: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (selected: TopSender[]) => void;

  rows: TopSender[];
  remainingWeeklyCleanup: number;
  plan: "free" | "pro";
};

export default function BulkCleanModal({
  open,
  onClose,
  onConfirm,
  rows,
  remainingWeeklyCleanup,
  plan,
}: Props) {
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => b.count - a.count);
  }, [rows]);

  const { selected, skipped, selectedCount } = useMemo(() => {
    if (plan === "pro") {
      return {
        selected: sorted,
        skipped: [],
        selectedCount: sorted.reduce((acc, r) => acc + r.count, 0),
      };
    }

    let remaining = remainingWeeklyCleanup;
    const selected: TopSender[] = [];
    const skipped: TopSender[] = [];

    for (const row of sorted) {
      if (remaining <= 0) {
        skipped.push(row);
        continue;
      }

      if (row.count <= remaining) {
        selected.push(row);
        remaining -= row.count;
      } else {
        skipped.push(row);
      }
    }

    return {
      selected,
      skipped,
      selectedCount: selected.reduce((acc, r) => acc + r.count, 0),
    };
  }, [sorted, remainingWeeklyCleanup, plan]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 560,
          maxHeight: "80vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 20,
          padding: 20,
        }}
      >
        {/* HEADER */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>
            Clean Promotions
          </div>

          <div
            style={{
              fontSize: 14,
              color: "#64748b",
              marginTop: 6,
              fontWeight: 600,
            }}
          >
            {plan === "pro"
              ? `You're about to clean ${selectedCount} emails`
              : `You can clean ${selectedCount} emails this week`}
          </div>
        </div>

        {/* INFO FREE */}
        {plan === "free" && (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fdba74",
              padding: 10,
              borderRadius: 12,
              marginBottom: 12,
              fontSize: 13,
              fontWeight: 700,
              color: "#9a3412",
            }}
          >
            Free plan limit: {remainingWeeklyCleanup} emails per week  
            We selected the largest senders first.
          </div>
        )}

        {/* LIST */}
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {selected.map((row) => (
            <div
              key={row.sender}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: 10,
                borderRadius: 10,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontWeight: 700 }}>{row.sender}</div>
              <div style={{ fontWeight: 800 }}>{row.count}</div>
            </div>
          ))}

          {skipped.length > 0 && (
            <>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#94a3b8",
                }}
              >
                Not included this week
              </div>

              {skipped.map((row) => (
                <div
                  key={row.sender}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: 10,
                    borderRadius: 10,
                    background: "#f1f5f9",
                    border: "1px dashed #cbd5f5",
                    opacity: 0.7,
                  }}
                >
                  <div>{row.sender}</div>
                  <div>{row.count}</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* CTA */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            onClick={() => onConfirm(selected)}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 12,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Clean {selectedCount} Emails
          </button>
        </div>

        {/* UPSELL */}
        {plan === "free" && skipped.length > 0 && (
          <div
            style={{
              marginTop: 12,
              textAlign: "center",
              fontSize: 13,
              fontWeight: 700,
              color: "#2563eb",
              cursor: "pointer",
            }}
          >
            Upgrade to Pro to clean all emails
          </div>
        )}
      </div>
    </div>
  );
}