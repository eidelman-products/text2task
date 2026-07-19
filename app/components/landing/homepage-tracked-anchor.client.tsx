"use client";

import type { ReactNode } from "react";
import { trackHomepageProPlanClick } from "@/lib/analytics/events";

export type HomepageAnchorTrackingEvent = "homepage_pro_plan_click";

// Serializable event-name -> tracker lookup, kept inside this Client
// Component module so Server Component callers only ever pass a plain
// string prop, never a function reference, across the boundary.
const TRACKERS: Readonly<Record<HomepageAnchorTrackingEvent, () => void>> = {
  homepage_pro_plan_click: trackHomepageProPlanClick,
};

export type HomepageTrackedAnchorProps = Readonly<{
  href: string;
  className?: string;
  children: ReactNode;
  trackingEvent: HomepageAnchorTrackingEvent;
}>;

/**
 * Plain <a> tag with a tracking-only click handler. Used for the Pro
 * pricing CTA, which must remain a native anchor (not next/link) so it
 * keeps performing a full navigation to the billing route exactly as
 * before — this component changes nothing about that navigation.
 */
export default function HomepageTrackedAnchor({
  href,
  className,
  children,
  trackingEvent,
}: HomepageTrackedAnchorProps) {
  return (
    <a href={href} className={className} onClick={() => TRACKERS[trackingEvent]()}>
      {children}
    </a>
  );
}
