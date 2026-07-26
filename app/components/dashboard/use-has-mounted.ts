"use client";

import { useSyncExternalStore } from "react";

/*
  SSR-safe "has this client-rendered yet" check, used to defer portal
  rendering (createPortal targets document.body, which does not exist
  during the server render) until after hydration.

  This is implemented with useSyncExternalStore rather than the classic
  useState(false) + useEffect(() => setState(true), []) pattern: that
  pattern sets state from inside an effect purely to react to the
  server/client environment boundary, which is not a case of synchronizing
  with props, state, or a subscribable external system, and forces an extra
  commit after every mount. useSyncExternalStore is the hook React provides
  specifically for reading a value that lives outside React's own state
  (here: "is this JS running with a live DOM") and is designed to report a
  distinct, safe server snapshot during SSR/hydration without requiring an
  effect-driven state update. The store never actually changes after
  mount, so subscribe is a no-op.
*/
export function subscribeToNothing() {
  return () => {};
}

export function getMountedClientSnapshot() {
  return true;
}

export function getMountedServerSnapshot() {
  return false;
}

export function useHasMounted() {
  return useSyncExternalStore(
    subscribeToNothing,
    getMountedClientSnapshot,
    getMountedServerSnapshot
  );
}
