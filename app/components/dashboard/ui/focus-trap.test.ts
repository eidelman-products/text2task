// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  FOCUSABLE_SELECTOR,
  getFocusableElements,
  matchesFocusableSelector,
} from "./focus-trap";

function buildContainer(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

describe("getFocusableElements", () => {
  it("includes every supported focusable element type, in DOM order", () => {
    const container = buildContainer(`
      <a href="/x">link</a>
      <button>button</button>
      <input />
      <select><option>a</option></select>
      <textarea></textarea>
      <div tabindex="0">tabbable div</div>
    `);

    const focusable = getFocusableElements(container);

    expect(focusable.map((el) => el.tagName)).toEqual([
      "A",
      "BUTTON",
      "INPUT",
      "SELECT",
      "TEXTAREA",
      "DIV",
    ]);
  });

  it("excludes disabled native controls", () => {
    const container = buildContainer(`
      <button disabled>disabled button</button>
      <input disabled />
      <button>enabled button</button>
    `);

    const focusable = getFocusableElements(container);

    expect(focusable).toHaveLength(1);
    expect(focusable[0].textContent).toBe("enabled button");
  });

  it("excludes an anchor with no href", () => {
    const container = buildContainer(`<a>not a real link</a>`);

    expect(getFocusableElements(container)).toHaveLength(0);
  });

  it("excludes tabindex=-1 elements", () => {
    const container = buildContainer(`
      <div tabindex="-1">not focusable</div>
      <div tabindex="0">focusable</div>
    `);

    const focusable = getFocusableElements(container);

    expect(focusable).toHaveLength(1);
    expect(focusable[0].getAttribute("tabindex")).toBe("0");
  });

  it("returns an empty array for a container with no focusable descendants", () => {
    const container = buildContainer(`<p>plain text</p>`);

    expect(getFocusableElements(container)).toEqual([]);
  });
});

describe("matchesFocusableSelector", () => {
  it("returns true for an enabled button", () => {
    const container = buildContainer(`<button>ok</button>`);
    expect(matchesFocusableSelector(container.querySelector("button")!)).toBe(true);
  });

  it("returns false for a plain div with no tabindex", () => {
    const container = buildContainer(`<div>plain</div>`);
    expect(matchesFocusableSelector(container.querySelector("div")!)).toBe(false);
  });

  it("returns false for tabindex=-1", () => {
    const container = buildContainer(`<div tabindex="-1">not focusable</div>`);
    expect(matchesFocusableSelector(container.querySelector("div")!)).toBe(false);
  });

  it("returns false for a disabled button", () => {
    const container = buildContainer(`<button disabled>no</button>`);
    expect(matchesFocusableSelector(container.querySelector("button")!)).toBe(false);
  });

  it("is exactly consistent with FOCUSABLE_SELECTOR (no drift between the two)", () => {
    const container = buildContainer(`
      <a href="/x">link</a>
      <div tabindex="0">tabbable</div>
      <div>plain</div>
    `);
    const viaQuery = getFocusableElements(container);
    const viaMatches = Array.from(container.children).filter((el) =>
      matchesFocusableSelector(el as HTMLElement)
    );

    expect(viaMatches).toEqual(viaQuery);
    expect(FOCUSABLE_SELECTOR).toContain("[tabindex]:not([tabindex=\"-1\"])");
  });
});
