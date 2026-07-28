import { describe, expect, it } from "vitest";
import {
  CalendarRangeQuerySchema,
  CreateCalendarEventInputSchema,
  UpdateCalendarEventInputSchema,
} from "./calendar-schemas";

describe("CalendarRangeQuerySchema", () => {
  it("accepts a valid start/end range", () => {
    const result = CalendarRangeQuerySchema.safeParse({
      start: "2027-01-01",
      end: "2027-01-31",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.start).toBe("2027-01-01");
      expect(result.data.end).toBe("2027-01-31");
    }
  });

  it("accepts a single-day range (start === end)", () => {
    const result = CalendarRangeQuerySchema.safeParse({
      start: "2027-01-01",
      end: "2027-01-01",
    });

    expect(result.success).toBe(true);
  });

  it("rejects end before start", () => {
    const result = CalendarRangeQuerySchema.safeParse({
      start: "2027-02-01",
      end: "2027-01-01",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid date shape", () => {
    expect(
      CalendarRangeQuerySchema.safeParse({ start: "2027-1-1", end: "2027-01-31" })
        .success
    ).toBe(false);
    expect(
      CalendarRangeQuerySchema.safeParse({ start: "2027-01-01", end: "not-a-date" })
        .success
    ).toBe(false);
  });

  it("rejects unknown extra keys", () => {
    const result = CalendarRangeQuerySchema.safeParse({
      start: "2027-01-01",
      end: "2027-01-31",
      extra: "nope",
    });

    expect(result.success).toBe(false);
  });
});

describe("CreateCalendarEventInputSchema", () => {
  it("accepts a full valid payload", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      title: "Send first draft",
      eventDate: "2027-01-10",
      eventTime: "14:30",
      notes: "Remember to attach the invoice.",
      projectId: "11111111-1111-4111-8111-111111111111",
      clientId: "22222222-2222-4222-8222-222222222222",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        title: "Send first draft",
        eventDate: "2027-01-10",
        eventTime: "14:30",
        notes: "Remember to attach the invoice.",
        projectId: "11111111-1111-4111-8111-111111111111",
        clientId: "22222222-2222-4222-8222-222222222222",
      });
    }
  });

  it("accepts the minimal valid payload (all optional fields null)", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      title: "Team check-in",
      eventDate: "2027-01-10",
      eventTime: null,
      notes: null,
      projectId: null,
      clientId: null,
    });

    expect(result.success).toBe(true);
  });

  it("trims the title and normalizes a blank/whitespace-only notes string to null", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      title: "  Send first draft  ",
      eventDate: "2027-01-10",
      eventTime: null,
      notes: "   ",
      projectId: null,
      clientId: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Send first draft");
      expect(result.data.notes).toBeNull();
    }
  });

  it("rejects a blank title", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      title: "   ",
      eventDate: "2027-01-10",
      eventTime: null,
      notes: null,
      projectId: null,
      clientId: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a title over 240 characters", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      title: "a".repeat(241),
      eventDate: "2027-01-10",
      eventTime: null,
      notes: null,
      projectId: null,
      clientId: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid eventDate", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      title: "Send first draft",
      eventDate: "not-a-date",
      eventTime: null,
      notes: null,
      projectId: null,
      clientId: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid eventTime, including a value with seconds", () => {
    expect(
      CreateCalendarEventInputSchema.safeParse({
        title: "Send first draft",
        eventDate: "2027-01-10",
        eventTime: "2:30 PM",
        notes: null,
        projectId: null,
        clientId: null,
      }).success
    ).toBe(false);

    expect(
      CreateCalendarEventInputSchema.safeParse({
        title: "Send first draft",
        eventDate: "2027-01-10",
        eventTime: "14:30:00",
        notes: null,
        projectId: null,
        clientId: null,
      }).success
    ).toBe(false);
  });

  it("rejects notes over 5000 characters", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      title: "Send first draft",
      eventDate: "2027-01-10",
      eventTime: null,
      notes: "a".repeat(5001),
      projectId: null,
      clientId: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID projectId/clientId", () => {
    expect(
      CreateCalendarEventInputSchema.safeParse({
        title: "Send first draft",
        eventDate: "2027-01-10",
        eventTime: null,
        notes: null,
        projectId: "not-a-uuid",
        clientId: null,
      }).success
    ).toBe(false);

    expect(
      CreateCalendarEventInputSchema.safeParse({
        title: "Send first draft",
        eventDate: "2027-01-10",
        eventTime: null,
        notes: null,
        projectId: null,
        clientId: "not-a-uuid",
      }).success
    ).toBe(false);
  });

  it("rejects an unknown extra field (never accepts user_id from the client)", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      title: "Send first draft",
      eventDate: "2027-01-10",
      eventTime: null,
      notes: null,
      projectId: null,
      clientId: null,
      userId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.success).toBe(false);
  });
});

describe("UpdateCalendarEventInputSchema", () => {
  it("rejects an empty object (at least one field required)", () => {
    expect(UpdateCalendarEventInputSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a single-field partial update", () => {
    const result = UpdateCalendarEventInputSchema.safeParse({
      title: "Updated title",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).toEqual(["title"]);
    }
  });

  it("distinguishes an omitted field from an explicitly-cleared one", () => {
    const clearTime = UpdateCalendarEventInputSchema.safeParse({
      eventTime: null,
    });

    expect(clearTime.success).toBe(true);
    if (clearTime.success) {
      expect("eventTime" in clearTime.data).toBe(true);
      expect(clearTime.data.eventTime).toBeNull();
      expect("notes" in clearTime.data).toBe(false);
      expect("title" in clearTime.data).toBe(false);
    }
  });

  it("allows clearing notes, projectId, and clientId independently via explicit null", () => {
    const result = UpdateCalendarEventInputSchema.safeParse({
      notes: null,
      projectId: null,
      clientId: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        notes: null,
        projectId: null,
        clientId: null,
      });
    }
  });

  it("rejects an unknown extra field", () => {
    const result = UpdateCalendarEventInputSchema.safeParse({
      title: "Updated title",
      userId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.success).toBe(false);
  });

  it("still validates field-level rules on a partial update (invalid eventDate rejected)", () => {
    const result = UpdateCalendarEventInputSchema.safeParse({
      eventDate: "not-a-date",
    });

    expect(result.success).toBe(false);
  });
});
