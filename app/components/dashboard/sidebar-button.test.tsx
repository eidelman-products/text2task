// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SidebarButton from "./sidebar-button";

describe("SidebarButton - button mode (SPA workspace view switch)", () => {
  it("renders a semantic button, not a link", () => {
    render(<SidebarButton label="Dashboard" active={false} onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<SidebarButton label="Extract" active={false} onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "Extract" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("exposes aria-current when active, and omits it when inactive", () => {
    const { rerender } = render(
      <SidebarButton label="Tasks" active={true} onClick={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Tasks" })).toHaveAttribute(
      "aria-current",
      "true"
    );

    rerender(<SidebarButton label="Tasks" active={false} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Tasks" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("defaults to button mode when `as` is omitted", () => {
    render(<SidebarButton label="Dashboard" active={false} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
  });
});

describe("SidebarButton - link mode (routed destination)", () => {
  it("renders a semantic link with the given href, not a button", () => {
    render(
      <SidebarButton as="link" label="Dashboard" active={false} href="/dashboard" />
    );

    const link = screen.getByRole("link", { name: "Dashboard" });
    expect(link).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sets aria-current=\"page\" when active, and omits it when inactive", () => {
    const { rerender } = render(
      <SidebarButton as="link" label="Calendar" active={true} href="/dashboard/calendar" />
    );
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    rerender(
      <SidebarButton as="link" label="Calendar" active={false} href="/dashboard/calendar" />
    );
    expect(screen.getByRole("link", { name: "Calendar" })).not.toHaveAttribute(
      "aria-current"
    );
  });
});

describe("SidebarButton - accessible name and no nested interactive elements", () => {
  it("the label text is the accessible name in both modes", () => {
    render(<SidebarButton label="Tasks" active={false} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Tasks" })).toBeInTheDocument();
  });

  it("does not nest an interactive element inside the rendered item", () => {
    const { container } = render(
      <SidebarButton as="link" label="Dashboard" active={false} href="/dashboard" />
    );

    const link = container.querySelector("a");
    expect(link?.querySelector("a,button")).toBeNull();
  });
});
