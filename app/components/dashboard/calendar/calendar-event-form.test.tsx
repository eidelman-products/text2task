// @vitest-environment jsdom
import { useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import { parseTimeOnly } from "@/lib/calendar/time-only";
import type {
  CalendarClientOption,
  CalendarProjectOption,
  ManualCalendarEventItem,
} from "@/lib/calendar/calendar-types";
import {
  CalendarEventForm,
  type CalendarEventFormMode,
  type CalendarEventFormSharedProps,
} from "./calendar-event-form";

function toDateOnly(value: string): DateOnly {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`fixture "${value}" is not a valid DateOnly`);
  return parsed;
}

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const C1 = "33333333-3333-4333-8333-333333333333";
const C2 = "44444444-4444-4444-8444-444444444444";

const PROJECT_OPTIONS: CalendarProjectOption[] = [
  { id: P1, title: "Website redesign", clientId: C1, clientName: "Acme", isArchived: false },
  { id: P2, title: "No-client project", clientId: null, clientName: null, isArchived: false },
];
const CLIENT_OPTIONS: CalendarClientOption[] = [
  { id: C1, name: "Acme" },
  { id: C2, name: "Globex" },
];
const SAMPLE_EVENT: ManualCalendarEventItem = {
  kind: "manual_event",
  id: `event:${VALID_UUID}`,
  date: toDateOnly("2027-01-12"),
  time: parseTimeOnly("14:30"),
  title: "Client call",
  notes: "Some notes",
  projectId: P1,
  projectTitle: "Website redesign",
  clientId: C1,
  clientName: "Acme",
};

function jsonResponse(body: unknown, init?: { status?: number; ok?: boolean }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  } as Response;
}

function itemResponse(overrides: Partial<ManualCalendarEventItem> = {}) {
  return jsonResponse({ success: true, item: { ...SAMPLE_EVENT, ...overrides } });
}

type HarnessOverrides = Partial<CalendarEventFormSharedProps>;

function FormHarness(props: CalendarEventFormMode & HarnessOverrides) {
  const [busy, setBusy] = useState(false);
  const [deleteConfirmPending, setDeleteConfirmPending] = useState(false);

  const { mode, ...rest } = props;
  const modeProps =
    mode === "create" ? { mode: "create" as const, defaultDate: (props as { defaultDate: DateOnly }).defaultDate } : { mode: "edit" as const, event: (props as { event: ManualCalendarEventItem }).event };

  return (
    <CalendarEventForm
      {...modeProps}
      headingId="test-heading"
      onSaved={vi.fn()}
      onDeleted={vi.fn()}
      onClose={vi.fn()}
      projectOptions={PROJECT_OPTIONS}
      clientOptions={CLIENT_OPTIONS}
      projectsTruncated={false}
      clientsTruncated={false}
      optionsLoading={false}
      optionsError={null}
      onRetryOptions={vi.fn()}
      busy={busy}
      onBusyChange={setBusy}
      deleteConfirmPending={deleteConfirmPending}
      onDeleteConfirmPendingChange={setDeleteConfirmPending}
      {...rest}
    />
  );
}

function lastFetchBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return JSON.parse(call[1].body);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CalendarEventForm — create defaults", () => {
  it("starts with empty title, the given default date, no time/notes, and no project/client", () => {
    render(<FormHarness mode="create" defaultDate={toDateOnly("2027-02-01")} />);

    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByLabelText("Date")).toHaveTextContent("Feb 1, 2027");
    expect(screen.getByLabelText("Time")).toHaveValue("");
    expect(screen.getByLabelText("Notes")).toHaveValue("");
    expect(screen.getByLabelText("Project")).toHaveValue("");
    expect(screen.getByLabelText("Client")).toHaveValue("");
    expect(screen.getByLabelText("Client")).not.toBeDisabled();
  });

  it("renders no Delete control in create mode", () => {
    render(<FormHarness mode="create" defaultDate={toDateOnly("2027-02-01")} />);
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });
});

