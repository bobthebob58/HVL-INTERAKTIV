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
 *   - `style-src` allows inline styles: H5P sets style attributes throughout (D-070).
 *   - `frame-ancestors` is given by the caller: `'self'` for the portal, plus `CANVAS_ORIGINS` for LTI pages.
 * Collaborators: ../h5p/render/coreInlineScripts.ts, ./routes/playerRoutes.ts, ../lti/play/ltiPlayRoutes.ts.
 * Tests: apps/server/test/http/h5pPageCsp.test.ts, apps/server/test/h5p/realTypes.browser.int.test.ts
 */

/** What the policy needs besides the page's framing. */
export interface H5pPageCspSettings {
  /** `'sha256-…'` of H5P Core's inline scripts. */
  readonly scriptHashes: readonly string[];
  /** Origins outside media may come from (`EXTERNAL_MEDIA_ORIGINS`). */
  readonly externalMediaOrigins: readonly string[];
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
  return [
    "default-src 'none'",
    `script-src 'self' ${settings.scriptHashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    withMedia("img-src 'self' data: blob:"),
    withMedia("media-src 'self' blob:"),
    "font-src 'self' data:",
    "connect-src 'self'",
    withMedia("frame-src 'self'"),
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors.length > 0 ? frameAncestors.join(' ') : "'none'"}`,
  ].join('; ');
}
