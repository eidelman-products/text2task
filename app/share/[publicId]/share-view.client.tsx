"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { rawShareSecretSchema } from "@/lib/share/share-contracts";
import type { ClientProjectProjection } from "@/lib/share/client-share-projection-contracts";
import { ClientProjectView } from "@/app/components/dashboard/tasks/share-link/client-project-view";
import { PublicMessagesSection } from "@/app/components/dashboard/tasks/share-link/public-messages-section";

/*
  Phase 3 -- the public, no-login client state machine for
  /share/[publicId]. The server-rendered shell (page.tsx) hands this
  component nothing but the publicId from the URL path -- no project
  data, no secret. Everything below happens client-side, after mount:

    1. read window.location.hash (never read or forwarded by the server)
    2. validate its shape with the SAME canonical schema the server uses
       (rawShareSecretSchema, lib/share/share-contracts.ts -- no second,
       hand-rolled regex)
    3. scrub it from the visible URL via history.replaceState, before
       any network call
    4. exchange it with the server (POST /api/share/session)
    5. on success, fetch the strict Phase 2D projection
       (GET /api/share/[publicId]/projection) using ONLY the now-set
       HttpOnly session cookie -- never the secret again
    6. render it through the SAME ClientProjectView Phase 2D's owner
       Preview already uses -- no second view component, no second
       visibility system

  The raw secret's only client-side home is `secretRef` (a plain
  useRef, never React state, so it is never re-rendered into the DOM,
  never serialized, never logged) -- and only for as long as a
  PIN-protected link's second exchange call still needs to resend it.
  Cleared on: successful authorization, any terminal error/rate-limit,
  unmount, and publicId change.

  PHASE 7C -- live invalidation / background revalidation. The Phase 7
  audit proved a real gap: this projection was fetched exactly once on
  mount, so an already-open tab could keep showing stale project content
  indefinitely after the owner revoked/disabled the link, it expired,
  its PIN/secret changed, or task/resource mappings changed -- server
  authorization was already correct on the *next* request; nothing made
  that next request happen automatically. Closed below with:

    - a bounded, GET-projection-only revalidation (no WebSockets/SSE,
      no new endpoint): the exact same GET /api/share/[publicId]/projection
      this component already calls, reused via `revalidateProjection`
      below, which wraps `fetchProjection` and adds only the
      "stale-grant fallback" behavior described next to it.
    - triggers: focus/visibilitychange (best-effort, immediate) AND a
      bounded 60s interval, both gated to only run while
      `state.status === "ready"` and the document is actually visible
      -- see the dedicated effect below.
    - the `file_access`/`projection_read`/`comment_submission` rate-limit
      budgets this feature already enforces are the ceiling this
      interval was chosen against: `projection_read` is 120 requests /
      300s (lib/share/share-rate-limit.server.ts). A 60s poll consumes
      at most 5 of those 120 in any given 300s window -- comfortably
      below the budget even stacked with the initial load, any
      focus-triggered extra polls, and normal message-history reads,
      which all share the SAME bucket.
    - a single in-flight ref (`revalidationInFlightRef`) fully serializes
      every revalidation attempt (interval and focus/visibility can never
      overlap each other, and can never overlap the component's own
      initial mount-time fetchProjection call, since the revalidation
      effect below is itself gated on `state.status === "ready"`, which
      is only ever true AFTER that initial fetch has already completed)
      -- this is what "avoid overlapping fetches" and "no stale earlier
      response overwriting a newer one" reduce to here: there is
      structurally never more than one request in flight to race against.
*/

// Chosen against the real projection_read policy (120/300s) -- see the
// header comment above for the exact arithmetic. Not a magic number.
// Exported so the test file asserts against the real value in force,
// rather than a separately hardcoded (and driftable) duplicate.
export const REVALIDATION_INTERVAL_MS = 60_000;

