import { describe, expect, it } from "vitest";

import { getVisibleSelectedTaskIds } from "./use-task-selection";

describe("getVisibleSelectedTaskIds", () => {
  it("keeps a selected id that is still visible", () => {
    expect(getVisibleSelectedTaskIds([1, 2, 3], [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("drops a selected id that has scrolled out of the visible set (filtering/search/pagination)", () => {
    expect(getVisibleSelectedTaskIds([1, 2, 3], [1, 3])).toEqual([1, 3]);
  });

  it("returns an empty selection when nothing selected remains visible", () => {
    expect(getVisibleSelectedTaskIds([4, 5], [1, 2, 3])).toEqual([]);
  });

  it("returns an empty selection when nothing is selected", () => {
    expect(getVisibleSelectedTaskIds([], [1, 2, 3])).toEqual([]);
  });

  it("returns an empty selection when nothing is visible", () => {
    expect(getVisibleSelectedTaskIds([1, 2, 3], [])).toEqual([]);
  });

  it("preserves the raw selection's order (not the visible set's order)", () => {
    expect(getVisibleSelectedTaskIds([3, 1, 2], [1, 2, 3])).toEqual([3, 1, 2]);
  });

  it("is a pure function: repeated calls with the same inputs produce equal, independent results", () => {
    const raw = [1, 2, 3];
    const visible = [2, 3, 4];

    const first = getVisibleSelectedTaskIds(raw, visible);
    const second = getVisibleSelectedTaskIds(raw, visible);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    // Inputs must never be mutated by the derivation.
    expect(raw).toEqual([1, 2, 3]);
    expect(visible).toEqual([2, 3, 4]);
  });
});
