"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { DashboardBadge } from "../../ui/badge";
import { DashboardButton } from "../../ui/button";
import { fieldLabel, inputBase, row, stack } from "../../ui/styles";
import { dashboardColors, dashboardTypography } from "../../ui/tokens";
import {
  setShareLinkExpiryRequestSchema,
  setSharePinRequestSchema,
  type ShareLinkManagementStateData,
} from "@/lib/share/share-contracts";
import {
  formatShareLinkExpiryForDisplay,
  localDateTimeInputFromUtcIso,
  utcIsoFromLocalDateTimeInput,
} from "./share-link-datetime";
import { ConfirmableActionButton } from "./share-link-confirmable-button";
import type { ShareLinkActionKind } from "./use-share-link";

/*
  Phase 2C -- PIN and expiry owner controls.

  PIN: the management state exposes only `hasPin` (a boolean), by design
  -- an existing plaintext PIN is never retrievable or displayed. This
  component never reads or stores a PIN beyond the single input field the
  owner is actively typing into, and that field is cleared the instant a
  submission is made (success or failure), never lingering longer than
  necessary. Validation reuses the exact same exported
  `setSharePinRequestSchema` the PUT route itself parses the request body
  through -- this component performs no PIN hashing of its own; the
  server remains the sole authority.

  Expiry: `link.expiresAt` (nullable ISO string) is shown directly from
  the authoritative management state. The owner picks a local date/time
  via a native `datetime-local` input, converted to a UTC ISO timestamp
  through share-link-datetime.ts (never lib/tasks/date-only.ts's
  `DateOnly`, which has no time-of-day component). A past or malformed
  value is rejected client-side WITHOUT calling the API and WITHOUT
  silently correcting it -- the server remains authoritative that expiry
  must be strictly in the future. Removing expiry is hidden while
  `link.state === "expired"`, matching clear_share_link_expiry's own
  SHARE_LINK_STATE_CONFLICT restriction for that state (see
  202608060002_client_share_access_operations.sql) -- this is a real
  backend restriction being respected, not bypassed.
*/

type ManagedShareLink = NonNullable<ShareLinkManagementStateData["link"]>;

export type ShareLinkAccessControlsProps = {
  link: ManagedShareLink;
  disabled: boolean;
  actionPending: ShareLinkActionKind | null;
  confirmingClearPin: boolean;
  onSetPin: (pin: string) => void;
  onRequestClearPin: () => void;
  onCancelClearPinConfirm: () => void;
  onSetExpiry: (expiresAtIso: string) => void;
  onClearExpiry: () => void;
};

