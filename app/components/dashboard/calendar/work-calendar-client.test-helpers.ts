import { expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import {
  formatDateOnlyForA11y,
  localDateToDateOnly,
  todayDateOnly,
  type DateOnly,
} from "@/lib/tasks/date-only";
import type { ManualCalendarEventItem } from "@/lib/calendar/calendar-types";

/*
  Shared fixtures/helpers for the WorkCalendarClient test suite, split out of
  a single ~1500-line work-calendar-client.test.tsx into five smaller,
  concern-scoped files (-loading, -dialog, -options, -reconciliation,
  -races). The split exists purely for test-run isolation/runtime, not
  because these tests were logically entangled -- see this repo's own
  TEXT2TASK_WORK_CALENDAR_UI_REDESIGN_IMPLEMENTATION_REPORT.md for the
  measured root cause (no DOM/listener leak was found; the single file's
  cumulative per-test cost grows within one long-lived Vitest environment,
  which per-file isolation resets). Every fixture/helper here is a verbatim
  extraction, not a rewrite -- no behavior change.

  This file intentionally does NOT end in `.test.ts`/`.test.tsx`, so
  vitest.config.ts's own test-file include glob (any path ending in
  ".test.ts" or ".test.tsx") never treats it as a test file in its own
  right.
*/

export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  } as Response;
}

export function readyBody(items: unknown[] = []) {
  return { success: true, items };
}

/**
 * A fetch mock that actually respects its AbortSignal, mirroring real
 * browser/Node fetch behavior -- unlike a naive mock that resolves/rejects
 * regardless of the signal, this one rejects with a real `DOMException`
 * AbortError the moment the signal aborts, whether it was already aborted
 * at call time or aborts mid-flight. Without this, a test cannot actually
 * exercise (or catch a regression in) the abort-handling code path at all.
 */
export function createAbortAwareFetchMock(
  resolveWith: () => Response = () => jsonResponse(readyBody())
) {
  return vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      const signal = init?.signal;

      if (signal?.aborted) {
        reject(new DOMException("signal is aborted without reason", "AbortError"));
        return;
      }

      signal?.addEventListener("abort", () => {
        reject(new DOMException("signal is aborted without reason", "AbortError"));
      });

      resolve(resolveWith());
    });
  });
}

/**
 * Attaches a real Node-level `unhandledRejection` observer for the duration
 * of one test -- this is what actually proves a promise rejection escaped
 * uncaught (matching what would trigger Next.js's dev overlay), rather than
 * merely inferring safety from the rendered UI never showing an error.
 */
export function captureUnhandledRejections() {
  const rejections: unknown[] = [];
  const handler = (reason: unknown) => rejections.push(reason);
  process.on("unhandledRejection", handler);
  return {
    rejections,
    stop: () => process.off("unhandledRejection", handler),
  };
}

// ---------------------------------------------------------------------
// Phase D fixtures/helpers: a URL-routing fetch mock (range vs. options vs.
// events), Manual Event/options builders, and safe-date helpers matching
// this suite's own established "day 1 or day 2 of the current month, never
// today +/- a fixed offset" convention (avoids month-boundary flakiness).
// ---------------------------------------------------------------------

export const TODAY = todayDateOnly();

export function daysFromToday(offsetDays: number): DateOnly {
  const now = new Date();
  const shifted = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, 12, 0, 0, 0);
  return localDateToDateOnly(shifted);
}

export function anotherDayInCurrentMonth(): DateOnly {
  const now = new Date();
  const targetDay = now.getDate() === 1 ? 2 : 1;
  const target = new Date(now.getFullYear(), now.getMonth(), targetDay, 12, 0, 0, 0);
  return localDateToDateOnly(target);
}

export const FAR_OUTSIDE_RANGE_DATE = daysFromToday(120);

export const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
export const CLIENT_ID = "22222222-2222-4222-8222-222222222222";
export const OTHER_PROJECT_ID = "55555555-5555-4555-8555-555555555555";
export const OTHER_CLIENT_ID = "66666666-6666-4666-8666-666666666666";
export const EVENT_UUID_A = "33333333-3333-4333-8333-333333333333";
export const EVENT_UUID_B = "77777777-7777-4777-8777-777777777777";

export function manualEvent(
  overrides: Partial<ManualCalendarEventItem> & { id: string; date: DateOnly }
): ManualCalendarEventItem {
  return {
    kind: "manual_event",
    time: null,
    title: "Event",
    notes: null,
    projectId: null,
    customProjectName: null,
    projectTitle: null,
    clientId: null,
    customClientName: null,
    clientName: null,
    ...overrides,
  };
}

export function eventItemResponse(item: ManualCalendarEventItem) {
  return jsonResponse({ success: true, item });
}

export function optionsSuccessBody(
  overrides: Partial<{
    projects: unknown[];
    clients: unknown[];
    projectsTruncated: boolean;
    clientsTruncated: boolean;
  }> = {}
) {
  return {
    success: true,
    projects: [],
    clients: [],
    projectsTruncated: false,
    clientsTruncated: false,
    ...overrides,
  };
}

export type RouteHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

/** Routes a single fetch mock by URL prefix -- range GET vs. options GET vs. events POST/PATCH/DELETE. */
export function routedFetchMock(handlers: {
  range?: RouteHandler;
  options?: RouteHandler;
  events?: RouteHandler;
}) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const urlStr = String(url);
    if (urlStr.startsWith("/api/calendar/options")) {
      return handlers.options ? handlers.options(urlStr, init) : jsonResponse(optionsSuccessBody());
    }
    if (urlStr.startsWith("/api/calendar/events")) {
      return handlers.events ? handlers.events(urlStr, init) : jsonResponse({ success: true });
    }
    return handlers.range ? handlers.range(urlStr, init) : jsonResponse(readyBody());
  });
}

/**
 * The redesign's ready-state signal: the month grid (DayPicker's own
 * role="grid" markup) only mounts once `loadState.status === "ready"` --
 * unlike the old design, there is no longer a permanently-visible agenda
 * panel/text to wait on. Mirrors page.test.tsx's own equivalent check.
 */
export async function waitForReady() {
  await waitFor(() => expect(screen.getAllByRole("grid").length).toBeGreaterThan(0));
}

/**
 * Clicks the day cell for `date`, which opens the day-detail popup (the
 * redesign's primary detail surface) showing that day's items. Both the
 * desktop grid and the mobile compact selector share the exact same
 * accessible day label, but only the desktop grid's buttons are
 * `display`-visible at jsdom's default (desktop) viewport, so this
 * `getByRole` (singular) match stays unambiguous -- consistent with every
 * other day-button interaction already in this suite.
 */
export async function openDay(user: ReturnType<typeof userEvent.setup>, date: DateOnly) {
  await user.click(screen.getByRole("button", { name: new RegExp(formatDateOnlyForA11y(date)) }));
}
