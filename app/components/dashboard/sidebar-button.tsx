"use client";

import { useState } from "react";
import Link from "next/link";
import {
  dashboardColors,
  dashboardRadii,
  dashboardShadows,
  dashboardTransitions,
  dashboardTypography,
} from "./ui/tokens";

/**
 * Two mutually-exclusive rendering modes, not one prop bag with optional
 * fields: an in-page SPA view switch has no URL to navigate to (must stay a
 * `<button>`), and a routed destination is a real page (must be a semantic
 * `<a>`/`next/link`, never a button faking navigation with a JS handler).
 * The discriminated union makes mixing them a compile error instead of a
 * runtime accessibility bug.
 */
export type SidebarButtonProps =
  | { as?: "button"; label: string; active: boolean; onClick: () => void }
  | { as: "link"; label: string; active: boolean; href: string };

function getNavIcon(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes("dashboard")) return "▦";
  if (normalized.includes("extract")) return "✦";
  if (normalized.includes("tasks")) return "✓";
  if (normalized.includes("calendar")) return "▤";

  return "•";
}

export default function SidebarButton(props: SidebarButtonProps) {
  const { label, active } = props;
  const [hovered, setHovered] = useState(false);
  const icon = getNavIcon(label);

  const content = (
    <>
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 10,
          bottom: 10,
          width: active ? 3 : hovered ? 2 : 0,
          borderRadius: "0 999px 999px 0",
          background: active
            ? dashboardColors.primary[500]
            : "rgba(37, 99, 235, 0.26)",
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
          aria-hidden="true"
          style={{
            width: 27,
            height: 27,
            borderRadius: dashboardRadii.full,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            fontSize: 12,
            fontWeight: dashboardTypography.weight.black,
            color: active
              ? dashboardColors.primary[700]
              : hovered
                ? dashboardColors.primary[600]
                : dashboardColors.text.subtle,
            background: active
              ? "rgba(239, 246, 255, 0.96)"
              : hovered
                ? "rgba(239, 246, 255, 0.68)"
                : "rgba(248, 250, 252, 0.7)",
            border: active
              ? "1px solid rgba(191, 219, 254, 0.92)"
              : "1px solid rgba(226, 232, 240, 0.82)",
            boxShadow: active
              ? "0 7px 14px rgba(37, 99, 235, 0.075)"
              : "none",
            transition:
              "background 170ms ease, color 170ms ease, box-shadow 170ms ease, border-color 170ms ease",
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
    </>
  );

  if (props.as === "link") {
    return (
      <Link
        href={props.href}
        aria-current={active ? "page" : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={itemStyle({ active, hovered })}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-current={active ? "true" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={itemStyle({ active, hovered })}
    >
      {content}
    </button>
  );
}

function itemStyle({
  active,
  hovered,
}: {
  active: boolean;
  hovered: boolean;
}): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    minHeight: 42,
    textAlign: "left",
    textDecoration: "none",
    border: active
      ? "1px solid rgba(191, 219, 254, 0.88)"
      : hovered
        ? "1px solid rgba(226, 232, 240, 0.92)"
        : "1px solid transparent",
    background: active
      ? "linear-gradient(135deg, rgba(239, 246, 255, 0.92) 0%, rgba(255, 255, 255, 0.98) 100%)"
      : hovered
        ? "rgba(248, 250, 252, 0.78)"
        : "transparent",
    color: active
      ? dashboardColors.primary[700]
      : hovered
        ? dashboardColors.text.primary
        : dashboardColors.text.secondary,
    borderRadius: dashboardRadii.xl,
    padding: "7px 10px 7px 9px",
    fontSize: 13,
    fontWeight: active
      ? dashboardTypography.weight.black
      : dashboardTypography.weight.bold,
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
    transition: dashboardTransitions.interactive,
    transform: hovered ? "translateX(1px)" : "translateX(0)",
    boxShadow: active
      ? "0 10px 24px rgba(37, 99, 235, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.94)"
      : hovered
        ? dashboardShadows.xs
        : "none",
    outline: "none",
  };
}