/**
 * playerPages — reads the pages of an LTI launch as a browser would: the mock Canvas's self-posting forms, ltijs's
 * embedded login data, the scripts and stylesheets a page names, and what the player page tells H5P (the activity,
 * its version, its questions and the learner-state URL).
 *
 * Why: NFR-001's load must drive the real launch and the real player page (D-114's load amendment of 2026-11-05).
 *      k6 runs no browser, so the virtual user reads each page's markup itself; these readers are pure so the same
 *      code is tested in Node against the real mock Canvas and the real tool (tools/load/test/).
 * Spec: NFR-001
 * Invariants:
 *   - Pure: no k6 module, no I/O; never throws on markup it does not expect (it returns undefined or an empty list).
 *   - Only same-origin paths (`/…`, not `//…`) are returned as assets: the player's scripts and styles come from the
 *     tool, and content files from the files origin are not part of becoming interactive (D-114).
 *   - SECURITY: the state URL keeps H5P's own query (with the ltik), as on a real page; nothing here logs it.
 * Collaborators: ./launchSteps.js, ./visit.js, apps/server/src/lti/play/ltiPlayRoutes.ts (the page),
 *   tools/mock-platform/canvasPages.mjs (`autoPostPage`).
 * Tests: tools/load/test/playerPages.test.mjs, tools/load/test/loadBench.test.mjs
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'", apos: "'" };

/**
 * Decodes the entities `escapeHtml` writes into attribute values.
 * @param {string} text - An attribute value as written.
 * @returns {string} The value.
 */
export const decodeEntities = (text) =>
  text.replace(/&(amp|lt|gt|quot|#39|#x27|apos);/g, (_, name) => ENTITIES[name]);

const attribute = (tag, name) => {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return match ? decodeEntities(match[1]) : undefined;
};

/**
 * The first form of a page and its hidden fields, as the mock Canvas's `autoPostPage` writes them.
 * @param {string} html - The page.
 * @returns {{action: string, fields: Record<string, string>} | undefined} The form, or undefined without one.
 */
export function autoPostForm(html) {
  const form = /<form\b[^>]*>/.exec(html ?? '');
  const action = form ? attribute(form[0], 'action') : undefined;
  if (!action) return undefined;
  const fields = {};
  for (const [input] of html.matchAll(/<input\b[^>]*>/g)) {
    const name = attribute(input, 'name');
    if (name !== undefined && attribute(input, 'type') === 'hidden')
      fields[name] = attribute(input, 'value') ?? '';
  }
  return { action, fields };
}

/**
 * The JSON of a `<script type="application/json" id="…">` block.
 * @param {string} html - The page.
 * @param {string} id - The block's ID, e.g. `ltijs-login-data` or `h5p-integration`.
 * @returns {any} The parsed value, or undefined when it is missing or not JSON.
 */
export function embeddedJson(html, id) {
  const match = new RegExp(`<script[^>]*\\sid="${id}"[^>]*>([\\s\\S]*?)</script>`).exec(html ?? '');
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined;
  }
}

/**
 * The same-origin scripts and stylesheets a page names, in page order, each once.
 * @param {string} html - The page.
 * @returns {string[]} Paths such as `/h5p/core/js/h5p.js?version=1.28.0`.
 */
export function pageAssets(html) {
  const found = [];
  for (const [tag] of (html ?? '').matchAll(/<(?:script|link)\b[^>]*>/g)) {
    const path = tag.startsWith('<script') ? attribute(tag, 'src') : stylesheetHref(tag);
    if (path?.startsWith('/') && !path.startsWith('//') && !found.includes(path)) found.push(path);
  }
  return found;
}

const stylesheetHref = (tag) => (attribute(tag, 'rel') === 'stylesheet' ? attribute(tag, 'href') : undefined);

/**
 * H5P's category IRI of a library, as the bridge and the server compare it.
 * @param {string} library - e.g. `H5P.QuestionSet 1.21`.
 * @returns {string} e.g. `http://h5p.org/libraries/H5P.QuestionSet-1.21`.
 */
export const libraryCategory = (library) => `http://h5p.org/libraries/${String(library).replace(' ', '-')}`;

/**
 * What the player page tells H5P and the xAPI bridge about the activity.
 * @param {string} html - The player page.
 * @returns {{contentId: string, contentVersion: number, endpoint: string, category: string,
 *   questions: {subContentId: string, library: string}[], stateUrl: string} | undefined} The activity, its
 *   version, the bridge's endpoint, its main library's category, its questions (with sub-content IDs) and the
 *   learner-state URL of its root (`state`, sub-content `0`); undefined when the page is not a player page.
 */
export function playerContext(html) {
  const integration = embeddedJson(html, 'h5p-integration');
  const bridge = embeddedJson(html, 'hvl-xapi-bridge');
  const content = integration?.contents?.[`cid-${bridge?.contentId}`];
  const template = integration?.ajax?.contentUserData;
  if (!content || typeof template !== 'string' || !Number.isInteger(bridge.contentVersion)) return undefined;
  let params;
  try {
    params = JSON.parse(content.jsonContent);
  } catch {
    return undefined;
  }
  const questions = (Array.isArray(params?.questions) ? params.questions : [])
    .filter((q) => typeof q?.subContentId === 'string' && typeof q?.library === 'string')
    .map((q) => ({ subContentId: q.subContentId, library: q.library }));
  return {
    contentId: bridge.contentId,
    contentVersion: bridge.contentVersion,
    endpoint: bridge.endpoint,
    category: libraryCategory(content.library),
    questions,
    stateUrl: template
      .replace(':contentId', encodeURIComponent(bridge.contentId))
      .replace(':dataType', 'state')
      .replace(':subContentId', '0'),
  };
}
