"use client";

import { useState } from "react";

type SidebarButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function getNavIcon(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes("dashboard")) return "▦";
  if (normalized.includes("extract")) return "✦";
  if (normalized.includes("tasks")) return "✓";

  return "•";
}

export default function SidebarButton({
  label,
  active,
  onClick,
}: SidebarButtonProps) {
  const [hovered, setHovered] = useState(false);
  const icon = getNavIcon(label);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        minHeight: 46,
        textAlign: "left",
        border: active
          ? "1px solid rgba(99,102,241,0.24)"
          : hovered
            ? "1px solid rgba(203,213,225,0.68)"
            : "1px solid transparent",
        background: active
          ? "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(238,242,255,0.92) 100%)"
          : hovered
            ? "linear-gradient(135deg, rgba(255,255,255,0.88) 0%, rgba(248,250,252,0.92) 100%)"
            : "transparent",
        color: active ? "#3730a3" : hovered ? "#1e293b" : "#475569",
        borderRadius: 16,
        padding: "9px 11px",
        fontSize: 14,
        fontWeight: active ? 920 : hovered ? 850 : 780,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        transition:
          "border-color 170ms ease, background 170ms ease, color 170ms ease, transform 170ms ease, box-shadow 170ms ease",
        transform: hovered ? "translateX(2px)" : "translateX(0)",
        boxShadow: active
          ? "0 14px 28px rgba(79,70,229,0.105), inset 0 1px 0 rgba(255,255,255,0.92)"
          : hovered
            ? "0 10px 22px rgba(15,23,42,0.045)"
            : "none",
        outline: "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 10,
          bottom: 10,
          width: active ? 4 : hovered ? 3 : 0,
          borderRadius: "0 999px 999px 0",
          background: active
            ? "linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%)"
            : "rgba(99,102,241,0.28)",
          boxShadow: active ? "0 0 18px rgba(99,102,241,0.30)" : "none",
          transition: "width 170ms ease, background 170ms ease",
        }}
      />

      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          position: "relative",
          zIndex: 1,
          minWidth: 0,
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 11,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            fontSize: 13,
            fontWeight: 950,
            color: active ? "#ffffff" : hovered ? "#4f46e5" : "#94a3b8",
            background: active
              ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
              : hovered
                ? "rgba(238,242,255,0.95)"
                : "rgba(248,250,252,0.86)",
            border: active
              ? "1px solid rgba(99,102,241,0.10)"
              : "1px solid rgba(226,232,240,0.82)",
            boxShadow: active
              ? "0 10px 18px rgba(79,70,229,0.22)"
              : "none",
            transition:
              "background 170ms ease, color 170ms ease, box-shadow 170ms ease",
          }}
        >
          {icon}
        </span>

        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            letterSpacing: "-0.015em",
          }}
        >
          {label}
        </span>
      </span>
    </button>
  );
}