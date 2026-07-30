"use client";

import { useEffect, useState } from "react";

import { dashboardBreakpoints } from "./tokens";

/*
  Shared mobile-breakpoint media-query hook -- extracted verbatim from
  DatePickerPopover's own file-local useIsMobile
  (app/components/dashboard/ui/calendar/date-picker-popover.tsx), which
  ResponsiveDialog (responsive-dialog.tsx) also needs. Behavior is unchanged:
  starts `false` (matches SSR, where no viewport exists), then syncs to the
  real value and stays in sync via the MediaQueryList "change" event.
*/

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(
      `(max-width: ${dashboardBreakpoints.mobile - 1}px)`
    );

    function handleChange() {
      setIsMobile(query.matches);
    }

    handleChange();
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}
