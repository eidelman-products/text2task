import { describe, expect, it } from "vitest";
import { parseManualCalendarEventId } from "./parse-manual-calendar-event-id";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("parseManualCalendarEventId", () => {
  it("returns the bare UUID for a valid event:<uuid> id", () => {
    expect(parseManualCalendarEventId(`event:${VALID_UUID}`)).toBe(VALID_UUID);
  });

  it("returns null for a missing prefix", () => {
    expect(parseManualCalendarEventId(VALID_UUID)).toBeNull();
  });

  it("returns null for the project: prefix", () => {
    expect(parseManualCalendarEventId(`project:${VALID_UUID}`)).toBeNull();
  });

  it("returns null for a capitalized Event: prefix (wrong casing)", () => {
    expect(parseManualCalendarEventId(`Event:${VALID_UUID}`)).toBeNull();
  });

  it("returns null for an uppercase-hex UUID (wrong casing)", () => {
    expect(parseManualCalendarEventId(`event:${VALID_UUID.toUpperCase()}`)).toBeNull();
  });

  it("returns null for a leading-whitespace variant", () => {
    expect(parseManualCalendarEventId(` event:${VALID_UUID}`)).toBeNull();
  });

  it("returns null for a trailing-whitespace variant", () => {
    expect(parseManualCalendarEventId(`event:${VALID_UUID} `)).toBeNull();
  });

  it("returns null for whitespace between the prefix and the UUID", () => {
    expect(parseManualCalendarEventId(`event: ${VALID_UUID}`)).toBeNull();
  });

  it("returns null for a truncated UUID", () => {
    expect(parseManualCalendarEventId("event:550e8400-e29b-41d4-a716")).toBeNull();
  });

  it("returns null for a UUID missing a hyphen", () => {
    expect(
      parseManualCalendarEventId("event:550e8400e29b-41d4-a716-446655440000")
    ).toBeNull();
  });

  it("returns null for a malformed (non-hex) UUID segment", () => {
    expect(
      parseManualCalendarEventId("event:zzzzzzzz-e29b-41d4-a716-446655440000")
    ).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseManualCalendarEventId("")).toBeNull();
  });

  it("returns null for extra suffix content", () => {
    expect(parseManualCalendarEventId(`event:${VALID_UUID}-extra`)).toBeNull();
  });

  it("returns null for extra prefix content", () => {
    expect(parseManualCalendarEventId(`xevent:${VALID_UUID}`)).toBeNull();
  });

  it("returns null for a bare 'event:' with nothing after it", () => {
    expect(parseManualCalendarEventId("event:")).toBeNull();
  });

  it("never throws for non-string input at runtime", () => {
    expect(() => parseManualCalendarEventId(null as unknown as string)).not.toThrow();
    expect(parseManualCalendarEventId(null as unknown as string)).toBeNull();
    expect(() => parseManualCalendarEventId(undefined as unknown as string)).not.toThrow();
    expect(parseManualCalendarEventId(undefined as unknown as string)).toBeNull();
    expect(() => parseManualCalendarEventId(42 as unknown as string)).not.toThrow();
    expect(parseManualCalendarEventId(42 as unknown as string)).toBeNull();
    expect(() => parseManualCalendarEventId({} as unknown as string)).not.toThrow();
    expect(parseManualCalendarEventId({} as unknown as string)).toBeNull();
  });
});
