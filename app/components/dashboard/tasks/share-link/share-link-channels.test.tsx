// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";

import { ShareLinkChannels, type ShareLinkChannelsProps } from "./share-link-channels";

function renderChannels(overrides: Partial<ShareLinkChannelsProps> = {}) {
  const onCopyLink = vi.fn();
  const onNativeShare = vi.fn();
  const onWhatsApp = vi.fn();
  const onRequestRotate = vi.fn();
  const onCancelRotateConfirm = vi.fn();

  const defaultProps: ShareLinkChannelsProps = {
    linkState: "active",
    actionPending: null,
    disabled: false,
    copyStatus: "idle",
    confirmingRotate: false,
    onCopyLink,
    onNativeShare,
    onWhatsApp,
    onRequestRotate,
    onCancelRotateConfirm,
    ...overrides,
  };

  const view = render(<ShareLinkChannels {...defaultProps} />);
  return { onCopyLink, onNativeShare, onWhatsApp, onRequestRotate, onCancelRotateConfirm, ...view };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ShareLinkChannels - Copy Link", () => {
  it("renders Copy for an active link and calls onCopyLink", async () => {
    const { onCopyLink } = renderChannels({ linkState: "active" });

    const button = screen.getByRole("button", { name: /copy client link/i });
    await userEvent.click(button);

    expect(onCopyLink).toHaveBeenCalledTimes(1);
  });

  it("shows 'Link copied' once copyStatus is copied", () => {
    renderChannels({ copyStatus: "copied" });
    expect(screen.getByRole("button", { name: /link copied/i })).toBeInTheDocument();
  });

  it("does not render Copy/Share/WhatsApp for a non-active, non-rotatable state (draft)", () => {
    renderChannels({ linkState: "draft" });
    expect(screen.queryByRole("button", { name: /copy client link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /share\.\.\./i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /whatsapp/i })).not.toBeInTheDocument();
  });
});

describe("ShareLinkChannels - Native Share", () => {
  it("renders a Share button and calls onNativeShare when navigator.share is supported", async () => {
    vi.stubGlobal("navigator", { share: vi.fn() });
    const { onNativeShare } = renderChannels();

    await userEvent.click(screen.getByRole("button", { name: /share\.\.\./i }));

    expect(onNativeShare).toHaveBeenCalledTimes(1);
  });

  it("shows safe fallback guidance instead of a button when navigator.share is unsupported", () => {
    vi.stubGlobal("navigator", {});
    renderChannels();

    expect(screen.queryByRole("button", { name: /share\.\.\./i })).not.toBeInTheDocument();
    expect(screen.getByText(/native sharing is not available/i)).toBeInTheDocument();
  });
});

describe("ShareLinkChannels - Native Share hydration safety", () => {
  const requiredProps: ShareLinkChannelsProps = {
    linkState: "active",
    actionPending: null,
    disabled: false,
    copyStatus: "idle",
    confirmingRotate: false,
    onCopyLink: vi.fn(),
    onNativeShare: vi.fn(),
    onWhatsApp: vi.fn(),
    onRequestRotate: vi.fn(),
    onCancelRotateConfirm: vi.fn(),
  };

  it("server-rendered markup always shows the unsupported fallback -- Node has no Web Share API, and the render body never reads navigator.share to decide otherwise", () => {
    const html = renderToString(<ShareLinkChannels {...requiredProps} />);
    expect(html).toMatch(/native sharing is not available/i);
    expect(html).not.toMatch(/share\.\.\./i);
  });

  it("hydrating that exact server HTML in a browser that DOES support navigator.share produces no React hydration mismatch", async () => {
    // The server pass: identical to what Next.js's own SSR would produce
    // for this component (Node has no Web Share API).
    const html = renderToString(<ShareLinkChannels {...requiredProps} />);

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    // Now hydrate that exact markup in a simulated browser that DOES
    // support navigator.share -- the scenario this review asked about
    // directly: does the first client (hydration) render produce a tree
    // different from the server's?
    vi.stubGlobal("navigator", { share: vi.fn() });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      hydrateRoot(container, <ShareLinkChannels {...requiredProps} />);
    });

    const hydrationMismatchLogged = consoleErrorSpy.mock.calls.some((call) =>
      call.some((arg) => typeof arg === "string" && /hydrat/i.test(arg))
    );
    // The crucial safety proof: React's own hydration reconciliation
    // found the server markup and the first client render identical --
    // if the render body had read navigator.share directly (the unsafe
    // version this review flagged), React would log a hydration
    // mismatch warning here, because the server pass (no Web Share API)
    // and this client pass (mocked-supported) would disagree.
    expect(hydrationMismatchLogged).toBe(false);

    // `await act(...)` also flushes this mount's own passive effect, so
    // by now the post-mount capability check has already run and the UI
    // has already updated to reflect the real (mocked-supported)
    // browser -- proving the two-phase behavior completes correctly,
    // not just that it started safely.
    expect(container.textContent).not.toMatch(/native sharing is not available/i);
    expect(container.textContent).toMatch(/share\.\.\./i);

    document.body.removeChild(container);
  });
});

