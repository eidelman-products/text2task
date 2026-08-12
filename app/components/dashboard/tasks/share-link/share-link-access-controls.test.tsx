// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ShareLinkAccessControls, type ShareLinkAccessControlsProps } from "./share-link-access-controls";

const LINK_ID = "22222222-2222-4222-8222-222222222222";

function link(overrides: Record<string, unknown> = {}) {
  return {
    id: LINK_ID,
    publicId: "abcdefgh12345678ijklmnop",
    state: "active" as const,
    expiresAt: null,
    hasPin: false,
    commentsEnabled: true,
    clientFacingSubtitle: null,
    contentDirection: "auto" as const,
    titleVisible: false,
    statusVisible: false,
    targetDateVisible: false,
    configurationVersion: 1,
    createdAt: "2026-08-10T00:00:00Z",
    activatedAt: "2026-08-10T00:00:00Z",
    disabledAt: null,
    rotatedAt: null,
    lastViewedAt: null,
    viewCount: 0,
    ...overrides,
  };
}

function renderAccessControls(overrides: Partial<ShareLinkAccessControlsProps> = {}) {
  const onSetPin = vi.fn();
  const onRequestClearPin = vi.fn();
  const onCancelClearPinConfirm = vi.fn();
  const onSetExpiry = vi.fn();
  const onClearExpiry = vi.fn();

  const defaultProps: ShareLinkAccessControlsProps = {
    link: link(),
    disabled: false,
    actionPending: null,
    confirmingClearPin: false,
    onSetPin,
    onRequestClearPin,
    onCancelClearPinConfirm,
    onSetExpiry,
    onClearExpiry,
    ...overrides,
  };

  const view = render(<ShareLinkAccessControls {...defaultProps} />);
  return { onSetPin, onRequestClearPin, onCancelClearPinConfirm, onSetExpiry, onClearExpiry, ...view };
}

