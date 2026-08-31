"use client";

import { Component, type ReactNode } from "react";

type AnalyticsErrorBoundaryProps = {
  children: ReactNode;
};

type AnalyticsErrorBoundaryState = {
  hasError: boolean;
};

/**
 * Phase 3A analytics isolation. React error boundaries can only be class
 * components -- there is no hook equivalent. This boundary exists solely so
 * that a render-time error inside an analytics component (as opposed to the
 * effect-time failures already contained by try/catch inside
 * microsoft-clarity.tsx) can never take down the rest of the page: it
 * catches, renders nothing, and stops there. It must never wrap or affect
 * any core Text2Task UI -- only analytics components are ever placed inside
 * it.
 */
export class AnalyticsErrorBoundary extends Component<
  AnalyticsErrorBoundaryProps,
  AnalyticsErrorBoundaryState
> {
  state: AnalyticsErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AnalyticsErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}
