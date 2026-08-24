import { describe, expect, it } from "vitest";
import { buildStreamedFileResponse } from "./share-file-response.server";

/**
 * PHASE 4 SPIKE PROOF (not part of the shipped Phase 4 feature). Proves,
 * locally and without any network/Supabase dependency, that
 * `buildStreamedFileResponse` passes a `ReadableStream` through to the
 * `Response` body byte-for-byte with no buffering, truncation, or
 * mutation on our side -- the part of the "does streaming survive a
 * ~10MB file" question that is actually within this codebase's control.
 *
 * This does NOT prove Vercel's platform-level response-size behavior for
 * a deployed Function -- only a real Preview/production deployment can
 * prove that. See the Phase 4 spike report's "near-10MB result" section
 * for the explicit statement of what remains unproven.
 */

function buildSyntheticStream(totalBytes: number, chunkSize = 256 * 1024): {
  stream: ReadableStream<Uint8Array>;
  expected: Uint8Array;
} {
  const expected = new Uint8Array(totalBytes);
  for (let i = 0; i < totalBytes; i++) {
    expected[i] = i % 256;
  }

  // Enqueues every chunk synchronously in `start` rather than lazily in
  // `pull` -- still a genuinely multi-chunk stream (proving the
  // Response/reader path handles more than one chunk), but avoids
  // relying on this environment's pull-based backpressure signaling,
  // which is not what this proof is trying to test.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let offset = 0;
      while (offset < totalBytes) {
        const end = Math.min(offset + chunkSize, totalBytes);
        controller.enqueue(expected.slice(offset, end));
        offset = end;
      }
      controller.close();
    },
  });

  return { stream, expected };
}

async function readAllBytes(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response has no readable body");

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }

  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

describe("buildStreamedFileResponse -- local streaming-integrity proof", () => {
  it("passes a small (64KB) stream through byte-for-byte", async () => {
    const { stream, expected } = buildSyntheticStream(64 * 1024);
    const response = buildStreamedFileResponse({
      stream,
      mimeType: "application/pdf",
      contentLength: expected.byteLength,
      contentDisposition: "inline",
    });

    const actual = await readAllBytes(response);
    expect(actual.byteLength).toBe(expected.byteLength);
    expect(actual).toEqual(expected);
  });

  it("passes a multi-chunk (2MB) stream through byte-for-byte with no truncation on our side", async () => {
    // NOTE: a ~9.5MB variant of this same assertion was also run, but not
    // kept in this suite -- reading a many-chunk stream back via
    // response.body.getReader() exhibited severe (30s+) slowdown/hang
    // specific to this Vitest/vite-node environment that did not
    // reproduce when the identical logic was run via plain `node`
    // (12.62ms build+enqueue, 34.05ms Response construction, 0.69ms
    // read-back, 38 chunks, exactly 9,961,472 bytes, verified
    // byte-for-byte). See the Phase 4 spike report's "near-10MB result"
    // section for the full, honest accounting of what this does and does
    // not prove.
    const TWO_MB = 2 * 1024 * 1024;
    const { stream, expected } = buildSyntheticStream(TWO_MB);

    const response = buildStreamedFileResponse({
      stream,
      mimeType: "application/pdf",
      contentLength: expected.byteLength,
      contentDisposition: 'attachment; filename="report.pdf"',
    });

    const actual = await readAllBytes(response);
    expect(actual.byteLength).toBe(expected.byteLength);
    expect(actual).toEqual(expected);
  }, 15000);

  it("sets Content-Length, Content-Type, and Content-Disposition exactly as given", async () => {
    const { stream } = buildSyntheticStream(1024);
    const response = buildStreamedFileResponse({
      stream,
      mimeType: "image/png",
      contentLength: 1024,
      contentDisposition: "inline",
    });

    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Content-Length")).toBe("1024");
    expect(response.headers.get("Content-Disposition")).toBe("inline");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toBe("sandbox; frame-ancestors 'none'");
  });
});
