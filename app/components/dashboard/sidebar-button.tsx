import { useState } from "react";

type SidebarButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

export default function SidebarButton({
  label,
  active,
  onClick,
}: SidebarButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        textAlign: "left",
        border: active
          ? "1px solid rgba(96,165,250,0.30)"
          : hovered
          ? "1px solid rgba(148,163,184,0.18)"
          : "1px solid transparent",
        background: active
          ? "linear-gradient(90deg, rgba(59,130,246,0.10) 0%, rgba(99,102,241,0.08) 100%)"
          : hovered
          ? "linear-gradient(90deg, rgba(255,255,255,0.88) 0%, rgba(239,246,255,0.92) 100%)"
          : "transparent",
        color: active ? "#2563eb" : "#334155",
        borderRadius: 20,
        padding: "15px 16px 15px 18px",
        fontSize: 16,
        fontWeight: active ? 850 : hovered ? 800 : 760,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        transition:
          "all 180ms ease, transform 140ms ease, box-shadow 180ms ease",
        transform: hovered ? "translateX(4px)" : "translateX(0)",
        boxShadow: active
          ? "0 12px 24px rgba(59,130,246,0.10)"
          : hovered
          ? "0 10px 18px rgba(15,23,42,0.05)"
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
          width: active ? 5 : hovered ? 4 : 0,
          borderRadius: 999,
          background: active
            ? "linear-gradient(180deg, #60a5fa 0%, #6366f1 100%)"
            : hovered
            ? "rgba(59,130,246,0.28)"
            : "transparent",
          boxShadow: active ? "0 0 14px rgba(99,102,241,0.24)" : "none",
          transition: "all 180ms ease",
        }}
      />

      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          position: "relative",
          zIndex: 1,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: active
              ? "linear-gradient(180deg, #60a5fa 0%, #6366f1 100%)"
              : hovered
              ? "rgba(59,130,246,0.46)"
              : "rgba(148,163,184,0.45)",
            boxShadow: active
              ? "0 0 0 6px rgba(59,130,246,0.10)"
              : hovered
              ? "0 0 0 5px rgba(59,130,246,0.08)"
              : "none",
            transition: "all 180ms ease",
            flexShrink: 0,
          }}
        />

        <span>{label}</span>
      </span>
    </button>
  );
}