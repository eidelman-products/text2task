import { describe, expect, it } from "vitest";
import {
  CalendarRangeQuerySchema,
  CreateCalendarEventInputSchema,
  UpdateCalendarEventInputSchema,
  CUSTOM_ENTITY_NAME_MAX_LENGTH,
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
  it("accepts a full valid payload with a linked project/client", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      title: "Send first draft",
      eventDate: "2027-01-10",
      eventTime: "14:30",
      notes: "Remember to attach the invoice.",
      projectId: "11111111-1111-4111-8111-111111111111",
      customProjectName: null,
      clientId: "22222222-2222-4222-8222-222222222222",
      customClientName: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        title: "Send first draft",
        eventDate: "2027-01-10",
        eventTime: "14:30",
        notes: "Remember to attach the invoice.",
        projectId: "11111111-1111-4111-8111-111111111111",
        customProjectName: null,
        clientId: "22222222-2222-4222-8222-222222222222",
        customClientName: null,
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
      customProjectName: null,
      clientId: null,
      customClientName: null,
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
      customProjectName: null,
      clientId: null,
      customClientName: null,
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
      customProjectName: null,
      clientId: null,
      customClientName: null,
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
      customProjectName: null,
      clientId: null,
      customClientName: null,
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
      customProjectName: null,
      clientId: null,
      customClientName: null,
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
        customProjectName: null,
        clientId: null,
        customClientName: null,
      }).success
    ).toBe(false);

    expect(
      CreateCalendarEventInputSchema.safeParse({
        title: "Send first draft",
        eventDate: "2027-01-10",
        eventTime: "14:30:00",
        notes: null,
        projectId: null,
        customProjectName: null,
        clientId: null,
        customClientName: null,
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
      customProjectName: null,
      clientId: null,
      customClientName: null,
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
        customProjectName: null,
        clientId: null,
        customClientName: null,
      }).success
    ).toBe(false);

    expect(
      CreateCalendarEventInputSchema.safeParse({
        title: "Send first draft",
        eventDate: "2027-01-10",
        eventTime: null,
        notes: null,
        projectId: null,
        customProjectName: null,
        clientId: "not-a-uuid",
        customClientName: null,
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
      customProjectName: null,
      clientId: null,
      customClientName: null,
      userId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.success).toBe(false);
  });
});

describe("CreateCalendarEventInputSchema — custom Project/Client names", () => {
  const BASE = {
    title: "Send first draft",
    eventDate: "2027-01-10",
    eventTime: null,
    notes: null,
  };

  it("accepts a custom Project name with no linked project", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      ...BASE,
      projectId: null,
      customProjectName: "Not yet in Text2Task",
      clientId: null,
      customClientName: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customProjectName).toBe("Not yet in Text2Task");
    }
  });

  it("accepts a custom Client name with no linked client", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      ...BASE,
      projectId: null,
      customProjectName: null,
      clientId: null,
      customClientName: "Brand new client",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customClientName).toBe("Brand new client");
    }
  });

  it("trims a custom name and normalizes blank/whitespace-only to null", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      ...BASE,
      projectId: null,
      customProjectName: "  Padded Name  ",
      clientId: null,
      customClientName: "   ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customProjectName).toBe("Padded Name");
      expect(result.data.customClientName).toBeNull();
    }
  });

  it("rejects a custom name over the shared max length", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      ...BASE,
      projectId: null,
      customProjectName: "a".repeat(CUSTOM_ENTITY_NAME_MAX_LENGTH + 1),
      clientId: null,
      customClientName: null,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a custom name at exactly the max length", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      ...BASE,
      projectId: null,
      customProjectName: "a".repeat(CUSTOM_ENTITY_NAME_MAX_LENGTH),
      clientId: null,
      customClientName: null,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a projectId AND a customProjectName both non-null on the same request", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      ...BASE,
      projectId: "11111111-1111-4111-8111-111111111111",
      customProjectName: "Conflicting custom name",
      clientId: null,
      customClientName: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a clientId AND a customClientName both non-null on the same request", () => {
    const result = CreateCalendarEventInputSchema.safeParse({
      ...BASE,
      projectId: null,
      customProjectName: null,
      clientId: "22222222-2222-4222-8222-222222222222",
      customClientName: "Conflicting custom client",
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

  it("allows setting/clearing customProjectName and customClientName independently, key omitted when untouched", () => {
    const result = UpdateCalendarEventInputSchema.safeParse({
      customProjectName: "New custom name",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).toEqual(["customProjectName"]);
      expect(result.data.customProjectName).toBe("New custom name");
    }
  });

  it("rejects a PATCH that sends both projectId and customProjectName as non-null", () => {
    const result = UpdateCalendarEventInputSchema.safeParse({
      projectId: "11111111-1111-4111-8111-111111111111",
      customProjectName: "Conflicting",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a PATCH that sends both clientId and customClientName as non-null", () => {
    const result = UpdateCalendarEventInputSchema.safeParse({
      clientId: "22222222-2222-4222-8222-222222222222",
      customClientName: "Conflicting",
    });

    expect(result.success).toBe(false);
  });

  it("does NOT reject a PATCH that only clears one side (projectId: null alone)", () => {
    const result = UpdateCalendarEventInputSchema.safeParse({
      projectId: null,
    });

    expect(result.success).toBe(true);
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
