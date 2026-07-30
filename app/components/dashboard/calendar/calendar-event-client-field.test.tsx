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
  it("renders a select labeled 'Client' with a 'No client' default option", () => {
    render(
      <CalendarEventClientField
        value={null}
        onChange={vi.fn()}
        options={OPTIONS}
        locked={false}
        lockedClientName={null}
      />
    );
    expect(screen.getByLabelText("Client")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No client" })).toBeInTheDocument();
  });

  it("is independently selectable when unlocked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CalendarEventClientField
        value={null}
        onChange={onChange}
        options={OPTIONS}
        locked={false}
        lockedClientName={null}
      />
    );

    const select = screen.getByLabelText("Client");
    expect(select).not.toBeDisabled();

    await user.selectOptions(select, "c2");
    expect(onChange).toHaveBeenCalledWith("c2");
  });

  it("calls onChange with null when reset to 'No client'", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CalendarEventClientField
        value="c1"
        onChange={onChange}
        options={OPTIONS}
        locked={false}
        lockedClientName={null}
      />
    );

    await user.selectOptions(screen.getByLabelText("Client"), "");
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("respects an independent disabled prop even when unlocked", () => {
    render(
      <CalendarEventClientField
        value={null}
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
  it("is disabled and displays the derived client", () => {
    render(
      <CalendarEventClientField
        value={null}
        onChange={vi.fn()}
        options={OPTIONS}
        locked
        lockedClientName="Acme"
      />
    );
    const select = screen.getByLabelText("Client") as HTMLSelectElement;
    expect(select).toBeDisabled();
    expect(select).toHaveDisplayValue("Acme");
  });

  it("is disabled and displays 'No client' when the locked project has none", () => {
    render(
      <CalendarEventClientField
        value={null}
        onChange={vi.fn()}
        options={OPTIONS}
        locked
        lockedClientName={null}
      />
    );
    const select = screen.getByLabelText("Client") as HTMLSelectElement;
    expect(select).toBeDisabled();
    expect(select).toHaveDisplayValue("No client");
  });
});

describe("CalendarEventClientField — touch target and accessibility", () => {
  it("has at least a 44px touch target", () => {
    render(
      <CalendarEventClientField
        value={null}
        onChange={vi.fn()}
        options={OPTIONS}
        locked={false}
        lockedClientName={null}
      />
    );
    const select = screen.getByLabelText("Client") as HTMLSelectElement;
    expect(select.style.minHeight).toBe("44px");
  });

  it("sets aria-invalid and aria-describedby when invalid", () => {
    render(
      <CalendarEventClientField
        value={null}
        onChange={vi.fn()}
        options={OPTIONS}
        locked={false}
        lockedClientName={null}
        invalid
        aria-describedby="client-error"
      />
    );
    const select = screen.getByLabelText("Client");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAttribute("aria-describedby", "client-error");
  });
});