describe("CalendarEventForm — validation", () => {
  it("shows a required-title error and does not submit when Title is blank", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<FormHarness mode="create" defaultDate={toDateOnly("2027-02-01")} />);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Title is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("CalendarEventForm — create request body", () => {
  it("uses exactly {title, eventDate, eventTime, notes, projectId, clientId}, never date/time", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(itemResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<FormHarness mode="create" defaultDate={toDateOnly("2027-02-01")} />);
    await user.type(screen.getByLabelText("Title"), "Team sync");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastFetchBody(fetchMock);
    expect(Object.keys(body).sort()).toEqual(
      ["clientId", "eventDate", "eventTime", "notes", "projectId", "title"].sort()
    );
    expect(body.date).toBeUndefined();
    expect(body.time).toBeUndefined();
  });

  it("sends explicit null for empty time and empty notes", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(itemResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<FormHarness mode="create" defaultDate={toDateOnly("2027-02-01")} />);
    await user.type(screen.getByLabelText("Title"), "Team sync");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastFetchBody(fetchMock);
    expect(body.eventTime).toBeNull();
    expect(body.notes).toBeNull();
  });

  it("calls onSaved and onClose on success", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(itemResponse({ title: "Team sync" })));
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <FormHarness
        mode="create"
        defaultDate={toDateOnly("2027-02-01")}
        onSaved={onSaved}
        onClose={onClose}
      />
    );
    await user.type(screen.getByLabelText("Title"), "Team sync");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the dialog open, preserves values, and shows an inline error on save failure", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "Linked project not found." }, { ok: false, status: 404 }))
    );
    const onClose = vi.fn();

    render(<FormHarness mode="create" defaultDate={toDateOnly("2027-02-01")} onClose={onClose} />);
    await user.type(screen.getByLabelText("Title"), "Team sync");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Linked project not found.")).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Title")).toHaveValue("Team sync");
  });
});

describe("CalendarEventForm — options loading/error/truncation", () => {
  it("shows an inline error with Retry when options fail, without blocking Title/Date/Time/Notes", async () => {
    const user = userEvent.setup();
    const onRetryOptions = vi.fn();

    render(
      <FormHarness
        mode="create"
        defaultDate={toDateOnly("2027-02-01")}
        optionsError="Could not load options."
        onRetryOptions={onRetryOptions}
      />
    );

    expect(screen.getByText("Could not load options.")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).not.toBeDisabled();
    expect(screen.getByLabelText("Project")).toBeDisabled();
    expect(screen.getByLabelText("Client")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetryOptions).toHaveBeenCalledTimes(1);
  });

  it("renders a truncation note for projects and clients, linked via aria-describedby", () => {
    render(
      <FormHarness
        mode="create"
        defaultDate={toDateOnly("2027-02-01")}
        projectsTruncated
        clientsTruncated
      />
    );

    const projectNote = screen.getByText("Showing the first 200 projects.");
    const clientNote = screen.getByText("Showing the first 200 clients.");
    expect(screen.getByLabelText("Project")).toHaveAttribute("aria-describedby", projectNote.id);
    expect(screen.getByLabelText("Client")).toHaveAttribute("aria-describedby", clientNote.id);
  });
});

describe("CalendarEventForm — busy / no double submit", () => {
  it("disables Save and does not send a second request while a save is in flight", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<FormHarness mode="create" defaultDate={toDateOnly("2027-02-01")} />);
    await user.type(screen.getByLabelText("Title"), "Team sync");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(itemResponse());
    });
  });
});

describe("CalendarEventForm — Project/Client relationship rules", () => {
  it("1. create: selecting a project auto-populates and locks Client", async () => {
    const user = userEvent.setup();
    render(<FormHarness mode="create" defaultDate={toDateOnly("2027-02-01")} />);

    await user.selectOptions(screen.getByLabelText("Project"), P1);

    const client = screen.getByLabelText("Client") as HTMLSelectElement;
    expect(client).toBeDisabled();
    expect(client).toHaveDisplayValue("Acme");
  });

  it("2. create: clearing project unlocks Client and retains its value", async () => {
    const user = userEvent.setup();
    render(<FormHarness mode="create" defaultDate={toDateOnly("2027-02-01")} />);

    await user.selectOptions(screen.getByLabelText("Project"), P1);
    await user.selectOptions(screen.getByLabelText("Project"), "");

    const client = screen.getByLabelText("Client") as HTMLSelectElement;
    expect(client).not.toBeDisabled();
    expect(client).toHaveDisplayValue("Acme");
  });

  it("3. edit: untouched relationship omits both projectId and clientId", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(itemResponse());
    vi.stubGlobal("fetch", fetchMock);

    // An empty PATCH (nothing changed anywhere) is never sent at all (its
    // own dedicated test below), so an unrelated field (Notes) is also
    // touched here to force a real request the relationship-omission claim
    // can actually be inspected against.
    render(<FormHarness mode="edit" event={SAMPLE_EVENT} />);
    await user.type(screen.getByLabelText("Notes"), " updated");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastFetchBody(fetchMock);
    expect(body).not.toHaveProperty("projectId");
    expect(body).not.toHaveProperty("clientId");
    expect(body.notes).toBe("Some notes updated");
  });

  it("4. edit: a genuinely different project sends projectId only", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(itemResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} />);
    await user.selectOptions(screen.getByLabelText("Project"), P2);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastFetchBody(fetchMock);
    expect(body.projectId).toBe(P2);
    expect(body).not.toHaveProperty("clientId");
  });

  it("5. edit: reselecting the already-selected project is a no-op (both keys omitted)", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(itemResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} />);
    await user.selectOptions(screen.getByLabelText("Project"), P1);
    await user.type(screen.getByLabelText("Notes"), " updated");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastFetchBody(fetchMock);
    expect(body).not.toHaveProperty("projectId");
    expect(body).not.toHaveProperty("clientId");
  });

  it("6. edit: clear then reselect the original project omits both keys", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(itemResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} />);
    await user.selectOptions(screen.getByLabelText("Project"), "");
    await user.selectOptions(screen.getByLabelText("Project"), P1);
    await user.type(screen.getByLabelText("Notes"), " updated");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastFetchBody(fetchMock);
    expect(body).not.toHaveProperty("projectId");
    expect(body).not.toHaveProperty("clientId");
  });

  it("7. edit: clear project, leave Client untouched -> projectId: null only", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(itemResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} />);
    await user.selectOptions(screen.getByLabelText("Project"), "");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastFetchBody(fetchMock);
    expect(body).toEqual(expect.objectContaining({ projectId: null }));
    expect(body).not.toHaveProperty("clientId");
  });

  it("8. edit: clear project, then change Client -> both keys included", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(itemResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} />);
    await user.selectOptions(screen.getByLabelText("Project"), "");
    await user.selectOptions(screen.getByLabelText("Client"), C2);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastFetchBody(fetchMock);
    expect(body.projectId).toBeNull();
    expect(body.clientId).toBe(C2);
  });

  it("9. edit: clear project, change Client, then select a different project -> projectId only", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(itemResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} />);
    await user.selectOptions(screen.getByLabelText("Project"), "");
    await user.selectOptions(screen.getByLabelText("Client"), C2);
    await user.selectOptions(screen.getByLabelText("Project"), P2);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastFetchBody(fetchMock);
    expect(body.projectId).toBe(P2);
    expect(body).not.toHaveProperty("clientId");
  });
});