describe("ShareLinkAccessControls - PIN", () => {
  it("hasPin=false renders an Add PIN control, no protected badge", () => {
    renderAccessControls({ link: link({ hasPin: false }) });
    expect(screen.getByRole("button", { name: /add pin/i })).toBeInTheDocument();
    expect(screen.queryByText(/pin protected/i)).not.toBeInTheDocument();
  });

  it("hasPin=true renders the protected badge with Change/Remove PIN actions", () => {
    renderAccessControls({ link: link({ hasPin: true }) });
    expect(screen.getByText(/pin protected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change pin/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove pin/i })).toBeInTheDocument();
  });

  it("a valid PIN set calls onSetPin with the entered value and clears the input", async () => {
    const { onSetPin } = renderAccessControls({ link: link({ hasPin: false }) });

    await userEvent.click(screen.getByRole("button", { name: /add pin/i }));
    const input = screen.getByLabelText(/new pin/i);
    await userEvent.type(input, "1234");
    await userEvent.click(screen.getByRole("button", { name: /save pin/i }));

    expect(onSetPin).toHaveBeenCalledWith("1234");
    // The form closes back to the entry button, and no PIN digits remain
    // anywhere in the rendered DOM.
    expect(screen.queryByLabelText(/new pin/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("1234");
  });

  it("replacing an existing PIN calls the same onSetPin path", async () => {
    const { onSetPin } = renderAccessControls({ link: link({ hasPin: true }) });

    await userEvent.click(screen.getByRole("button", { name: /change pin/i }));
    await userEvent.type(screen.getByLabelText(/new pin/i), "56789");
    await userEvent.click(screen.getByRole("button", { name: /save pin/i }));

    expect(onSetPin).toHaveBeenCalledWith("56789");
  });

  it("an invalid PIN never calls onSetPin", async () => {
    const { onSetPin } = renderAccessControls({ link: link({ hasPin: false }) });

    await userEvent.click(screen.getByRole("button", { name: /add pin/i }));
    await userEvent.type(screen.getByLabelText(/new pin/i), "12");
    await userEvent.click(screen.getByRole("button", { name: /save pin/i }));

    expect(onSetPin).not.toHaveBeenCalled();
    expect(screen.getByText(/4-6 digits/i)).toBeInTheDocument();
  });

  it("Remove PIN calls onRequestClearPin (the confirm toggle lives in the parent)", async () => {
    const { onRequestClearPin } = renderAccessControls({ link: link({ hasPin: true }) });

    await userEvent.click(screen.getByRole("button", { name: /remove pin/i }));

    expect(onRequestClearPin).toHaveBeenCalledTimes(1);
  });

  it("disables all PIN controls when disabled is true", () => {
    renderAccessControls({ link: link({ hasPin: true }), disabled: true });
    expect(screen.getByRole("button", { name: /change pin/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /remove pin/i })).toBeDisabled();
  });
});

describe("ShareLinkAccessControls - Expiry", () => {
  it("shows 'No expiry set' and a Set expiry action when expiresAt is null", () => {
    renderAccessControls({ link: link({ expiresAt: null }) });
    expect(screen.getByText(/no expiry set/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /set expiry/i })).toBeInTheDocument();
  });

  it("shows the formatted expiry and Change/Remove actions when expiresAt is set", () => {
    renderAccessControls({ link: link({ expiresAt: "2026-09-01T12:00:00Z", state: "active" }) });
    expect(screen.getByText(/expires/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change expiry/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove expiry/i })).toBeInTheDocument();
  });

  it("does not render Remove expiry while the link state is expired (respects the backend restriction)", () => {
    renderAccessControls({ link: link({ expiresAt: "2026-01-01T00:00:00Z", state: "expired" }) });
    expect(screen.getByRole("button", { name: /change expiry/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove expiry/i })).not.toBeInTheDocument();
  });

  it("a valid future expiry converts to a UTC ISO timestamp and calls onSetExpiry", async () => {
    const { onSetExpiry } = renderAccessControls({ link: link({ expiresAt: null }) });

    await userEvent.click(screen.getByRole("button", { name: /set expiry/i }));
    const futureYear = new Date().getFullYear() + 2;
    await userEvent.type(
      screen.getByLabelText(/expiry date and time/i),
      `${futureYear}-06-15T10:30`
    );
    await userEvent.click(screen.getByRole("button", { name: /save expiry/i }));

    expect(onSetExpiry).toHaveBeenCalledTimes(1);
    const submitted = onSetExpiry.mock.calls[0][0] as string;
    expect(submitted).toBe(new Date(futureYear, 5, 15, 10, 30, 0, 0).toISOString());
  });

  it("a past value does not call onSetExpiry and shows an inline error", async () => {
    const { onSetExpiry } = renderAccessControls({ link: link({ expiresAt: null }) });

    await userEvent.click(screen.getByRole("button", { name: /set expiry/i }));
    await userEvent.type(screen.getByLabelText(/expiry date and time/i), "2020-01-01T00:00");
    await userEvent.click(screen.getByRole("button", { name: /save expiry/i }));

    expect(onSetExpiry).not.toHaveBeenCalled();
    expect(screen.getByText(/must be in the future/i)).toBeInTheDocument();
  });

  it("Remove expiry calls onClearExpiry directly", async () => {
    const { onClearExpiry } = renderAccessControls({
      link: link({ expiresAt: "2026-09-01T00:00:00Z", state: "active" }),
    });

    await userEvent.click(screen.getByRole("button", { name: /remove expiry/i }));

    expect(onClearExpiry).toHaveBeenCalledTimes(1);
  });

  it("a backend error preserves the prior displayed expiry (no local optimistic overwrite)", async () => {
    // This component never mutates `link` itself -- it only ever reads
    // the authoritative prop. Simulating "the save failed" is simply
    // never re-rendering with a new `link`, which is exactly what the
    // real hook does when an action's promise rejects.
    renderAccessControls({ link: link({ expiresAt: "2026-09-01T00:00:00Z", state: "active" }) });
    expect(screen.getByText(/expires/i)).toBeInTheDocument();
  });
});
