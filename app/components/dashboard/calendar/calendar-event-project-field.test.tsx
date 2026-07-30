// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CalendarProjectOption } from "@/lib/calendar/calendar-types";
import { CalendarEventProjectField } from "./calendar-event-project-field";

const OPTIONS: CalendarProjectOption[] = [
  { id: "p1", title: "Website redesign", clientId: "c1", clientName: "Acme", isArchived: false },
  { id: "p2", title: "Old campaign", clientId: null, clientName: null, isArchived: true },
];

describe("CalendarEventProjectField", () => {
  it("renders a select labeled 'Project' with a 'No project' default option", () => {
    render(<CalendarEventProjectField value={null} onChange={vi.fn()} options={[]} />);
    const select = screen.getByLabelText("Project");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No project" })).toBeInTheDocument();
  });

  it("renders every option by title", () => {
    render(<CalendarEventProjectField value={null} onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.getByRole("option", { name: "Website redesign" })).toBeInTheDocument();
  });

  it("renders an archived option with an '(Archived)' affix", () => {
    render(<CalendarEventProjectField value={null} onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.getByRole("option", { name: "Old campaign (Archived)" })).toBeInTheDocument();
  });

  it("calls onChange with the selected project id", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CalendarEventProjectField value={null} onChange={onChange} options={OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Project"), "p1");

    expect(onChange).toHaveBeenCalledWith("p1");
  });

  it("calls onChange with null when reset to 'No project'", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CalendarEventProjectField value="p1" onChange={onChange} options={OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Project"), "");

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("is disabled while options load or fail", () => {
    render(<CalendarEventProjectField value={null} onChange={vi.fn()} options={[]} disabled />);
    expect(screen.getByLabelText("Project")).toBeDisabled();
  });

  it("has at least a 44px touch target", () => {
    render(<CalendarEventProjectField value={null} onChange={vi.fn()} options={[]} />);
    const select = screen.getByLabelText("Project") as HTMLSelectElement;
    expect(select.style.minHeight).toBe("44px");
  });

  it("sets aria-invalid and aria-describedby when invalid", () => {
    render(
      <CalendarEventProjectField
        value={null}
        onChange={vi.fn()}
        options={[]}
        invalid
        aria-describedby="project-error"
      />
    );
    const select = screen.getByLabelText("Project");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAttribute("aria-describedby", "project-error");
  });
});