type PublicShareState =
  | { status: "loading" }
  | { status: "pin_required"; error: string | null }
  | { status: "authorizing" }
  | { status: "ready"; projection: ClientProjectProjection }
  | { status: "rate_limited" }
  | { status: "unavailable" };

type ExchangeSuccessBody =
  | { ok: true; status: "authorized" }
  | { ok: true; status: "pin_required" };

type ExchangeErrorBody = { ok: false; code: string; error: string };

type ProjectionSuccessBody = { ok: true; data: ClientProjectProjection };
type ProjectionErrorBody = { ok: false; code: string; error: string };

export function ShareView({ publicId }: { publicId: string }) {
  const [state, setState] = useState<PublicShareState>({ status: "loading" });
  const secretRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  const clearSecret = useCallback(() => {
    secretRef.current = null;
  }, []);

  const fetchProjection = useCallback(async () => {
    try {
      const response = await fetch(`/api/share/${encodeURIComponent(publicId)}/projection`, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
      });

      if (response.status === 429) {
        if (isMountedRef.current) setState({ status: "rate_limited" });
        return;
      }

      const body = (await safeJson(response)) as
        | ProjectionSuccessBody
        | ProjectionErrorBody
        | null;

      if (response.ok && body && body.ok) {
        if (isMountedRef.current) setState({ status: "ready", projection: body.data });
        return;
      }

      if (isMountedRef.current) setState({ status: "unavailable" });
    } catch {
      if (isMountedRef.current) setState({ status: "unavailable" });
    }
  }, [publicId]);

  const exchange = useCallback(
    async (secret: string, pin?: string) => {
      if (isMountedRef.current) {
        setState((current) =>
          current.status === "pin_required" ? { status: "authorizing" } : current
        );
      }

      try {
        const response = await fetch("/api/share/session", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8", Accept: "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify(pin === undefined ? { publicId, secret } : { publicId, secret, pin }),
        });

        if (response.status === 429) {
          clearSecret();
          if (isMountedRef.current) setState({ status: "rate_limited" });
          return;
        }

        const body = (await safeJson(response)) as
          | ExchangeSuccessBody
          | ExchangeErrorBody
          | null;

        if (response.ok && body && body.ok && body.status === "authorized") {
          clearSecret();
          await fetchProjection();
          return;
        }

        if (response.ok && body && body.ok && body.status === "pin_required") {
          if (isMountedRef.current) setState({ status: "pin_required", error: null });
          return;
        }

        if (response.status === 401 && body && !body.ok && body.code === "PIN_INCORRECT") {
          // Wrong PIN: keep the secret ref intact so the user can retry
          // without reopening the original link -- this is the one
          // non-terminal failure case.
          if (isMountedRef.current) {
            setState({ status: "pin_required", error: "Incorrect PIN. Please try again." });
          }
          return;
        }

        clearSecret();
        if (isMountedRef.current) setState({ status: "unavailable" });
      } catch {
        clearSecret();
        if (isMountedRef.current) setState({ status: "unavailable" });
      }
    },
    [publicId, fetchProjection, clearSecret]
  );

  useEffect(() => {
    isMountedRef.current = true;
    clearSecret();
    setState({ status: "loading" });

    const rawHash = window.location.hash;

    if (rawHash.length > 1) {
      const candidate = rawHash.slice(1);

      // Scrub the fragment from the visible URL FIRST, before any
      // network call -- history.replaceState is non-navigating, so this
      // never adds a back-button entry and never re-requests the page.
      const cleanUrl = new URL(window.location.href);
      cleanUrl.hash = "";
      window.history.replaceState(null, "", cleanUrl.pathname + cleanUrl.search);

      const parsed = rawShareSecretSchema.safeParse(candidate);

      if (!parsed.success) {
        setState({ status: "unavailable" });
        return;
      }

      secretRef.current = parsed.data;
      void exchange(parsed.data);
    } else {
      // No fragment -- either a returning visitor refreshing the clean
      // URL with a still-valid session cookie, or a genuinely
      // unauthorized visitor. Either way, the only safe next step is to
      // ask the session-authorized projection endpoint, never to invent
      // a "you need the original link" state that would itself be a
      // partial existence signal.
      void fetchProjection();
    }

    return () => {
      isMountedRef.current = false;
      clearSecret();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicId]);

  const submitPin = useCallback(
    (pin: string) => {
      const secret = secretRef.current;
      if (!secret) {
        setState({ status: "unavailable" });
        return;
      }
      void exchange(secret, pin);
    },
    [exchange]
  );

  // Phase 7C -- serializes every background revalidation attempt (see
  // this file's own header comment for the full race-safety argument).
  const revalidationInFlightRef = useRef(false);

  const revalidateProjection = useCallback(async () => {
    if (revalidationInFlightRef.current) return;
    revalidationInFlightRef.current = true;

    try {
      const response = await fetch(`/api/share/${encodeURIComponent(publicId)}/projection`, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
      });

      if (response.status === 429) {
        // A single background poll getting rate-limited is not itself an
        // access-loss signal -- skip this cycle silently, keep showing
        // the last-known-good projection, and let the next scheduled/
        // focus-triggered attempt retry naturally. Never disrupts the
        // current view for this.
        return;
      }

      const body = (await safeJson(response)) as
        | ProjectionSuccessBody
        | ProjectionErrorBody
        | null;

      if (response.ok && body && body.ok) {
        // Preserve normal UI stability: only replace the projection if
        // still genuinely "ready" (never resurrect a view the user has
        // since navigated away from via some other transition) -- and
        // only ever replace the whole projection object wholesale, never
        // merge/patch, so a mapping/title/status/resource/task change is
        // reflected exactly as the authoritative server now reports it,
        // with no separate cache layer of any kind.
        if (isMountedRef.current) {
          setState((current) =>
            current.status === "ready" ? { status: "ready", projection: body.data } : current
          );
        }
        return;
      }

      // Access is no longer valid (revoked/disabled/expired/PIN-changed/
      // rotated/stale-configuration-version -- the projection route
      // itself does not, and by design must not, distinguish which).
      // The raw secret is intentionally never retained past its first
      // use (see exchange() above, and this file's own header comment)
      // -- so a background revalidation structurally cannot re-exchange
      // with a PIN even if one is now required, and must not invent a
      // way to. The only safe, already-existing recourse is exactly the
      // same plain, cookie-only fetchProjection() a returning visitor's
      // own page load already uses: one more attempt, no loop, no
      // secret involved. If that also fails, fetchProjection() itself
      // already fails closed to "unavailable", which drops the stale
      // projection and unmounts PublicMessagesSection along with it (see
      // the render switch below) -- exactly the fail-closed behavior
      // this slice requires, achieved with zero new mechanism.
      await fetchProjection();
    } catch {
      // Network hiccup during a background poll -- do not disrupt the
      // current view; the next attempt will retry naturally.
    } finally {
      revalidationInFlightRef.current = false;
    }
  }, [publicId, fetchProjection]);

  // Phase 7C -- focus/visibility (best-effort, immediate) and a bounded
  // interval, both gated to "ready" and to the document actually being
  // visible. This effect's own cleanup (listener removal + clearInterval)
  // runs on every dependency change, including the transition OUT of
  // "ready" (e.g. after a failed revalidation, or a normal unmount) --
  // so there is no separate teardown path to keep in sync, and no timer
  // can ever outlive either this effect's own scope or the component.
  useEffect(() => {
    if (state.status !== "ready") return;

    function handleFocusOrVisibility() {
      if (document.visibilityState === "visible") {
        void revalidateProjection();
      }
    }

    document.addEventListener("visibilitychange", handleFocusOrVisibility);
    window.addEventListener("focus", handleFocusOrVisibility);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void revalidateProjection();
      }
    }, REVALIDATION_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", handleFocusOrVisibility);
      window.removeEventListener("focus", handleFocusOrVisibility);
      window.clearInterval(intervalId);
    };
  }, [state.status, revalidateProjection]);

  return <ShareViewBody state={state} onSubmitPin={submitPin} publicId={publicId} />;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function ShareViewBody({
  state,
  onSubmitPin,
  publicId,
}: {
  state: PublicShareState;
  onSubmitPin: (pin: string) => void;
  publicId: string;
}) {
  switch (state.status) {
    case "loading":
      return <ShareViewMessage title="Loading shared project…" liveRole="status" />;
    case "authorizing":
      return <ShareViewMessage title="Checking PIN…" liveRole="status" />;
    case "pin_required":
      return <SharePinForm error={state.error} onSubmit={onSubmitPin} />;
    case "ready":
      return (
        <div style={readyPageStyle}>
          <ClientProjectView projection={state.projection} publicId={publicId} />
          <div style={messagesWrapperStyle}>
            <PublicMessagesSection
              publicId={publicId}
              commentsEnabled={state.projection.commentsEnabled}
              contentDirection={state.projection.contentDirection}
            />
          </div>
        </div>
      );
    case "rate_limited":
      return (
        <ShareViewMessage title="Please wait a moment and try again." liveRole="alert" />
      );
    case "unavailable":
      return (
        <ShareViewMessage title="This shared project view is not available." liveRole="alert" />
      );
  }
}

