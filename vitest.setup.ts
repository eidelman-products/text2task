// Vitest global setup.
//
// Registers `@testing-library/jest-dom`'s matchers (toBeInTheDocument, etc.)
// on Vitest's `expect`. This only calls `expect.extend(...)` with additional
// matcher functions — it does not touch the DOM at import time, so it is
// inert for the existing `node`-environment `.test.ts` suite (those files
// never invoke DOM-specific matchers) and only becomes meaningful for the
// new `.test.tsx` component tests that run under jsdom.
import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/*
  This repo's vitest.config.ts does not set `test.globals: true` (kept
  scoped/explicit on purpose), so `@testing-library/react`'s automatic
  per-test `afterEach(cleanup)` registration -- which only self-registers
  when it detects a global `afterEach` -- never fires. Without this, each
  `render()` in a `.test.tsx` file would leak its DOM into the next test's
  `document.body`, producing "multiple elements found" failures. `cleanup()`
  only unmounts containers that `@testing-library/react`'s own `render()`
  tracked, so it is a no-op for the existing `.test.ts` suite (which never
  imports `@testing-library/react`).
*/
afterEach(() => {
  cleanup();
});

/*
  jsdom does not implement `window.matchMedia` (confirmed by direct
  inspection: `new JSDOM(...).window.matchMedia` is `undefined`), but
  DatePickerPopover's mobile/desktop presentation switch
  (app/components/dashboard/ui/calendar/date-picker-popover.tsx) calls it
  directly. Without this polyfill every jsdom component test that opens the
  popover would throw "window.matchMedia is not a function". This class
  satisfies the real `MediaQueryList` interface structurally (no `as any`/
  `as unknown as X` cast needed) by extending the platform `EventTarget`,
  which is a global in both jsdom and plain Node, so this file loads safely
  under the `node`-environment suite too (the `typeof window` guard below
  means it's a no-op there regardless).
*/
class MatchMediaStub extends EventTarget implements MediaQueryList {
  matches = false;
  media: string;
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null =
    null;

  constructor(media: string) {
    super();
    this.media = media;
  }

  addListener(
    callback: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null
  ): void {
    void callback;
  }

  removeListener(
    callback: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null
  ): void {
    void callback;
  }
}

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) => new MatchMediaStub(query);
}
