import { describe, expect, it } from "vitest";
import { isRejectableCrossSiteRequest } from "./share-request-security.server";

function headersFrom(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("isRejectableCrossSiteRequest - ALLOW", () => {
  it("same-origin programmatic fetch/XHR is allowed", () => {
    const headers = headersFrom({ "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" });
    expect(isRejectableCrossSiteRequest(headers)).toBe(false);
  });

  it("normal same-origin top-level GET navigation (no Origin header, legitimate Fetch Metadata) is allowed", () => {
    const headers = headersFrom({ "sec-fetch-site": "same-origin", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" });
    expect(isRejectableCrossSiteRequest(headers)).toBe(false);
  });

  it("same-origin target=_blank / new-tab navigation is allowed (still same-origin, tab-ness is irrelevant)", () => {
    const headers = headersFrom({ "sec-fetch-site": "same-origin", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" });
    expect(isRejectableCrossSiteRequest(headers)).toBe(false);
  });

  it("direct/typed/bookmarked top-level navigation (Sec-Fetch-Site: none, Mode: navigate) is allowed -- the confirmed real-Preview defect case", () => {
    const headers = headersFrom({ "sec-fetch-site": "none", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" });
    expect(isRejectableCrossSiteRequest(headers)).toBe(false);
  });

  it("Sec-Fetch-Site: none with no Sec-Fetch-Mode present at all is allowed (lenient -- no contradiction to detect)", () => {
    const headers = headersFrom({ "sec-fetch-site": "none" });
    expect(isRejectableCrossSiteRequest(headers)).toBe(false);
  });

  it("no Fetch Metadata support at all (headers entirely absent) is allowed, unchanged from prior behavior", () => {
    const headers = headersFrom({});
    expect(isRejectableCrossSiteRequest(headers)).toBe(false);
  });
});

describe("isRejectableCrossSiteRequest - DENY", () => {
  it("cross-site fetch is rejected", () => {
    const headers = headersFrom({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" });
    expect(isRejectableCrossSiteRequest(headers)).toBe(true);
  });

  it("cross-site top-level navigation (e.g. a link on a foreign site) is rejected", () => {
    const headers = headersFrom({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" });
    expect(isRejectableCrossSiteRequest(headers)).toBe(true);
  });

  it("an explicit foreign Sec-Fetch-Site value is rejected regardless of case", () => {
    const headers = headersFrom({ "sec-fetch-site": "Cross-Site" });
    expect(isRejectableCrossSiteRequest(headers)).toBe(true);
  });

  it("same-site (different subdomain, same registrable domain) is rejected -- deliberately not widened beyond the existing same-origin-only model", () => {
    const headers = headersFrom({ "sec-fetch-site": "same-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" });
    expect(isRejectableCrossSiteRequest(headers)).toBe(true);
  });

  it("malformed/contradictory metadata (site: none paired with a non-navigate mode) is rejected", () => {
    const headers = headersFrom({ "sec-fetch-site": "none", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" });
    expect(isRejectableCrossSiteRequest(headers)).toBe(true);
  });

  it("an unrecognized/garbage Sec-Fetch-Site value is rejected (fail closed)", () => {
    const headers = headersFrom({ "sec-fetch-site": "totally-not-a-real-value" });
    expect(isRejectableCrossSiteRequest(headers)).toBe(true);
  });
});