// Phase 7D accessibility hardening -- every top-level page state now
// carries exactly one heading (previously none of these states had any
// heading element at all), and a state that changes without a user
// action carries the matching live-region role so assistive tech
// announces the transition without requiring focus to move: "status"
// (polite) for ordinary loading/progress, "alert" (assertive) only for
// an outcome that actually stops the flow (rate-limited/unavailable).
// Deliberately NOT applied to "ready" -- ClientProjectView's own real
// content (including its own <h1>) takes over at that point, and the
// 60s background revalidation success path intentionally does not
// re-announce anything (see share-view.client.tsx's own header comment
// on why a no-op refresh must stay silent).
function ShareViewMessage({
  title,
  liveRole,
}: {
  title: string;
  liveRole?: "status" | "alert";
}) {
  return (
    <div
      style={containerStyle}
      dir="auto"
      role={liveRole}
      aria-live={liveRole ? (liveRole === "alert" ? "assertive" : "polite") : undefined}
    >
      <h1 style={messageStyle}>{title}</h1>
    </div>
  );
}

function SharePinForm({
  error,
  onSubmit,
}: {
  error: string | null;
  onSubmit: (pin: string) => void;
}) {
  const [pin, setPin] = useState("");

  return (
    <div style={containerStyle} dir="auto">
      <div style={pinCardStyle}>
        <h1 style={messageStyle}>This project is PIN protected.</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(pin);
          }}
          style={{ display: "grid", gap: 12 }}
        >
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/[^0-9]/g, ""))}
            aria-label="PIN"
            style={pinInputStyle}
          />
          {error ? <p style={errorTextStyle}>{error}</p> : null}
          <button type="submit" disabled={pin.length < 4} style={continueButtonStyle}>
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}

const readyPageStyle: CSSProperties = {
  background: "#f6f8fb",
  minHeight: "100%",
};

const messagesWrapperStyle: CSSProperties = {
  padding: "0 16px 32px",
};

const containerStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  background: "#f8fafc",
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 400,
  color: "#334155",
  textAlign: "center",
};

const pinCardStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  width: "100%",
  maxWidth: 320,
  padding: 24,
  borderRadius: 16,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
};

const pinInputStyle: CSSProperties = {
  fontSize: 20,
  letterSpacing: "0.3em",
  textAlign: "center",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
};

const errorTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#dc2626",
};

const continueButtonStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "#1e40af",
  color: "#ffffff",
  fontWeight: 600,
  cursor: "pointer",
};
