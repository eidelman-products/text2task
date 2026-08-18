"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { rawShareSecretSchema } from "@/lib/share/share-contracts";
import type { ClientProjectProjection } from "@/lib/share/client-share-projection-contracts";
import { ClientProjectView } from "@/app/components/dashboard/tasks/share-link/client-project-view";

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
*/

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
      return <ShareViewMessage title="Loading shared project…" />;
    case "authorizing":
      return <ShareViewMessage title="Checking PIN…" />;
    case "pin_required":
      return <SharePinForm error={state.error} onSubmit={onSubmitPin} />;
    case "ready":
      return <ClientProjectView projection={state.projection} publicId={publicId} />;
    case "rate_limited":
      return (
        <ShareViewMessage title="Please wait a moment and try again." />
      );
    case "unavailable":
      return (
        <ShareViewMessage title="This shared project view is not available." />
      );
  }
}

function ShareViewMessage({ title }: { title: string }) {
  return (
    <div style={containerStyle}>
      <p style={messageStyle}>{title}</p>
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
    <div style={containerStyle}>
      <div style={pinCardStyle}>
        <p style={messageStyle}>This project is PIN protected.</p>
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
  fontSize: 16,
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
