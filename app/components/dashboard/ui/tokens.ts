export const dashboardColors = {
  background: {
    page: "#f6f8fb",
    pageSoft: "#fbfcfe",
    surface: "#ffffff",
    surfaceSoft: "#f8fafc",
    surfaceMuted: "#f1f5f9",
    overlay: "rgba(15, 23, 42, 0.48)",
  },
  border: {
    subtle: "rgba(226, 232, 240, 0.82)",
    default: "rgba(203, 213, 225, 0.92)",
    strong: "rgba(148, 163, 184, 0.72)",
    focus: "rgba(37, 99, 235, 0.42)",
  },
  text: {
    primary: "#0f172a",
    secondary: "#334155",
    muted: "#64748b",
    subtle: "#94a3b8",
    inverse: "#ffffff",
  },
  primary: {
    50: "#eff6ff",
    100: "#dbeafe",
    500: "#2563eb",
    600: "#1d4ed8",
    700: "#1e40af",
  },
  accent: {
    indigo: "#4f46e5",
    purple: "#7c3aed",
    softIndigo: "rgba(79, 70, 229, 0.10)",
    softPurple: "rgba(124, 58, 237, 0.10)",
  },
  status: {
    green: "#16a34a",
    greenSoft: "#ecfdf5",
    amber: "#d97706",
    amberSoft: "#fffbeb",
    red: "#dc2626",
    redSoft: "#fef2f2",
  },
} as const;

export const dashboardSpacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const dashboardRadii = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  full: 999,
} as const;

export const dashboardShadows = {
  xs: "0 1px 2px rgba(15, 23, 42, 0.05)",
  sm: "0 8px 18px rgba(15, 23, 42, 0.06)",
  md: "0 14px 32px rgba(15, 23, 42, 0.08)",
  lg: "0 24px 56px rgba(15, 23, 42, 0.12)",
  primary: "0 16px 34px rgba(37, 99, 235, 0.24)",
  inset: "inset 0 1px 0 rgba(255, 255, 255, 0.86)",
} as const;

export const dashboardTypography = {
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  size: {
    xs: 11,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
    "2xl": 24,
    "3xl": 32,
  },
  weight: {
    regular: 500,
    medium: 650,
    semibold: 750,
    bold: 850,
    black: 950,
  },
  lineHeight: {
    tight: 1.1,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.7,
  },
} as const;

export const dashboardZIndex = {
  base: 1,
  sticky: 100,
  header: 1000,
  popover: 1200,
  overlay: 3000,
  modal: 3100,
  toast: 4000,
} as const;

export const dashboardBreakpoints = {
  mobile: 900,
  tablet: 1100,
  desktop: 1280,
  wide: 1440,
} as const;

export const dashboardTransitions = {
  fast: "120ms ease",
  base: "170ms ease",
  slow: "240ms ease",
  interactive:
    "background 170ms ease, border-color 170ms ease, color 170ms ease, box-shadow 170ms ease, transform 170ms ease",
} as const;

export const dashboardTokens = {
  colors: dashboardColors,
  spacing: dashboardSpacing,
  radii: dashboardRadii,
  shadows: dashboardShadows,
  typography: dashboardTypography,
  zIndex: dashboardZIndex,
  breakpoints: dashboardBreakpoints,
  transitions: dashboardTransitions,
} as const;
