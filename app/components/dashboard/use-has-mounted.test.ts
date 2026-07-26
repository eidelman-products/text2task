import { describe, expect, it } from "vitest";

import {
  getMountedClientSnapshot,
  getMountedServerSnapshot,
  subscribeToNothing,
} from "./use-has-mounted";

describe("useHasMounted snapshot contract", () => {
  it("reports false for the server snapshot (must match what SSR renders)", () => {
    expect(getMountedServerSnapshot()).toBe(false);
  });

  it("reports true for the client snapshot (only read once running in the browser)", () => {
    expect(getMountedClientSnapshot()).toBe(true);
  });

  it("server and client snapshots are never equal, so the value always changes after hydration", () => {
    expect(getMountedServerSnapshot()).not.toBe(getMountedClientSnapshot());
  });

  it("snapshot functions are deterministic across repeated calls (required by useSyncExternalStore)", () => {
    expect(getMountedServerSnapshot()).toBe(getMountedServerSnapshot());
    expect(getMountedClientSnapshot()).toBe(getMountedClientSnapshot());
  });

  it("subscribe returns a valid, safely-callable unsubscribe function", () => {
    // subscribeToNothing is passed to useSyncExternalStore as the
    // subscribe callback; since the snapshot never changes after mount, it
    // never needs to invoke the onStoreChange callback it's given.
    const unsubscribe = subscribeToNothing();

    expect(typeof unsubscribe).toBe("function");
    expect(() => unsubscribe()).not.toThrow();
  });
});
