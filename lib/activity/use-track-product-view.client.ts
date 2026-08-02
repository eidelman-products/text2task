"use client";

import { useEffect, useRef } from "react";

import {
  validateProductEventInput,
  type ProductEntityType,
  type ProductEventName,
} from "@/lib/activity/product-event-contracts";

const PRODUCT_VIEW_EVENT_ROUTES = {
  dashboard_viewed: "/dashboard",
  extract_viewed: "/dashboard",
  tasks_viewed: "/dashboard",
  calendar_viewed: "/dashboard/calendar",
  project_details_expanded: "/dashboard",
  project_resources_viewed: "/dashboard",
  project_history_viewed: "/dashboard",
  client_update_opened: "/dashboard",
  calendar_day_viewed: "/dashboard/calendar",
  calendar_event_viewed: "/dashboard/calendar",
} as const satisfies Record<ProductEventName, string>;

type NoEntityProductViewEventName = Extract<
  ProductEventName,
  "dashboard_viewed" | "extract_viewed" | "tasks_viewed" | "calendar_viewed"
>;

type ProductViewEntityTypeByEvent = Readonly<{
  project_details_expanded: "project";
  project_resources_viewed: "project";
  project_history_viewed: "project";
  client_update_opened: "project";
  calendar_day_viewed: "calendar_day";
  calendar_event_viewed: "calendar_event";
}>;

type EntityProductViewEventName = keyof ProductViewEntityTypeByEvent;

type ProductViewTrackingConfig =
  | {
      [EventName in NoEntityProductViewEventName]: Readonly<{
        eventName: EventName;
        route: (typeof PRODUCT_VIEW_EVENT_ROUTES)[EventName];
        entityType?: null;
        entityId?: null;
      }>;
    }[NoEntityProductViewEventName]
  | {
      [EventName in EntityProductViewEventName]: Readonly<{
        eventName: EventName;
        route: (typeof PRODUCT_VIEW_EVENT_ROUTES)[EventName];
        entityType: ProductViewEntityTypeByEvent[EventName];
        entityId: string;
      }>;
    }[EntityProductViewEventName];

type ProductViewIdentity = Readonly<{
  eventName: ProductEventName;
  route: (typeof PRODUCT_VIEW_EVENT_ROUTES)[ProductEventName];
  entityType: ProductEntityType | null;
  entityId: string | null;
}>;

type ProductViewSendInput = (ProductViewTrackingConfig | ProductViewIdentity) &
  Readonly<{
    navigationId: string;
  }>;

type ProductViewHookInput = ProductViewTrackingConfig &
  Readonly<{
    active?: boolean;
  }>;

type LogicalViewState = Readonly<{
  key: string;
  navigationId: string;
  sent: boolean;
}>;

function getLogicalViewKey(input: ProductViewIdentity): string {
  return [
    input.eventName,
    input.route,
    input.entityType ?? "",
    input.entityId ?? "",
  ].join("|");
}

function isExpectedRouteForEvent(input: ProductViewIdentity): boolean {
  return PRODUCT_VIEW_EVENT_ROUTES[input.eventName] === input.route;
}

function buildProductViewRequest(input: ProductViewSendInput) {
  const entityType = input.entityType ?? null;
  const entityId = input.entityId ?? null;
  if (
    !isExpectedRouteForEvent({
      eventName: input.eventName,
      route: input.route,
      entityType,
      entityId,
    })
  ) {
    return null;
  }

  const validation = validateProductEventInput({
    eventName: input.eventName,
    route: input.route,
    entityType,
    entityId,
  });

  if (!validation.ok) {
    return null;
  }

  return {
    event: validation.event,
    navigationId: input.navigationId,
  };
}

export function sendProductViewEvent(input: ProductViewSendInput): void {
  const request = buildProductViewRequest(input);
  if (request === null) {
    return;
  }

  try {
    void Promise.resolve(
      fetch("/api/activity/product-event", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
        credentials: "same-origin",
        keepalive: true,
      })
    ).catch(() => {
      // Best-effort only. Analytics failure must never reach product code.
    });
  } catch {
    // Best-effort only. Analytics failure must never reach product code.
  }
}

export function useTrackProductView(input: ProductViewHookInput): void {
  const active = input.active ?? true;
  const { eventName, route } = input;
  const entityType = input.entityType ?? null;
  const entityId = input.entityId ?? null;
  const stateRef = useRef<LogicalViewState | null>(null);

  useEffect(() => {
    if (!active) {
      stateRef.current = null;
      return;
    }

    const identity = { eventName, route, entityType, entityId };
    const key = getLogicalViewKey(identity);
    const existing = stateRef.current;

    if (existing?.key !== key) {
      stateRef.current = {
        key,
        navigationId: crypto.randomUUID(),
        sent: false,
      };
    }

    const sendCurrentView = () => {
      const current = stateRef.current;
      if (current === null || current.key !== key || current.sent) {
        return;
      }

      stateRef.current = {
        ...current,
        sent: true,
      };

      sendProductViewEvent({
        ...identity,
        navigationId: current.navigationId,
      });
    };

    if (document.visibilityState === "visible") {
      sendCurrentView();
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sendCurrentView();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [active, eventName, route, entityType, entityId]);
}
