import { describe, expect, it } from "vitest";

import { normalizeEmbeddedRelation } from "./joined-row";

describe("normalizeEmbeddedRelation", () => {
  it("unwraps a single-element array to the one row (many-to-one cardinality inference)", () => {
    const row = { id: "client-1", name: "Acme" };

    expect(normalizeEmbeddedRelation([row])).toBe(row);
  });

  it("returns the first element when the array has more than one row", () => {
    const first = { id: "client-1" };
    const second = { id: "client-2" };

    expect(normalizeEmbeddedRelation([first, second])).toBe(first);
  });

  it("returns null for an empty array (query matched zero related rows)", () => {
    expect(normalizeEmbeddedRelation([])).toBeNull();
  });

  it("returns the row directly when Supabase reports a single object instead of an array", () => {
    const row = { id: "client-1", name: "Acme" };

    expect(normalizeEmbeddedRelation(row)).toBe(row);
  });

  it("returns null for a null value", () => {
    expect(normalizeEmbeddedRelation(null)).toBeNull();
  });

  it("returns null for an undefined value", () => {
    expect(normalizeEmbeddedRelation(undefined)).toBeNull();
  });
});
