// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { createElement, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

import HomepageDemoReviewPage, { metadata } from "./page";

vi.mock("next/image", () => ({
  default: ({
    priority: _priority,
    alt,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) =>
    createElement("img", {
      ...props,
      alt: typeof alt === "string" ? alt : "",
    }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch: _prefetch,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("./HomepageDemoReviewClient", () => ({
  default: () => <section aria-label="Review client" />,
}));

describe("HomepageDemoReviewPage - Phase 2C copy and SEO posture", () => {
  it("renders one primary ready-state heading with the approved supporting copy", () => {
    render(<HomepageDemoReviewPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Your project is ready",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Save this project to your free Text2Task workspace and keep working with its tasks, client details, deadline, budget, and notes."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        level: 1,
        name: "Review your project draft",
      })
    ).not.toBeInTheDocument();
  });

  it("keeps the temporary review route out of indexing", () => {
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
      },
    });
  });
});
