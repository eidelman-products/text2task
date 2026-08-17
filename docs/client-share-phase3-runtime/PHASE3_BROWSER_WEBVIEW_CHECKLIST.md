# Phase 3 — Browser / Webview Manual Acceptance Checklist

Manual acceptance only. Nothing in this file is automated, and nothing in
this file was executed by the agent that produced it. Run this against an
actual running environment (a real deploy, or `next dev`/`next start`
locally with `TEXT2TASK_CLIENT_SHARE_ENABLED` deliberately turned on in
that environment only) with a real activated Client Share link. Do not
run this against the Production Text2Task project unless the feature flag
has already been separately, explicitly authorized to be enabled there.

For each environment in the matrix below, work through all 16 proof
points and record Pass/Fail/Notes. A proof point that cannot be observed
in a given webview (e.g. it has no visible address bar) should be marked
N/A with a one-line reason, not left blank.

## Environments

**Desktop**
- [ ] Chrome (latest)
- [ ] Edge (latest)

**Mobile**
- [ ] A normal mobile browser (iOS Safari or Android Chrome, either is
      fine as the "normal browser" row)
- [ ] WhatsApp in-app browser (open the share link from a WhatsApp chat)
- [ ] Instagram in-app browser (open the share link from an Instagram DM
      or bio link)
- [ ] iOS Safari specifically (if the "normal browser" row above used
      Android, add this row; skip if redundant)
- [ ] Android Chrome / Android WebView specifically (if the "normal
      browser" row above used iOS, add this row; skip if redundant)

## The 16 proof points

For each environment, open a fresh activated share link
(`https://<host>/share/<publicId>#<secret>`) in a private/incognito
session (or clear the `t2t_client_share_session` cookie first) so the
exchange flow genuinely runs, then work through:

1. **Fragment present initially.** Immediately after tapping/clicking the
   link (before the page finishes loading), confirm the address bar (or
   share-sheet preview, where visible) shows the `#secret` fragment as
   part of the URL you were given.
2. **Server never receives the fragment.** Using the browser's/webview's
   network inspector where available (desktop DevTools; for mobile
   webviews, use a remote-debugging session — e.g. `chrome://inspect` for
   Android Chrome/WebView, Safari's Web Inspector for iOS), confirm the
   very first HTTP request line for `/share/<publicId>` never contains
   `#secret` (fragments are never sent to a server by any browser, but
   this step exists to physically prove it for this exact page rather
   than assume it), and that the exchange call
   (`POST /api/share/session`) is the only place the secret ever appears,
   in the request BODY, never the URL.
3. **Fragment disappears promptly.** Within a moment of the page
   settling, confirm the visible address bar reads `/share/<publicId>`
   with no `#secret` — via `history.replaceState`, not a redirect/reload.
4. **Project loads after exchange.** Confirm the shared project view
   (title, tasks/resources/update, per the Phase 2D `ClientProjectView`)
   renders after the exchange completes.
5. **Clean-URL refresh works.** Reload the now-clean `/share/<publicId>`
   URL (no fragment) and confirm the project loads again without
   requiring the original link/fragment — proving the HttpOnly session +
   grant alone carry authorization.
6. **PIN flow works** (only for a PIN-protected test link). Confirm the
   PIN prompt appears, and that entering the correct PIN reaches the
   project view.
7. **Wrong-PIN behaviour.** Enter an incorrect PIN and confirm a generic
   "incorrect PIN" message appears, the project view does NOT render, and
   the PIN form remains available to retry (the secret was retained
   silently — no need to reopen the original link).
8. **Temporary PIN rate limit.** Enter an incorrect PIN 5 times total in
   under 5 minutes on the same link (a fresh disposable PIN-protected
   test link, not a real client's link) and confirm the 6th attempt shows
   a generic "try again shortly" message rather than another "incorrect
   PIN" message.
9. **Disabled link loses access.** Have the link's owner disable it
   (Phase 2C controls), then reload `/share/<publicId>` (clean URL, using
   the already-authorized browser/session) and confirm the project view
   is no longer reachable (generic unavailable state) — proving read-time
   revalidation, not just the original exchange, enforces link state.
10. **Revoked link loses access.** Same as above, but with revoke instead
    of disable.
11. **Rotated link loses access with the OLD fragment; the NEW link
    works.** Rotate the link's secret, confirm the previously bookmarked
    `#secret` fragment (if retried from scratch) no longer authorizes,
    and confirm the newly issued link does.
12. **Expired link loses access.** Using a test link with a short
    `expires_at` already in the past (or one that expires during the
    test), confirm access is generically unavailable once expired.
13. **No secret in navigation/referrer.** Trigger outbound navigation
    from the shared project view (e.g. any external link it renders, if
    present) and confirm, via the network inspector, that no
    `Referer`/`Referrer-Policy` leak carries the secret or any internal
    identifier — expected because the URL was scrubbed before any such
    navigation could occur, and `Referrer-Policy: no-referrer` is set.
14. **No Clarity/GA/Ads request.** Using the network inspector, confirm
    no request to Microsoft Clarity, Google Analytics/GA4, or Google Ads
    endpoints occurs anywhere on `/share/**`, while separately confirming
    (on an ordinary marketing/dashboard page in the same environment)
    that those requests DO occur there — proving isolation is
    route-scoped, not globally broken.
15. **No stale cached project after revocation.** After proof point 9 or
    10, confirm a hard refresh does not show a stale/cached copy of the
    previously visible project content (expected because every Phase 3
    API response is `Cache-Control: private, no-store`).
16. **Same browser holds grants to two independent links.** Open a second,
    different activated share link in the SAME browser/webview profile
    (without clearing cookies), complete its exchange, then reload the
    FIRST link's clean URL again and confirm it still loads — proving one
    browser session correctly holds concurrent grants for multiple links.

## Recording results

Use one copy of the table below per environment (rename the heading to
the environment under test):

| # | Proof point | Pass / Fail / N/A | Notes |
|---|---|---|---|
| 1 | Fragment present initially | | |
| 2 | Server never receives the fragment | | |
| 3 | Fragment disappears promptly | | |
| 4 | Project loads after exchange | | |
| 5 | Clean-URL refresh works | | |
| 6 | PIN flow works | | |
| 7 | Wrong-PIN behaviour | | |
| 8 | Temporary PIN rate limit | | |
| 9 | Disabled link loses access | | |
| 10 | Revoked link loses access | | |
| 11 | Rotated link: old fragment fails, new link works | | |
| 12 | Expired link loses access | | |
| 13 | No secret in navigation/referrer | | |
| 14 | No Clarity/GA/Ads request | | |
| 15 | No stale cached project after revocation | | |
| 16 | Same browser holds grants to two independent links | | |

## Hard rules

- Never use a real client's project or a real client-facing link for
  these tests — always a disposable test project/link.
- Never paste a real secret fragment, PIN, session cookie value, or
  screenshot containing them into this file, into a chat, or into any
  issue tracker.
- A Fail on any proof point should be reported with the exact environment,
  exact steps, and exact observed behaviour — not silently worked around.
