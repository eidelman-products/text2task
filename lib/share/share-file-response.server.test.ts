import { describe, expect, it } from "vitest";
import {
  buildContentDisposition,
  classifyMimeForInlineDelivery,
  resolveContentDisposition,
  SHARE_FILE_RESPONSE_SECURITY_HEADERS,
} from "./share-file-response.server";

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const NUL = String.fromCharCode(0);
const DEL = String.fromCharCode(127);

describe("buildContentDisposition", () => {
  it("returns a bare 'inline' with no filename when canDownload is false", () => {
    expect(
      buildContentDisposition({ publicLabel: "Project Brief", canDownload: false, extension: "pdf" })
    ).toBe("inline");
  });

  it("builds an attachment header with both filename= and filename*= for a normal label", () => {
    const header = buildContentDisposition({
      publicLabel: "Project Brief",
      canDownload: true,
      extension: "pdf",
    });
    expect(header).toContain('attachment; filename="Project Brief.pdf"');
    expect(header).toContain("filename*=UTF-8''Project%20Brief.pdf");
  });

  it("strips double quotes so they cannot break out of the quoted filename", () => {
    const header = buildContentDisposition({
      publicLabel: 'evil"; x-injected="1',
      canDownload: true,
      extension: "txt",
    });
    expect(header).not.toContain('""');
    expect(header.split('"').length - 1).toBe(2); // exactly one open/close quote pair
  });

  it("strips CR and LF so no combination of input can inject a second header", () => {
    const header = buildContentDisposition({
      publicLabel: `evil${CR}${LF}X-Injected: 1`,
      canDownload: true,
      extension: "txt",
    });
    expect(header.includes(CR)).toBe(false);
    expect(header.includes(LF)).toBe(false);
  });

  it("strips other control characters (NUL, DEL)", () => {
    const header = buildContentDisposition({
      publicLabel: `a${NUL}b${DEL}c`,
      canDownload: true,
      extension: "txt",
    });
    expect(header.includes(NUL)).toBe(false);
    expect(header.includes(DEL)).toBe(false);
  });

  it("replaces slashes and backslashes so no path traversal segment survives", () => {
    const header = buildContentDisposition({
      publicLabel: "../../etc/passwd",
      canDownload: true,
      extension: null,
    });
    expect(header).not.toContain("/");
    expect(header).not.toContain("\\");
  });

  it("falls back to a safe default name when the label is empty or entirely stripped", () => {
    const header = buildContentDisposition({ publicLabel: "", canDownload: true, extension: "pdf" });
    expect(header).toContain('filename="attachment.pdf"');

    const onlyControlChars = buildContentDisposition({
      publicLabel: `${CR}${LF}${NUL}`,
      canDownload: true,
      extension: "pdf",
    });
    expect(onlyControlChars).toContain('filename="attachment.pdf"');
  });

  it("truncates very long labels", () => {
    const longLabel = "x".repeat(500);
    const header = buildContentDisposition({ publicLabel: longLabel, canDownload: true, extension: "txt" });
    const match = header.match(/filename="([^"]*)"/);
    expect(match).not.toBeNull();
    expect((match as RegExpMatchArray)[1].length).toBeLessThanOrEqual(104); // 100 + ".txt"
  });

  it("preserves unicode via filename*=UTF-8'' and gives an ASCII-safe filename= fallback", () => {
    const header = buildContentDisposition({
      publicLabel: "Café Résumé 日本語",
      canDownload: true,
      extension: "pdf",
    });
    expect(header).toMatch(/filename="[\x20-\x7e]*"/);
    expect(header).toContain("filename*=UTF-8''");
    expect(decodeURIComponent(header.split("filename*=UTF-8''")[1])).toBe("Café Résumé 日本語.pdf");
  });

  it("rejects an unsafe/overlong extension rather than embedding it verbatim", () => {
    const header = buildContentDisposition({
      publicLabel: "report",
      canDownload: true,
      extension: '"; x=1',
    });
    expect(header).toBe('attachment; filename="report"; filename*=UTF-8\'\'report');
  });

  it("never includes the internal file_name -- the function has no such parameter", () => {
    expect(buildContentDisposition.length).toBe(1); // single { publicLabel, canDownload, extension } input
  });
});

describe("classifyMimeForInlineDelivery", () => {
  it("classifies every currently-allowed image and text/pdf type as inline-safe", () => {
    for (const mime of [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
      "application/pdf",
      "text/plain",
      "text/csv",
    ]) {
      expect(classifyMimeForInlineDelivery(mime)).toBe("inline-safe");
    }
  });

  it("classifies Word/Excel types (no native browser viewer) as forced-attachment", () => {
    for (const mime of [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]) {
      expect(classifyMimeForInlineDelivery(mime)).toBe("forced-attachment");
    }
  });

  it("classifies any unrecognized/active-content type as forced-attachment (fail safe)", () => {
    for (const mime of ["text/html", "image/svg+xml", "application/xml", "application/javascript"]) {
      expect(classifyMimeForInlineDelivery(mime)).toBe("forced-attachment");
    }
  });
});

describe("resolveContentDisposition", () => {
  it("honors canDownload=false for an inline-safe type", () => {
    expect(
      resolveContentDisposition({
        mimeType: "image/png",
        canDownload: false,
        publicLabel: "Logo",
        extension: "png",
      })
    ).toBe("inline");
  });

  it("forces attachment for a Word doc even when canDownload is false", () => {
    const header = resolveContentDisposition({
      mimeType: "application/msword",
      canDownload: false,
      publicLabel: "Contract",
      extension: "doc",
    });
    expect(header).toContain("attachment");
  });

  it("forces attachment for an unrecognized/active-content type even when canDownload is false", () => {
    const header = resolveContentDisposition({
      mimeType: "text/html",
      canDownload: false,
      publicLabel: "Notes",
      extension: "html",
    });
    expect(header).toContain("attachment");
  });
});

describe("SHARE_FILE_RESPONSE_SECURITY_HEADERS", () => {
  it("always includes nosniff, a sandboxed CSP, and no-store caching", () => {
    expect(SHARE_FILE_RESPONSE_SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SHARE_FILE_RESPONSE_SECURITY_HEADERS["Content-Security-Policy"]).toBe("sandbox");
    expect(SHARE_FILE_RESPONSE_SECURITY_HEADERS["Cache-Control"]).toContain("no-store");
  });
});