export function ShareLinkAccessControls({
  link,
  disabled,
  actionPending,
  confirmingClearPin,
  onSetPin,
  onRequestClearPin,
  onCancelClearPinConfirm,
  onSetExpiry,
  onClearExpiry,
}: ShareLinkAccessControlsProps) {
  const [pinFormOpen, setPinFormOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const [expiryFormOpen, setExpiryFormOpen] = useState(false);
  const [expiryInput, setExpiryInput] = useState("");
  const [expiryError, setExpiryError] = useState<string | null>(null);

  // A fresh authoritative read (open, or the refresh that follows any
  // successful action) always closes both forms and discards whatever
  // was locally typed -- a stale PIN/expiry draft must never linger past
  // a real state change.
  useEffect(() => {
    setPinFormOpen(false);
    setPinInput("");
    setPinError(null);
    setExpiryFormOpen(false);
    setExpiryInput("");
    setExpiryError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.id, link.configurationVersion]);

  function openPinForm() {
    setPinInput("");
    setPinError(null);
    setPinFormOpen(true);
  }

  function closePinForm() {
    setPinInput("");
    setPinError(null);
    setPinFormOpen(false);
  }

  function submitPin() {
    const parsed = setSharePinRequestSchema.safeParse({ pin: pinInput });

    if (!parsed.success) {
      setPinError("PIN must be exactly 4-6 digits.");
      return;
    }

    const pin = parsed.data.pin;
    // Cleared immediately, before the request even resolves -- the PIN
    // must never be retained in this input longer than the single
    // submit action that consumes it.
    setPinInput("");
    setPinError(null);
    setPinFormOpen(false);
    onSetPin(pin);
  }

  function openExpiryForm() {
    setExpiryInput(localDateTimeInputFromUtcIso(link.expiresAt));
    setExpiryError(null);
    setExpiryFormOpen(true);
  }

  function closeExpiryForm() {
    setExpiryInput("");
    setExpiryError(null);
    setExpiryFormOpen(false);
  }

  function submitExpiry() {
    const iso = utcIsoFromLocalDateTimeInput(expiryInput);

    if (!iso) {
      setExpiryError("Enter a valid date and time.");
      return;
    }

    // Client-side future check only -- a convenience that avoids an
    // obviously-doomed round trip. The server independently re-validates
    // this; nothing here ever silently corrects the owner's input.
    if (new Date(iso).getTime() <= Date.now()) {
      setExpiryError("Expiry must be in the future.");
      return;
    }

    const parsed = setShareLinkExpiryRequestSchema.safeParse({ expiresAt: iso });

    if (!parsed.success) {
      setExpiryError("Enter a valid date and time.");
      return;
    }

    setExpiryError(null);
    setExpiryFormOpen(false);
    onSetExpiry(parsed.data.expiresAt);
  }

  const canClearExpiry = link.expiresAt !== null && link.state !== "expired";

  return (
    <div style={stack(5)}>
      <SectionHeading title="Access" />

      <div style={stack(2)}>
        <span style={fieldLabel}>PIN</span>
        {!link.hasPin ? (
          pinFormOpen ? (
            <PinForm
              value={pinInput}
              error={pinError}
              disabled={disabled}
              loading={actionPending === "setPin"}
              onChange={setPinInput}
              onSubmit={submitPin}
              onCancel={closePinForm}
            />
          ) : (
            <DashboardButton variant="secondary" size="sm" onClick={openPinForm} disabled={disabled}>
              Add PIN
            </DashboardButton>
          )
        ) : pinFormOpen ? (
          <PinForm
            value={pinInput}
            error={pinError}
            disabled={disabled}
            loading={actionPending === "setPin"}
            onChange={setPinInput}
            onSubmit={submitPin}
            onCancel={closePinForm}
          />
        ) : (
          <div style={row(2)}>
            <DashboardBadge variant="blue">PIN protected</DashboardBadge>
            <DashboardButton variant="secondary" size="sm" onClick={openPinForm} disabled={disabled}>
              Change PIN
            </DashboardButton>
            <ConfirmableActionButton
              label="Remove PIN"
              confirmLabel="Confirm remove"
              isConfirming={confirmingClearPin}
              loading={actionPending === "clearPin"}
              disabled={disabled}
              variant="danger"
              onClick={onRequestClearPin}
              onCancel={onCancelClearPinConfirm}
            />
          </div>
        )}
      </div>

      <div style={stack(2)}>
        <span style={fieldLabel}>Expiry</span>
        <p style={bodyTextStyle}>
          {link.expiresAt
            ? `Expires ${formatShareLinkExpiryForDisplay(link.expiresAt)}`
            : "No expiry set."}
        </p>
        {expiryFormOpen ? (
          <div style={stack(2)}>
            <input
              type="datetime-local"
              value={expiryInput}
              disabled={disabled}
              onChange={(event) => setExpiryInput(event.target.value)}
              style={inputBase}
              aria-label="Expiry date and time"
            />
            {expiryError ? (
              <p role="alert" style={errorTextStyle}>
                {expiryError}
              </p>
            ) : null}
            <div style={row(2)}>
              <DashboardButton
                variant="primary"
                size="sm"
                onClick={submitExpiry}
                loading={actionPending === "setExpiry"}
                disabled={disabled}
              >
                Save expiry
              </DashboardButton>
              <DashboardButton
                variant="ghost"
                size="sm"
                onClick={closeExpiryForm}
                disabled={actionPending === "setExpiry"}
              >
                Cancel
              </DashboardButton>
            </div>
          </div>
        ) : (
          <div style={row(2)}>
            <DashboardButton variant="secondary" size="sm" onClick={openExpiryForm} disabled={disabled}>
              {link.expiresAt ? "Change expiry" : "Set expiry"}
            </DashboardButton>
            {canClearExpiry ? (
              <DashboardButton
                variant="ghost"
                size="sm"
                onClick={onClearExpiry}
                loading={actionPending === "clearExpiry"}
                disabled={disabled}
              >
                Remove expiry
              </DashboardButton>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function PinForm({
  value,
  error,
  disabled,
  loading,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  error: string | null;
  disabled: boolean;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={stack(2)}>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        disabled={disabled}
        placeholder="4-6 digit PIN"
        onChange={(event) => onChange(event.target.value)}
        style={inputBase}
        aria-label="New PIN"
      />
      {error ? (
        <p role="alert" style={errorTextStyle}>
          {error}
        </p>
      ) : null}
      <div style={row(2)}>
        <DashboardButton variant="primary" size="sm" onClick={onSubmit} loading={loading} disabled={disabled}>
          Save PIN
        </DashboardButton>
        <DashboardButton variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
          Cancel
        </DashboardButton>
      </div>
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h3 style={sectionTitleStyle}>{title}</h3>;
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.md,
  fontWeight: dashboardTypography.weight.semibold,
  color: dashboardColors.text.primary,
};

const bodyTextStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.md,
  color: dashboardColors.text.secondary,
};

const errorTextStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.status.red,
};
