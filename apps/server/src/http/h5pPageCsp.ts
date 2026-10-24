/**
 * h5pPageCsp — the Content Security Policy of the pages that run H5P: the player (portal and LTI) and, from S4, the
 * editor.
 *
 * Why: H5P renders author-controlled parameters with jQuery, so the page's script policy is the structural defence
 *      against markup that escaping missed (D-039, D-058). DATA-011 forbids third-party requests on student-facing
 *      pages. The policy allows our own files, the hashes of H5P Core's constant inline scripts, and outside media
 *      only from origins HVL configures (`EXTERNAL_MEDIA_ORIGINS`, e.g. Panopto; never YouTube, D-070).
 * Spec: DATA-011, H5P-009, SEC-008, LTI-003
 * Invariants:
 *   - `script-src` never contains `'unsafe-inline'` or `'unsafe-eval'`.
 *   - `script-src` names one outside file, Panopto's embed API (`PANOPTO_EMBED_API_URL`, a path source, not its
 *     whole origin), and only when a configured media origin is a Panopto host (`*.panopto.com`, `*.panopto.eu`);
 *     configured media origins themselves never get script rights (D-070 amendment of 2026-10-24).
 *   - `style-src` allows inline styles: H5P sets style attributes throughout (D-070).
 *   - `font-src` allows `data:`: H5P.DragNBar (CoursePresentation, InteractiveVideo) inlines its icon font as a
 *     data: WOFF; a data: font reaches no other origin.
 *   - `frame-ancestors` is given by the caller: `'self'` for the portal, plus `CANVAS_ORIGINS` for LTI pages.
 *   - `base-uri 'self'`: jQuery's HTML parser adds a `<base>` with the page's own URL to its scratch document,
 *     which `'none'` refuses on every editor field; another origin's base stays refused.
 * SPEC-DEVIATION: D-070 — Panopto's embed API is a third-party script without SRI (H5P-009), allowed only by
 *   configuration.
 * Collaborators: ../h5p/render/coreInlineScripts.ts, ./routes/playerRoutes.ts, ../lti/play/ltiPlayRoutes.ts.
 * Tests: apps/server/test/http/h5pPageCsp.test.ts, apps/server/test/http/h5pPageCsp.browser.int.test.ts,
 *   apps/server/test/h5p/realTypes.browser.int.test.ts
 */

/** What the policy needs besides the page's framing. */
export interface H5pPageCspSettings {
  /** `'sha256-…'` of H5P Core's inline scripts. */
  readonly scriptHashes: readonly string[];
  /** Origins outside media may come from (`EXTERNAL_MEDIA_ORIGINS`). */
  readonly externalMediaOrigins: readonly string[];
}

/**
 * The one file H5P.Video 1.6's Panopto handler loads (`scripts/panopto.js`, `loadAPI`): Panopto's embed API.
 * SECURITY: a CSP path source allows this file only, not every script on `developers.panopto.com`.
 */
export const PANOPTO_EMBED_API_URL = 'https://developers.panopto.com/scripts/v1.2.0/embedapi.min.js';

/** The domains of Panopto's hosted sites; HVL's is a subdomain of one, e.g. `hvl.cloud.panopto.eu`. */
const PANOPTO_DOMAINS = ['panopto.com', 'panopto.eu'];

/**
 * Tells whether a configured media origin is a Panopto site.
 * @param origin - One `EXTERNAL_MEDIA_ORIGINS` entry, e.g. `https://hvl.cloud.panopto.eu`.
 * @returns True for a subdomain of `panopto.com` or `panopto.eu`; false for anything else, e.g. `evilpanopto.com`.
 */
export function isPanoptoOrigin(origin: string): boolean {
  const { hostname } = new URL(origin);
  return PANOPTO_DOMAINS.some((domain) => hostname.endsWith(`.${domain}`));
}

/**
 * Builds the policy.
 * @param settings - Inline-script hashes and allowed media origins.
 * @param frameAncestors - Who may frame the page.
 * @returns The header value.
 */
export function h5pPageCsp(settings: H5pPageCspSettings, frameAncestors: readonly string[]): string {
  const media = settings.externalMediaOrigins.join(' ');
  const withMedia = (sources: string) => (media ? `${sources} ${media}` : sources);
  // SPEC-DEVIATION: D-070 — a third-party script on H5P pages (H5P-009 wants SRI), opt-in by configuration.
  // SECURITY: H5P.Video plays a Panopto source only through Panopto's embed API, which it inserts as a <script src>
  // without integrity; that file is allowed only when HVL lists a Panopto site, never for other media origins.
  const panopto = settings.externalMediaOrigins.some(isPanoptoOrigin) ? [PANOPTO_EMBED_API_URL] : [];
  return [
    "default-src 'none'",
    ["script-src 'self'", ...settings.scriptHashes, ...panopto].join(' '),
    "style-src 'self' 'unsafe-inline'",
    withMedia("img-src 'self' data: blob:"),
    withMedia("media-src 'self' blob:"),
    // WHY: H5P.DragNBar's icon font is a data: WOFF in its stylesheet (D-070 amendment of 2026-10-24).
    "font-src 'self' data:",
    "connect-src 'self'",
    withMedia("frame-src 'self'"),
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors.length > 0 ? frameAncestors.join(' ') : "'none'"}`,
  ].join('; ');
}
