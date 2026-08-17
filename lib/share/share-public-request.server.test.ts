import { describe, expect, it } from "vitest";

import {
  isSharePublicRequestError,
  readSharePublicRequestJson,
  SHARE_PUBLIC_REQUEST_MAX_BYTES,
  validateSharePublicRequestOrigin,
} from "./share-public-request.server";

const REQUEST_URL = "https://text2task.com/api/share/session";

function headersWith(overrides: Record<string, string>): Headers {
  return new Headers(overrides);
}

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error("expected function to throw");
  } catch (error) {
    expect(isSharePublicRequestError(error)).toBe(true);
    if (isSharePublicRequestError(error)) {
      expect(error.code).toBe(code);
    }
  }
}

describe("validateSharePublicRequestOrigin", () => {
  it("passes when Origin exactly matches the request URL's own origin", () => {
    expect(() =>
      validateSharePublicRequestOrigin({
        requestUrl: REQUEST_URL,
        headers: headersWith({ origin: "https://text2task.com" }),
      })
    ).not.toThrow();
  });

  it("rejects a mismatched Origin", () => {
    expectCode(
      () =>
        validateSharePublicRequestOrigin({
          requestUrl: REQUEST_URL,
          headers: headersWith({ origin: "https://evil.example" }),
        }),
      "invalid_request_origin"
    );
  });

  it("rejects a missing Origin header", () => {
    expectCode(
      () =>
        validateSharePublicRequestOrigin({
          requestUrl: REQUEST_URL,
          headers: headersWith({}),
        }),
      "invalid_request_origin"
    );
  });

  it("rejects the literal 'null' Origin", () => {
    expectCode(
      () =>
        validateSharePublicRequestOrigin({
          requestUrl: REQUEST_URL,
          headers: headersWith({ origin: "null" }),
        }),
      "invalid_request_origin"
    );
  });

  it("accepts a missing Sec-Fetch-Site header -- some legitimate browsers/webviews omit it", () => {
    expect(() =>
      validateSharePublicRequestOrigin({
        requestUrl: REQUEST_URL,
        headers: headersWith({ origin: "https://text2task.com" }),
      })
    ).not.toThrow();
  });

  it("accepts Sec-Fetch-Site: same-origin", () => {
    expect(() =>
      validateSharePublicRequestOrigin({
        requestUrl: REQUEST_URL,
        headers: headersWith({
          origin: "https://text2task.com",
          "sec-fetch-site": "same-origin",
        }),
      })
    ).not.toThrow();
  });

  it("rejects a present Sec-Fetch-Site that is not same-origin", () => {
    expectCode(
      () =>
        validateSharePublicRequestOrigin({
          requestUrl: REQUEST_URL,
          headers: headersWith({
            origin: "https://text2task.com",
            "sec-fetch-site": "cross-site",
          }),
        }),
      "invalid_request_origin"
    );
  });
});

function buildRequest(options: {
  body?: string;
  contentType?: string | null;
  contentEncoding?: string;
  contentLength?: string;
}): Request {
  const headers = new Headers();
  if (options.contentType !== undefined && options.contentType !== null) {
    headers.set("content-type", options.contentType);
  }
  if (options.contentEncoding) {
    headers.set("content-encoding", options.contentEncoding);
  }
  if (options.contentLength) {
    headers.set("content-length", options.contentLength);
  }

  return new Request(REQUEST_URL, {
    method: "POST",
    headers,
    body: options.body,
  });
}

describe("readSharePublicRequestJson", () => {
  it("parses a valid application/json body", async () => {
    const request = buildRequest({
      body: JSON.stringify({ a: 1 }),
      contentType: "application/json",
    });

    await expect(readSharePublicRequestJson(request)).resolves.toEqual({ a: 1 });
  });

  it("accepts application/json; charset=utf-8", async () => {
    const request = buildRequest({
      body: JSON.stringify({ a: 1 }),
      contentType: "application/json; charset=utf-8",
    });

    await expect(readSharePublicRequestJson(request)).resolves.toEqual({ a: 1 });
  });

  it("rejects a missing content-type", async () => {
    const request = buildRequest({ body: "{}", contentType: null });

    await expect(readSharePublicRequestJson(request)).rejects.toMatchObject({
      code: "invalid_request_content_type",
    });
  });

  it("rejects a non-JSON content-type", async () => {
    const request = buildRequest({ body: "{}", contentType: "text/plain" });

    await expect(readSharePublicRequestJson(request)).rejects.toMatchObject({
      code: "invalid_request_content_type",
    });
  });

  it("rejects an unsupported content-encoding", async () => {
    const request = buildRequest({
      body: "{}",
      contentType: "application/json",
      contentEncoding: "gzip",
    });

    await expect(readSharePublicRequestJson(request)).rejects.toMatchObject({
      code: "unsupported_request_encoding",
    });
  });

  it("rejects a Content-Length header claiming a body over the byte limit", async () => {
    const request = buildRequest({
      body: "{}",
      contentType: "application/json",
      contentLength: String(SHARE_PUBLIC_REQUEST_MAX_BYTES + 1),
    });

    await expect(readSharePublicRequestJson(request)).rejects.toMatchObject({
      code: "request_body_too_large",
    });
  });

  it("rejects a body that actually streams over the byte limit, even without a matching Content-Length claim", async () => {
    const oversizedBody = "a".repeat(SHARE_PUBLIC_REQUEST_MAX_BYTES + 1024);
    const request = buildRequest({ body: oversizedBody, contentType: "application/json" });

    await expect(readSharePublicRequestJson(request)).rejects.toMatchObject({
      code: "request_body_too_large",
    });
  });

  it("rejects an empty body", async () => {
    const request = buildRequest({ body: "", contentType: "application/json" });

    await expect(readSharePublicRequestJson(request)).rejects.toMatchObject({
      code: "invalid_request_body",
    });
  });

  it("rejects malformed JSON", async () => {
    const request = buildRequest({ body: "{not valid json", contentType: "application/json" });

    await expect(readSharePublicRequestJson(request)).rejects.toMatchObject({
      code: "invalid_request_body",
    });
  });
});
