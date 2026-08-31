// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { AnalyticsErrorBoundary } from "./analytics-error-boundary";

function Bomb(): never {
  throw new Error("simulated analytics render failure");
}

describe("AnalyticsErrorBoundary", () => {
  it("renders children normally when there is no error", () => {
    const { getByText } = render(
      <AnalyticsErrorBoundary>
        <p>ok</p>
      </AnalyticsErrorBoundary>
    );

    expect(getByText("ok")).toBeInTheDocument();
  });

  it("renders nothing (not a crash) when a child throws during render", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { container } = render(
      <AnalyticsErrorBoundary>
        <Bomb />
      </AnalyticsErrorBoundary>
    );

    expect(container).toBeEmptyDOMElement();

    consoleErrorSpy.mockRestore();
  });

  it("does not affect a sibling tree outside the boundary", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { getByText } = render(
      <div>
        <AnalyticsErrorBoundary>
          <Bomb />
        </AnalyticsErrorBoundary>
        <p>core app content</p>
      </div>
    );

    expect(getByText("core app content")).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