describe("ShareLinkChannels - WhatsApp", () => {
  it("opens a blank window synchronously on click WITHOUT the noopener/noreferrer feature (which browsers resolve to a null return, defeating the pre-open strategy), then calls onWhatsApp with that handle", async () => {
    const popupStub = { closed: false, opener: {} } as unknown as Window;
    const windowOpenMock = vi.spyOn(window, "open").mockReturnValue(popupStub);
    const { onWhatsApp } = renderChannels();

    await userEvent.click(screen.getByRole("button", { name: /whatsapp/i }));

    expect(windowOpenMock).toHaveBeenCalledWith("about:blank", "_blank");
    const [, , features] = windowOpenMock.mock.calls[0];
    expect(features).toBeUndefined();
    expect(onWhatsApp).toHaveBeenCalledWith(popupStub);
  });

  it("severs the opener relationship on the returned handle without discarding it, instead of relying on the noopener feature", async () => {
    const popupStub = { closed: false, opener: {} } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popupStub);
    renderChannels();

    await userEvent.click(screen.getByRole("button", { name: /whatsapp/i }));

    expect((popupStub as unknown as { opener: unknown }).opener).toBeNull();
  });

  it("rapid double-click creates exactly one popup context and calls onWhatsApp exactly once, even before any re-render", () => {
    const windowOpenMock = vi
      .spyOn(window, "open")
      .mockReturnValue({ closed: false, opener: {} } as unknown as Window);
    const onWhatsApp = vi.fn();
    renderChannels({ onWhatsApp });

    const button = screen.getByRole("button", { name: /whatsapp/i });
    // fireEvent (not userEvent) to fire both clicks perfectly
    // synchronously, in the same tick, before React gets any chance to
    // re-render `disabled` in response to the first click.
    fireEvent.click(button);
    fireEvent.click(button);

    expect(windowOpenMock).toHaveBeenCalledTimes(1);
    expect(onWhatsApp).toHaveBeenCalledTimes(1);
  });
});

describe("ShareLinkChannels - Rotate", () => {
  it("renders Rotate for an active link", () => {
    renderChannels({ linkState: "active" });
    expect(screen.getByRole("button", { name: /^rotate link$/i })).toBeInTheDocument();
  });

  it("renders Rotate for a disabled link", () => {
    renderChannels({ linkState: "disabled" });
    expect(screen.getByRole("button", { name: /^rotate link$/i })).toBeInTheDocument();
  });

  it("does not render Rotate for a draft or expired link", () => {
    renderChannels({ linkState: "draft" });
    expect(screen.queryByRole("button", { name: /rotate link/i })).not.toBeInTheDocument();

    renderChannels({ linkState: "expired" });
    expect(screen.queryAllByRole("button", { name: /rotate link/i })).toHaveLength(0);
  });

  it("the first click only arms confirmation (calls onRequestRotate), never onRotate directly on this component", async () => {
    const { onRequestRotate } = renderChannels({ linkState: "active", confirmingRotate: false });

    await userEvent.click(screen.getByRole("button", { name: /^rotate link$/i }));

    expect(onRequestRotate).toHaveBeenCalledTimes(1);
  });

  it("shows the explicit invalidation warning once confirming", () => {
    renderChannels({ linkState: "active", confirmingRotate: true });
    expect(
      screen.getByText(/immediately invalidate the previously shared client link/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm rotate/i })).toBeInTheDocument();
  });

  it("cancelling the confirmation calls onCancelRotateConfirm", async () => {
    const { onCancelRotateConfirm } = renderChannels({ linkState: "active", confirmingRotate: true });

    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(onCancelRotateConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("ShareLinkChannels - disabled/pending state", () => {
  it("disables all controls when disabled is true", () => {
    vi.stubGlobal("navigator", { share: vi.fn() });
    renderChannels({ linkState: "active", disabled: true });

    expect(screen.getByRole("button", { name: /copy client link/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /share\.\.\./i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /whatsapp/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^rotate link$/i })).toBeDisabled();
  });

  it("renders nothing for a fully non-revealable, non-rotatable state (expired)", () => {
    const { container } = renderChannels({ linkState: "expired" });
    expect(container).toBeEmptyDOMElement();
  });
});
