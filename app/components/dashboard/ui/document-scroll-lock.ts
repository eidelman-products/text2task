/*
  Shared, reference-counted document scroll lock.

  Both a standalone ResponsiveDialog and a DatePickerPopover nested inside
  one may want to lock body scroll at the same time (e.g. a mobile bottom-
  sheet DatePicker opened from inside a mobile ResponsiveDialog). A naive
  "capture current overflow, then restore it" implementation breaks under
  overlap: whichever lock releases second would restore to the FIRST lock's
  already-locked "hidden" value instead of the true original value, and if
  release order doesn't mirror acquire order (e.g. the outer dialog closes
  first via a programmatic close/unmount, not a user-driven LIFO interaction)
  the restore can fire while the inner lock is still active.

  A module-level reference count fixes both: only the very first acquire
  captures the pre-lock values and applies the lock; only the very last
  release (count reaching zero) restores them. Every acquire/release in
  between is a no-op beyond the counter itself, and `release()` is safe to
  call in any order, any number of times beyond the first (idempotent).
*/

let lockCount = 0;
let originalBodyOverflow = "";
let originalHtmlOverflow = "";

export type DocumentScrollLockHandle = {
  release: () => void;
};

export function acquireDocumentScrollLock(): DocumentScrollLockHandle {
  if (lockCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }
  lockCount += 1;

  let released = false;

  return {
    release() {
      if (released) return;
      released = true;

      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      }
    },
  };
}
