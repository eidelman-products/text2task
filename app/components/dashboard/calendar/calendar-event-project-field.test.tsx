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
  it("renders a combobox labeled 'Project' with the search-or-enter placeholder", () => {
    render(<CalendarEventProjectField value={null} customValue={null} onChange={vi.fn()} options={[]} />);
    const input = screen.getByLabelText("Project");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("role", "combobox");
    expect(input).toHaveAttribute("placeholder", "Search or enter a project");
  });

  it("shows the linked option's title when value.id is set", () => {
    render(<CalendarEventProjectField value="p1" customValue={null} onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.getByLabelText("Project")).toHaveValue("Website redesign");
  });

  it("shows the custom name directly when customValue is set", () => {
    render(<CalendarEventProjectField value={null} customValue="Not yet in Text2Task" onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.getByLabelText("Project")).toHaveValue("Not yet in Text2Task");
  });

  it("shows an archived option with an '(Archived)' suffix in its suggestion", async () => {
    const user = userEvent.setup();
    render(<CalendarEventProjectField value={null} customValue={null} onChange={vi.fn()} options={OPTIONS} />);

    await user.click(screen.getByLabelText("Project"));
    expect(screen.getByRole("option", { name: /Old campaign\s*\(Archived\)/ })).toBeInTheDocument();
  });

  it("filters suggestions as the user types", async () => {
    const user = userEvent.setup();
    render(<CalendarEventProjectField value={null} customValue={null} onChange={vi.fn()} options={OPTIONS} />);

    await user.type(screen.getByLabelText("Project"), "Website");

    expect(screen.getByRole("option", { name: "Website redesign" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Old campaign/ })).not.toBeInTheDocument();
  });

  it("selecting a suggestion via mouse click calls onChange with its id, never a custom name", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CalendarEventProjectField value={null} customValue={null} onChange={onChange} options={OPTIONS} />);

    await user.click(screen.getByLabelText("Project"));
    await user.click(screen.getByRole("option", { name: "Website redesign" }));

    expect(onChange).toHaveBeenCalledWith({ id: "p1", customName: null });
    expect(screen.getByLabelText("Project")).toHaveValue("Website redesign");
  });

  it("selecting a suggestion via ArrowDown + Enter calls onChange with its id", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CalendarEventProjectField value={null} customValue={null} onChange={onChange} options={OPTIONS} />);

    const input = screen.getByLabelText("Project");
    await user.click(input);
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith({ id: "p1", customName: null });
  });

  it("closes the suggestion list on Escape without discarding typed text", async () => {
    const user = userEvent.setup();
    render(<CalendarEventProjectField value={null} customValue={null} onChange={vi.fn()} options={OPTIONS} />);

    const input = screen.getByLabelText("Project");
    await user.type(input, "Web");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("Web");
  });

  it("typing a name with no match and blurring commits it as a custom Project name", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CalendarEventProjectField value={null} customValue={null} onChange={onChange} options={OPTIONS} />);

    await user.type(screen.getByLabelText("Project"), "Brand new project");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith({ id: null, customName: "Brand new project" });
  });

  it("typing free text and pressing Enter with nothing highlighted commits it as custom", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CalendarEventProjectField value={null} customValue={null} onChange={onChange} options={OPTIONS} />);

    await user.type(screen.getByLabelText("Project"), "Brand new project{Enter}");

    expect(onChange).toHaveBeenCalledWith({ id: null, customName: "Brand new project" });
  });

  it("clearing an existing linked value calls onChange with both fields null", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CalendarEventProjectField value="p1" customValue={null} onChange={onChange} options={OPTIONS} />);

    await user.click(screen.getByRole("button", { name: "Clear Project" }));

    expect(onChange).toHaveBeenCalledWith({ id: null, customName: null });
    expect(screen.getByLabelText("Project")).toHaveValue("");
  });

  it("blurring an emptied field calls onChange with both fields null", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CalendarEventProjectField value={null} customValue="Something" onChange={onChange} options={OPTIONS} />);

    const input = screen.getByLabelText("Project");
    await user.clear(input);
    await user.tab();

    expect(onChange).toHaveBeenCalledWith({ id: null, customName: null });
  });

  it("is disabled while options load or fail", () => {
    render(<CalendarEventProjectField value={null} customValue={null} onChange={vi.fn()} options={[]} disabled />);
    expect(screen.getByLabelText("Project")).toBeDisabled();
  });

  it("has at least a 44px touch target", () => {
    render(<CalendarEventProjectField value={null} customValue={null} onChange={vi.fn()} options={[]} />);
    const input = screen.getByLabelText("Project") as HTMLInputElement;
    expect(input.style.minHeight).toBe("44px");
  });

  it("sets aria-invalid and aria-describedby when invalid", () => {
    render(
      <CalendarEventProjectField
        value={null}
        customValue={null}
        onChange={vi.fn()}
        options={[]}
        invalid
        aria-describedby="project-error"
      />
    );
    const input = screen.getByLabelText("Project");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "project-error");
  });
});
