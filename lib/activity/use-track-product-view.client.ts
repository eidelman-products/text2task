"use client";

import { useEffect, useRef } from "react";

import {
  validateProductEventInput,
  type ProductEventName,
} from "@/lib/activity/product-event-contracts";

type Phase3ProductViewEventName = Extract<
  ProductEventName,
  "dashboard_viewed" | "extract_viewed" | "tasks_viewed" | "calendar_viewed"
>;

const PHASE3_PRODUCT_VIEW_ROUTES = {
  dashboard_viewed: "/dashboard",
  extract_viewed: "/dashboard",
  tasks_viewed: "/dashboard",
  calendar_viewed: "/dashboard/calendar",
} as const satisfies Record<Phase3ProductViewEventName, string>;

type ProductViewTrackingConfig = {
  [EventName in Phase3ProductViewEventName]: Readonly<{
    eventName: EventName;
    route: (typeof PHASE3_PRODUCT_VIEW_ROUTES)[EventName];
  }>;
}[Phase3ProductViewEventName];

type ProductViewIdentity = Readonly<{
  eventName: Phase3ProductViewEventName;
  route: (typeof PHASE3_PRODUCT_VIEW_ROUTES)[Phase3ProductViewEventName];
}>;

type ProductViewSendInput = ProductViewIdentity &
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
  return `${input.eventName}|${input.route}`;
}

function isExpectedRouteForEvent(input: ProductViewIdentity): boolean {
  return PHASE3_PRODUCT_VIEW_ROUTES[input.eventName] === input.route;
}

function buildProductViewRequest(input: ProductViewSendInput) {
  if (!isExpectedRouteForEvent(input)) {
    return null;
  }

  const validation = validateProductEventInput({
    eventName: input.eventName,
    route: input.route,
    entityType: null,
    entityId: null,
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
  const stateRef = useRef<LogicalViewState | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const key = getLogicalViewKey({ eventName, route });
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
        eventName,
        route,
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
  }, [active, eventName, route]);
}
