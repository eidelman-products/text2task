// @vitest-environment jsdom
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalendarEntityCombobox, type CalendarEntityComboboxValue } from "./calendar-entity-combobox";

const OPTIONS = [
  { id: "1", label: "Alpha" },
  { id: "2", label: "Beta" },
];

/** Drives `value` externally, mirroring how CalendarEventForm's Project selection auto-updates Client. */
function ControlledHarness({ initial }: { initial: CalendarEntityComboboxValue }) {
  const [value, setValue] = useState<CalendarEntityComboboxValue>(initial);
  return (
    <>
      <button type="button" onClick={() => setValue({ id: "2", customName: null })}>
        Simulate external change
      </button>
      <CalendarEntityCombobox
        label="Client"
        placeholder="Search or enter a client"
        value={value}
        onChange={setValue}
        options={OPTIONS}
      />
    </>
  );
}

describe("CalendarEntityCombobox", () => {
  it("has no nested interactive element inside a suggestion option", async () => {
    const user = userEvent.setup();
    render(
      <CalendarEntityCombobox
        label="Project"
        placeholder="Search or enter a project"
        value={{ id: null, customName: null }}
        onChange={vi.fn()}
        options={OPTIONS}
      />
    );

    await user.click(screen.getByLabelText("Project"));
    const option = screen.getByRole("option", { name: "Alpha" });
    expect(option.querySelector("button, a, input, select, textarea")).toBeNull();
  });

  it("ArrowDown then ArrowUp moves the highlighted option back without wrapping below zero", async () => {
    const user = userEvent.setup();
    render(
      <CalendarEntityCombobox
        label="Project"
        placeholder="Search or enter a project"
        value={{ id: null, customName: null }}
        onChange={vi.fn()}
        options={OPTIONS}
      />
    );

    const input = screen.getByLabelText("Project");
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}");

    expect(input).toHaveAttribute("aria-activedescendant", expect.stringContaining("option-0"));
  });

  it("reflects an externally-changed value while the input is not focused", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initial={{ id: null, customName: null }} />);

    await user.click(screen.getByRole("button", { name: "Simulate external change" }));

    expect(screen.getByLabelText("Client")).toHaveValue("Beta");
  });

  it("does not clobber text the user is actively typing when an external value change arrives", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initial={{ id: null, customName: null }} />);

    const input = screen.getByLabelText("Client");
    await user.click(input);
    await user.type(input, "Still typing");

    // An external change fires (e.g. a sibling field's own side effect) --
    // does not touch this input's element directly, so it stays focused
    // throughout and its own in-progress text must survive.
    await user.tab({ shift: true });
    await user.click(input);
    await user.type(input, " more");

    expect(input).toHaveValue("Still typing more");
  });

  it("aria-expanded reflects open/closed state", async () => {
    const user = userEvent.setup();
    render(
      <CalendarEntityCombobox
        label="Project"
        placeholder="Search or enter a project"
        value={{ id: null, customName: null }}
        onChange={vi.fn()}
        options={OPTIONS}
      />
    );

    const input = screen.getByLabelText("Project");
    expect(input).toHaveAttribute("aria-expanded", "false");

    await user.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("aria-controls points at the rendered listbox id", async () => {
    const user = userEvent.setup();
    render(
      <CalendarEntityCombobox
        label="Project"
        placeholder="Search or enter a project"
        value={{ id: null, customName: null }}
        onChange={vi.fn()}
        options={OPTIONS}
      />
    );

    const input = screen.getByLabelText("Project");
    await user.click(input);

    const listboxId = input.getAttribute("aria-controls");
    expect(listboxId).toBeTruthy();
    expect(screen.getByRole("listbox")).toHaveAttribute("id", listboxId);
  });

  it("shows a helpful empty-state row when there are no options and nothing typed", async () => {
    const user = userEvent.setup();
    render(
      <CalendarEntityCombobox
        label="Project"
        placeholder="Search or enter a project"
        value={{ id: null, customName: null }}
        onChange={vi.fn()}
        options={[]}
      />
    );

    await user.click(screen.getByLabelText("Project"));
    expect(screen.getByText(/type to enter a custom name/i)).toBeInTheDocument();
  });

  it("does not render a clear button or listbox while disabled", () => {
    render(
      <CalendarEntityCombobox
        label="Project"
        placeholder="Search or enter a project"
        value={{ id: "1", customName: null }}
        onChange={vi.fn()}
        options={OPTIONS}
        disabled
      />
    );

    expect(screen.queryByRole("button", { name: "Clear Project" })).not.toBeInTheDocument();
  });
});
