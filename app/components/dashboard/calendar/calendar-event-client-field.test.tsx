// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CalendarClientOption } from "@/lib/calendar/calendar-types";
import { CalendarEventClientField } from "./calendar-event-client-field";

const OPTIONS: CalendarClientOption[] = [
  { id: "c1", name: "Acme" },
  { id: "c2", name: "Globex" },
];

describe("CalendarEventClientField — unlocked", () => {
  it("renders a combobox labeled 'Client' with the search-or-enter placeholder", () => {
    render(
      <CalendarEventClientField
        value={null}
        customValue={null}
        onChange={vi.fn()}
        options={OPTIONS}
        locked={false}
        lockedClientName={null}
      />
    );
    const input = screen.getByLabelText("Client");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("role", "combobox");
    expect(input).toHaveAttribute("placeholder", "Search or enter a client");
  });

  it("is independently selectable when unlocked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CalendarEventClientField
        value={null}
        customValue={null}
        onChange={onChange}
        options={OPTIONS}
        locked={false}
        lockedClientName={null}
      />
    );

    const input = screen.getByLabelText("Client");
    expect(input).not.toBeDisabled();

    await user.click(input);
    await user.click(screen.getByRole("option", { name: "Globex" }));
    expect(onChange).toHaveBeenCalledWith({ id: "c2", customName: null });
  });

  it("typing a name with no match and blurring commits it as a custom Client name", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CalendarEventClientField
        value={null}
        customValue={null}
        onChange={onChange}
        options={OPTIONS}
        locked={false}
        lockedClientName={null}
      />
    );

    await user.type(screen.getByLabelText("Client"), "Brand new client");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith({ id: null, customName: "Brand new client" });
  });

  it("clearing calls onChange with both fields null", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CalendarEventClientField
        value="c1"
        customValue={null}
        onChange={onChange}
        options={OPTIONS}
        locked={false}
        lockedClientName={null}
      />
    );

    await user.click(screen.getByRole("button", { name: "Clear Client" }));
    expect(onChange).toHaveBeenCalledWith({ id: null, customName: null });
  });

  it("shows the custom name directly when customValue is set", () => {
    render(
      <CalendarEventClientField
        value={null}
        customValue="Not yet in Text2Task"
        onChange={vi.fn()}
        options={OPTIONS}
        locked={false}
        lockedClientName={null}
      />
    );
    expect(screen.getByLabelText("Client")).toHaveValue("Not yet in Text2Task");
  });

  it("respects an independent disabled prop even when unlocked", () => {
    render(
      <CalendarEventClientField
        value={null}
        customValue={null}
        onChange={vi.fn()}
        options={OPTIONS}
        locked={false}
        lockedClientName={null}
        disabled
      />
    );
    expect(screen.getByLabelText("Client")).toBeDisabled();
  });
});

describe("CalendarEventClientField — locked", () => {
  it("is disabled and displays the derived client as read-only text, never the interactive combobox", () => {
    render(
      <CalendarEventClientField
        value={null}
        customValue={null}
        onChange={vi.fn()}
        options={OPTIONS}
        locked
        lockedClientName="Acme"
      />
    );
    const input = screen.getByLabelText("Client") as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(input).toHaveValue("Acme");
    expect(input).not.toHaveAttribute("role", "combobox");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("is disabled and displays 'No client' when the locked project has none", () => {
    render(
      <CalendarEventClientField
        value={null}
        customValue={null}
        onChange={vi.fn()}
        options={OPTIONS}
        locked
        lockedClientName={null}
      />
    );
    const input = screen.getByLabelText("Client") as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(input).toHaveValue("No client");
  });
});

describe("CalendarEventClientField — touch target and accessibility", () => {
  it("has at least a 44px touch target", () => {
    render(
      <CalendarEventClientField
        value={null}
        customValue={null}
        onChange={vi.fn()}
        options={OPTIONS}
        locked={false}
        lockedClientName={null}
      />
    );
    const input = screen.getByLabelText("Client") as HTMLInputElement;
    expect(input.style.minHeight).toBe("44px");
  });

  it("sets aria-invalid and aria-describedby when invalid", () => {
    render(
      <CalendarEventClientField
        value={null}
        customValue={null}
        onChange={vi.fn()}
        options={OPTIONS}
        locked={false}
        lockedClientName={null}
        invalid
        aria-describedby="client-error"
      />
    );
    const input = screen.getByLabelText("Client");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "client-error");
  });
});
