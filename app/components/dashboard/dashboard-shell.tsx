"use client";

import type { ReactNode } from "react";

const TOP_BOTTOM_PADDING = 0;
const RIGHT_PADDING = 20;
const SIDEBAR_WIDTH = 286;

export default function DashboardShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #eef4ff 0%, #f6f8fc 38%, #f8fafc 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          minHeight: "100vh",
          paddingTop: TOP_BOTTOM_PADDING,
          paddingBottom: TOP_BOTTOM_PADDING,
          paddingLeft: 0,
          paddingRight: RIGHT_PADDING,
          gap: 22,
        }}
      >
        <aside
          style={{
            width: SIDEBAR_WIDTH,
            minWidth: SIDEBAR_WIDTH,
            position: "sticky",
            top: 0,
            alignSelf: "flex-start",
            height: "100vh",
            overflowY: "auto",
            padding: "24px 22px 22px",
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            borderTopRightRadius: 34,
            borderBottomRightRadius: 34,
            border: "1px solid rgba(226,232,240,0.96)",
            borderLeft: "none",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(247,250,255,0.96) 100%)",
            boxShadow:
              "0 18px 40px rgba(37,99,235,0.06), inset 0 1px 0 rgba(255,255,255,0.74)",
          }}
        >
          {sidebar}
        </aside>

        <main
          style={{
            flex: 1,
            minWidth: 0,
            paddingTop: 16,
            paddingBottom: 18,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}