// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { acquireDocumentScrollLock } from "./document-scroll-lock";

afterEach(() => {
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
});

describe("acquireDocumentScrollLock", () => {
  it("locks body and html overflow on first acquire", () => {
    const handle = acquireDocumentScrollLock();

    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");

    handle.release();
  });

  it("restores the original overflow values on release", () => {
    document.body.style.overflow = "auto";
    document.documentElement.style.overflow = "scroll";

    const handle = acquireDocumentScrollLock();
    handle.release();

    expect(document.body.style.overflow).toBe("auto");
    expect(document.documentElement.style.overflow).toBe("scroll");
  });

  it("keeps the lock applied while a second overlapping acquire is still held", () => {
    const outer = acquireDocumentScrollLock();
    const inner = acquireDocumentScrollLock();

    outer.release();

    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");

    inner.release();

    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("restores original values only once the last overlapping lock releases, regardless of release order", () => {
    document.body.style.overflow = "auto";

    const first = acquireDocumentScrollLock();
    const second = acquireDocumentScrollLock();

    // Release in the SAME order as acquisition (not LIFO) -- simulates the
    // outer dialog closing/unmounting before the nested overlay does.
    first.release();
    expect(document.body.style.overflow).toBe("hidden");

    second.release();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("is idempotent -- calling release() more than once has no further effect", () => {
    document.body.style.overflow = "auto";

    const handle = acquireDocumentScrollLock();
    handle.release();
    handle.release();
    handle.release();

    expect(document.body.style.overflow).toBe("auto");
  });

  it("supports three overlapping locks releasing in an arbitrary order", () => {
    document.body.style.overflow = "visible";

    const a = acquireDocumentScrollLock();
    const b = acquireDocumentScrollLock();
    const c = acquireDocumentScrollLock();

    b.release();
    expect(document.body.style.overflow).toBe("hidden");

    a.release();
    expect(document.body.style.overflow).toBe("hidden");

    c.release();
    expect(document.body.style.overflow).toBe("visible");
  });
});
