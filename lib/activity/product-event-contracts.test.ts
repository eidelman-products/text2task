import { describe, expect, it } from "vitest";
import {
  PRODUCT_ENTITY_TYPES,
  PRODUCT_EVENT_ENTITY_TYPE,
  PRODUCT_EVENT_NAMES,
  validateProductEventInput,
} from "./product-event-contracts";

const VALID_PROJECT_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_CALENDAR_EVENT_UUID = "22222222-2222-4222-8222-222222222222";
const VALID_CALENDAR_DAY = "2027-03-15";

describe("PRODUCT_EVENT_NAMES", () => {
  it("contains exactly the 10 approved events, and never authenticated_app_opened", () => {
    expect(PRODUCT_EVENT_NAMES).toHaveLength(10);
    expect(PRODUCT_EVENT_NAMES).toEqual([
      "dashboard_viewed",
      "extract_viewed",
      "tasks_viewed",
      "calendar_viewed",
      "project_details_expanded",
      "project_resources_viewed",
      "project_history_viewed",
      "client_update_opened",
      "calendar_day_viewed",
      "calendar_event_viewed",
    ]);
    expect(PRODUCT_EVENT_NAMES).not.toContain("authenticated_app_opened");
  });
});

describe("PRODUCT_ENTITY_TYPES", () => {
  it("contains exactly the 3 approved entity types", () => {
    expect(PRODUCT_ENTITY_TYPES).toEqual([
      "project",
      "calendar_event",
      "calendar_day",
    ]);
  });
});

describe("validateProductEventInput - all 10 valid event names, no-entity events", () => {
  const noEntityEvents = PRODUCT_EVENT_NAMES.filter(
    (name) => PRODUCT_EVENT_ENTITY_TYPE[name] === null
  );

  it.each(noEntityEvents)("accepts a bare %s with only a route", (eventName) => {
    const result = validateProductEventInput({
      eventName,
      route: "/dashboard",
    });

    expect(result).toEqual({
      ok: true,
      event: {
        eventName,
        route: "/dashboard",
        entityType: null,
        entityId: null,
      },
    });
  });
});

describe("validateProductEventInput - entity-bearing events accept their correct entity", () => {
  it("accepts project_details_expanded with a valid project UUID", () => {
    const result = validateProductEventInput({
      eventName: "project_details_expanded",
      route: "/dashboard",
      entityType: "project",
      entityId: VALID_PROJECT_UUID,
    });

    expect(result).toEqual({
      ok: true,
      event: {
        eventName: "project_details_expanded",
        route: "/dashboard",
        entityType: "project",
        entityId: VALID_PROJECT_UUID,
      },
    });
  });

  it("accepts project_resources_viewed with a valid project UUID", () => {
    const result = validateProductEventInput({
      eventName: "project_resources_viewed",
      route: "/dashboard",
      entityType: "project",
      entityId: VALID_PROJECT_UUID,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts project_history_viewed with a valid project UUID", () => {
    const result = validateProductEventInput({
      eventName: "project_history_viewed",
      route: "/dashboard",
      entityType: "project",
      entityId: VALID_PROJECT_UUID,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts client_update_opened with a valid project UUID", () => {
    const result = validateProductEventInput({
      eventName: "client_update_opened",
      route: "/dashboard",
      entityType: "project",
      entityId: VALID_PROJECT_UUID,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts calendar_event_viewed with a valid calendar-event UUID", () => {
    const result = validateProductEventInput({
      eventName: "calendar_event_viewed",
      route: "/dashboard/calendar",
      entityType: "calendar_event",
      entityId: VALID_CALENDAR_EVENT_UUID,
    });

    expect(result).toEqual({
      ok: true,
      event: {
        eventName: "calendar_event_viewed",
        route: "/dashboard/calendar",
        entityType: "calendar_event",
        entityId: VALID_CALENDAR_EVENT_UUID,
      },
    });
  });

  it("accepts calendar_day_viewed with a valid DateOnly", () => {
    const result = validateProductEventInput({
      eventName: "calendar_day_viewed",
      route: "/dashboard/calendar",
      entityType: "calendar_day",
      entityId: VALID_CALENDAR_DAY,
    });

    expect(result).toEqual({
      ok: true,
      event: {
        eventName: "calendar_day_viewed",
        route: "/dashboard/calendar",
        entityType: "calendar_day",
        entityId: VALID_CALENDAR_DAY,
      },
    });
  });
});

describe("validateProductEventInput - event name validation", () => {
  it("rejects an unknown event name", () => {
    const result = validateProductEventInput({
      eventName: "totally_made_up_event",
      route: "/dashboard",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_shape" });
  });

  it("rejects a missing event name", () => {
    const result = validateProductEventInput({ route: "/dashboard" });
    expect(result.ok).toBe(false);
  });
});

describe("validateProductEventInput - route validation", () => {
  it("accepts a plain valid internal route", () => {
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route: "/dashboard",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a deeper valid internal route", () => {
    const result = validateProductEventInput({
      eventName: "calendar_viewed",
      route: "/dashboard/calendar",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a full external URL (http)", () => {
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route: "http://evil.example.com/dashboard",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_route" });
  });

  it("rejects a full external URL (https)", () => {
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route: "https://evil.example.com/dashboard",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_route" });
  });

  it("rejects a protocol-relative URL", () => {
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route: "//evil.example.com/dashboard",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_route" });
  });

  it("rejects a route that does not start with a slash", () => {
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route: "dashboard",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_route" });
  });

  it("strips a query string from the stored route", () => {
    const result = validateProductEventInput({
      eventName: "extract_viewed",
      route: "/dashboard?view=extract&foo=bar",
    });
    expect(result).toEqual({
      ok: true,
      event: {
        eventName: "extract_viewed",
        route: "/dashboard",
        entityType: null,
        entityId: null,
      },
    });
  });

  it("strips a hash fragment from the stored route", () => {
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route: "/dashboard#section",
    });
    expect(result).toEqual({
      ok: true,
      event: {
        eventName: "dashboard_viewed",
        route: "/dashboard",
        entityType: null,
        entityId: null,
      },
    });
  });

  it("strips both a query string and a hash fragment together", () => {
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route: "/dashboard?view=extract#section",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.route).toBe("/dashboard");
    }
  });

  it("accepts a route exactly at the 300-character limit", () => {
    const route = "/" + "a".repeat(299);
    expect(route).toHaveLength(300);
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an oversized route (over 300 characters)", () => {
    const route = "/" + "a".repeat(300);
    expect(route.length).toBeGreaterThan(300);
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route,
    });
    expect(result).toEqual({ ok: false, reason: "invalid_route" });
  });

  it("does not reject an oversized route merely because of an incidentally huge query string", () => {
    const route = "/dashboard?" + "x".repeat(5000);
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route,
    });
    expect(result).toEqual({
      ok: true,
      event: {
        eventName: "dashboard_viewed",
        route: "/dashboard",
        entityType: null,
        entityId: null,
      },
    });
  });

  it("rejects an empty route", () => {
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route: "",
    });
    expect(result.ok).toBe(false);
  });
});

