import "server-only";

/**
 * PHASE 4B DEFECT #1 FIX -- shared same-origin/cross-site defense-in-depth
 * for every public Client Share GET route (`/projection`,
 * `/resources/[fileRef]`, and any future sibling). Extracted from two
 * previously-duplicated, identically-buggy private `isCrossSiteFetch`
 * copies (one per route file) into one place so the fix lives in exactly
 * one location and cannot silently re-diverge between routes again.
 *
 * This is defense-in-depth only, never the primary authorization
 * boundary -- every caller of this module still independently requires
 * the full session/grant/link/configuration_version/fileRef chain
 * (verifyShareProjectionAuthorization, matchShareFileRef, etc.) on every
 * request. A non-browser client can trivially forge any Fetch Metadata
 * header it wants (these headers are a browser-cooperation signal, not a
 * cryptographic proof), so this check exists purely to reject the class
 * of request a COMPLIANT browser would only ever send as a result of a
 * genuinely cross-site page -- it narrows the field for a browser-borne
 * attack, it does not replace real authorization.
 *
 * ROOT CAUSE OF THE DEFECT THIS FILE FIXES: the two previous copies
 * rejected whenever `Sec-Fetch-Site` was PRESENT and not exactly
 * `"same-origin"`. That correctly handles a same-origin `fetch()` call
 * from the loaded share page, and correctly *intended* to also accept a
 * direct top-level navigation (per its own comment: "A missing
 * Sec-Fetch-Site ... is accepted") -- but a direct top-level navigation
 * in any modern Fetch-Metadata-supporting browser (typing/pasting the
 * URL into the address bar, following a bookmark, or any other
 * browser-generated request with no initiating page) does NOT omit the
 * header; it sends `Sec-Fetch-Site: none` explicitly (MDN: "The user
 * agent's user explicitly caused the request, e.g. by typing a URL into
 * the browser's address bar, clicking a bookmark, or via drag and
 * drop"). The old check treated that legitimate `"none"` value exactly
 * like a foreign `"cross-site"` value and rejected it -- confirmed
 * directly against a real disposable Preview: opening
 * `/api/share/[publicId]/resources/[fileRef]` directly in the browser
 * (the file route's own primary intended use case) returned
 * `INVALID_ORIGIN` every time, before authorization was ever reached.
 */

/**
 * True only for the specific request shapes a genuinely cross-site page
 * would produce against a compliant browser -- never for a same-origin
 * `fetch()`, a same-origin link/navigation (`target="_blank"` or not),
 * or a direct/typed/bookmarked top-level navigation with no initiating
 * page at all.
 *
 * Accepts:
 *  - `Sec-Fetch-Site` absent entirely (older browsers, some webviews --
 *    unchanged from the original behavior).
 *  - `Sec-Fetch-Site: same-origin` (a fetch/XHR or navigation initiated
 *    by this exact origin's own already-loaded page).
 *  - `Sec-Fetch-Site: none`, PROVIDED `Sec-Fetch-Mode` is either absent
 *    or exactly `"navigate"` -- the shape a direct/typed/bookmarked
 *    top-level GET navigation always has. A browser never sends
 *    `site: none` together with a non-`navigate` mode (that pairing
 *    only means the two headers were set by something other than a
 *    real browser's own navigation machinery), so that specific
 *    combination is treated as contradictory and rejected rather than
 *    silently trusted.
 *
 * Rejects everything else, including `same-site` (deliberately not
 * widened beyond what this app's existing single-origin security model
 * already relies on) and `cross-site`.
 */
export function isRejectableCrossSiteRequest(headers: Headers): boolean {
  const secFetchSite = headers.get("sec-fetch-site");

  if (secFetchSite === null) {
    return false;
  }

  const site = secFetchSite.toLowerCase();

  if (site === "same-origin") {
    return false;
  }

  if (site === "none") {
    const secFetchMode = headers.get("sec-fetch-mode");
    if (secFetchMode === null) {
      return false;
    }
    return secFetchMode.toLowerCase() !== "navigate";
  }

  // "same-site", "cross-site", or any unrecognized value.
  return true;
}
