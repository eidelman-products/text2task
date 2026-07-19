"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import {
  trackFinalCreateWorkspaceClick,
  trackFinalLiveDemoClick,
  trackHeroCreateWorkspaceClick,
  trackHeroLiveDemoClick,
  trackHomepageFreePlanClick,
} from "@/lib/analytics/events";

const LIVE_DEMO_TARGET_ID = "homepage-live-demo";
const LIVE_DEMO_INPUT_SELECTOR = "[data-homepage-live-demo-input]";
const PRECISE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export type HomepageCtaTrackingEvent =
  | "hero_live_demo_click"
  | "hero_create_workspace_click"
  | "homepage_free_plan_click"
  | "final_live_demo_click"
  | "final_create_workspace_click";

// Serializable event-name -> tracker lookup. This map (and the analytics
// functions it calls) lives entirely inside this Client Component module,
// so Server Component callers only ever pass a plain string prop, never a
// function reference, across the server/client boundary.
const TRACKERS: Readonly<Record<HomepageCtaTrackingEvent, () => void>> = {
  hero_live_demo_click: trackHeroLiveDemoClick,
  hero_create_workspace_click: trackHeroCreateWorkspaceClick,
  homepage_free_plan_click: trackHomepageFreePlanClick,
  final_live_demo_click: trackFinalLiveDemoClick,
  final_create_workspace_click: trackFinalCreateWorkspaceClick,
};

export type HomepageCtaLinkProps = Readonly<{
  href: string;
  className?: string;
  children: ReactNode;
  trackingEvent?: HomepageCtaTrackingEvent;
  prefetch?: boolean;
  scrollToLiveDemo?: boolean;
}>;

/**
 * Thin client wrapper around next/link used only for homepage conversion
 * CTAs. Adds optional analytics tracking and, for the live-demo CTAs, a
 * smooth scroll to the existing live-demo section with a reduced-motion
 * fallback. Never touches the live-demo component itself.
 */
export default function HomepageCtaLink({
  href,
  className,
  children,
  trackingEvent,
  prefetch,
  scrollToLiveDemo = false,
}: HomepageCtaLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (trackingEvent) {
      TRACKERS[trackingEvent]();
    }

    if (!scrollToLiveDemo || typeof window === "undefined") {
      return;
    }

    const target = document.getElementById(LIVE_DEMO_TARGET_ID);

    if (!target) {
      return;
    }

    event.preventDefault();

    const prefersReducedMotion = window.matchMedia?.(
      REDUCED_MOTION_QUERY
    ).matches;

    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });

    if (window.history?.replaceState) {
      window.history.replaceState(null, "", `#${LIVE_DEMO_TARGET_ID}`);
    }

    const isPrecisePointer = window.matchMedia?.(
      PRECISE_POINTER_QUERY
    ).matches;

    if (isPrecisePointer) {
      window.setTimeout(
        () => {
          document
            .querySelector<HTMLTextAreaElement>(LIVE_DEMO_INPUT_SELECTOR)
            ?.focus({ preventScroll: true });
        },
        prefersReducedMotion ? 50 : 450
      );
    }
  }

  return (
    <Link
      href={href}
      className={className}
      prefetch={prefetch}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}