describe("validateProductEventInput - project/calendar_event UUID validation", () => {
  it("accepts a valid project UUID", () => {
    const result = validateProductEventInput({
      eventName: "project_details_expanded",
      route: "/dashboard",
      entityType: "project",
      entityId: VALID_PROJECT_UUID,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a malformed project UUID", () => {
    const result = validateProductEventInput({
      eventName: "project_details_expanded",
      route: "/dashboard",
      entityType: "project",
      entityId: "not-a-real-uuid",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_entity_id" });
  });

  it("accepts a valid calendar-event UUID", () => {
    const result = validateProductEventInput({
      eventName: "calendar_event_viewed",
      route: "/dashboard/calendar",
      entityType: "calendar_event",
      entityId: VALID_CALENDAR_EVENT_UUID,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a malformed calendar-event UUID", () => {
    const result = validateProductEventInput({
      eventName: "calendar_event_viewed",
      route: "/dashboard/calendar",
      entityType: "calendar_event",
      entityId: "12345",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_entity_id" });
  });

  it("rejects a UUID with an invalid version nibble", () => {
    const result = validateProductEventInput({
      eventName: "project_details_expanded",
      route: "/dashboard",
      entityType: "project",
      // version nibble "9" is not one of 1-5
      entityId: "11111111-1111-9111-8111-111111111111",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_entity_id" });
  });
});

describe("validateProductEventInput - calendar_day DateOnly validation", () => {
  it("accepts a valid DateOnly", () => {
    const result = validateProductEventInput({
      eventName: "calendar_day_viewed",
      route: "/dashboard/calendar",
      entityType: "calendar_day",
      entityId: VALID_CALENDAR_DAY,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an impossible calendar date (February 30)", () => {
    const result = validateProductEventInput({
      eventName: "calendar_day_viewed",
      route: "/dashboard/calendar",
      entityType: "calendar_day",
      entityId: "2027-02-30",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_entity_id" });
  });

  it("rejects an impossible calendar date (month 13)", () => {
    const result = validateProductEventInput({
      eventName: "calendar_day_viewed",
      route: "/dashboard/calendar",
      entityType: "calendar_day",
      entityId: "2027-13-01",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_entity_id" });
  });

  it("rejects a non-YYYY-MM-DD date shape", () => {
    const result = validateProductEventInput({
      eventName: "calendar_day_viewed",
      route: "/dashboard/calendar",
      entityType: "calendar_day",
      entityId: "03/15/2027",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_entity_id" });
  });

  it("rejects a date with an embedded time component", () => {
    const result = validateProductEventInput({
      eventName: "calendar_day_viewed",
      route: "/dashboard/calendar",
      entityType: "calendar_day",
      entityId: "2027-03-15T00:00:00Z",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_entity_id" });
  });

  it("rejects a UUID supplied where a calendar_day was required", () => {
    const result = validateProductEventInput({
      eventName: "calendar_day_viewed",
      route: "/dashboard/calendar",
      entityType: "calendar_day",
      entityId: VALID_PROJECT_UUID,
    });
    expect(result).toEqual({ ok: false, reason: "invalid_entity_id" });
  });
});

describe("validateProductEventInput - entity/event mismatch rules", () => {
  it("rejects a project entity type supplied for calendar_event_viewed", () => {
    const result = validateProductEventInput({
      eventName: "calendar_event_viewed",
      route: "/dashboard/calendar",
      entityType: "project",
      entityId: VALID_PROJECT_UUID,
    });
    expect(result).toEqual({ ok: false, reason: "entity_type_mismatch" });
  });

  it("rejects a calendar_day entity type supplied for project_details_expanded", () => {
    const result = validateProductEventInput({
      eventName: "project_details_expanded",
      route: "/dashboard",
      entityType: "calendar_day",
      entityId: VALID_CALENDAR_DAY,
    });
    expect(result).toEqual({ ok: false, reason: "entity_type_mismatch" });
  });

  it("rejects any entity supplied for a non-entity event (dashboard_viewed)", () => {
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route: "/dashboard",
      entityType: "project",
      entityId: VALID_PROJECT_UUID,
    });
    expect(result).toEqual({ ok: false, reason: "unexpected_entity" });
  });

  it("rejects an entity id supplied without an entity type for a non-entity event", () => {
    const result = validateProductEventInput({
      eventName: "calendar_viewed",
      route: "/dashboard/calendar",
      entityId: VALID_CALENDAR_EVENT_UUID,
    });
    expect(result).toEqual({ ok: false, reason: "unexpected_entity" });
  });

  it("rejects a missing entity id for an entity-based event", () => {
    const result = validateProductEventInput({
      eventName: "project_details_expanded",
      route: "/dashboard",
      entityType: "project",
    });
    expect(result).toEqual({ ok: false, reason: "missing_entity_id" });
  });

  it("rejects a missing entity type for an entity-based event even if entityId is present", () => {
    const result = validateProductEventInput({
      eventName: "project_details_expanded",
      route: "/dashboard",
      entityId: VALID_PROJECT_UUID,
    });
    expect(result).toEqual({ ok: false, reason: "entity_type_mismatch" });
  });
});

describe("validateProductEventInput - the input contract cannot smuggle trusted-only fields", () => {
  it("rejects a payload containing a client-supplied user_id (strict schema)", () => {
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route: "/dashboard",
      userId: "33333333-3333-4333-8333-333333333333",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_shape" });
  });

  it("rejects a payload containing a client-supplied createdAt", () => {
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route: "/dashboard",
      createdAt: "2020-01-01T00:00:00.000Z",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_shape" });
  });

  it("rejects a payload containing a client-supplied idempotencyKey", () => {
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route: "/dashboard",
      idempotencyKey: "attacker-chosen-key",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_shape" });
  });

  it("rejects a payload containing arbitrary metadata", () => {
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route: "/dashboard",
      metadata: { note: "anything at all" },
    });
    expect(result).toEqual({ ok: false, reason: "invalid_shape" });
  });

  it("rejects a payload containing any other unknown/free-form field", () => {
    const result = validateProductEventInput({
      eventName: "dashboard_viewed",
      route: "/dashboard",
      clientMessage: "sensitive content should never land here",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_shape" });
  });

  it("rejects non-object input entirely", () => {
    expect(validateProductEventInput(null)).toEqual({
      ok: false,
      reason: "invalid_shape",
    });
    expect(validateProductEventInput("dashboard_viewed")).toEqual({
      ok: false,
      reason: "invalid_shape",
    });
    expect(validateProductEventInput(undefined)).toEqual({
      ok: false,
      reason: "invalid_shape",
    });
    expect(validateProductEventInput([])).toEqual({
      ok: false,
      reason: "invalid_shape",
    });
  });
});
