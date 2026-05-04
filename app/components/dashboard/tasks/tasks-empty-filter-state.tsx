import type { CSSProperties } from "react";

export default function TasksEmptyFilterState() {
  return (
    <div style={emptyTableStateStyle}>
      <div style={emptyIconStyle}>⌕</div>
      <div style={emptyTitleStyle}>No matching tasks</div>
      <div style={emptyDescriptionStyle}>
        Try changing the search text, status filter, priority filter, or sort
        option.
      </div>
    </div>
  );
}

const emptyTableStateStyle: CSSProperties = {
  minHeight: 220,
  display: "grid",
  placeItems: "center",
  gap: 8,
  padding: 28,
  textAlign: "center",
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.72) 0%, rgba(255,255,255,1) 100%)",
};

const emptyIconStyle: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "rgba(99,102,241,0.10)",
  border: "1px solid rgba(99,102,241,0.14)",
  color: "#4f46e5",
  fontSize: 24,
  fontWeight: 900,
};

const emptyTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 950,
  color: "#0f172a",
  letterSpacing: "-0.03em",
};

const emptyDescriptionStyle: CSSProperties = {
  maxWidth: 520,
  fontSize: 14,
  color: "#64748b",
  lineHeight: 1.65,
};