describe("CalendarEventForm — edit dirty-body assembly", () => {
  it("omits an unchanged field", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(itemResponse());
    vi.stubGlobal("fetch", fetchMock);

    // Touch only Notes; Title/Date/Time must each be independently omitted
    // from the PATCH since none of them actually changed.
    render(<FormHarness mode="edit" event={SAMPLE_EVENT} />);
    await user.type(screen.getByLabelText("Notes"), " updated");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastFetchBody(fetchMock);
    expect(body).not.toHaveProperty("title");
    expect(body).not.toHaveProperty("eventDate");
    expect(body).not.toHaveProperty("eventTime");
    expect(body.notes).toBe("Some notes updated");
  });

  it("sends null for a cleared time", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(itemResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} />);
    await user.clear(screen.getByLabelText("Time"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastFetchBody(fetchMock).eventTime).toBeNull();
  });

  it("sends null for cleared notes", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(itemResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} />);
    await user.clear(screen.getByLabelText("Notes"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastFetchBody(fetchMock).notes).toBeNull();
  });

  it("uses eventDate (not date) for a changed date", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(itemResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} />);
    await user.click(screen.getByLabelText("Date"));
    const targetCell = document.querySelector('[data-day="2027-01-01"] button, [data-day="2027-01-20"] button');
    if (targetCell) await user.click(targetCell as HTMLElement);

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastFetchBody(fetchMock);
    expect(body).toHaveProperty("eventDate");
    expect(body).not.toHaveProperty("date");
  });

  it("uses title (not a renamed key) for a changed title", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(itemResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} />);
    const titleInput = screen.getByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Renamed call");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastFetchBody(fetchMock).title).toBe("Renamed call");
  });

  it("closes without sending a request when nothing actually changed", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const onClose = vi.fn();

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("CalendarEventForm — delete flow", () => {
  it("is present only in edit mode", () => {
    render(<FormHarness mode="edit" event={SAMPLE_EVENT} />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("first click only enters confirmation -- no request sent", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("Delete this event?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel delete" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancel confirmation sends no request and keeps the dialog open", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const onClose = vi.fn();

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel delete" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText("Delete this event?")).toBeNull();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("confirm success with alreadyDeleted: false calls onDeleted and onClose", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true, alreadyDeleted: false }))
    );
    const onDeleted = vi.fn();
    const onClose = vi.fn();

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} onDeleted={onDeleted} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(SAMPLE_EVENT.id));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("confirm success with alreadyDeleted: true is equally treated as success", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true, alreadyDeleted: true }))
    );
    const onDeleted = vi.fn();
    const onClose = vi.fn();

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} onDeleted={onDeleted} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(SAMPLE_EVENT.id));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("failure preserves the dialog/form and shows an inline delete error", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "Could not delete." }, { ok: false, status: 500 }))
    );
    const onClose = vi.fn();

    render(<FormHarness mode="edit" event={SAMPLE_EVENT} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() =>
      expect(screen.getByText("Something went wrong while saving. Please try again.")).toBeInTheDocument()
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm delete" })).toBeInTheDocument();
  });
});
