/**
 * canvasPages — the mock Canvas's browser pages: a home page with demo launches, a course page that frames the tool
 * cross-site (with the Platform Storage frame beside it), and the frame page that starts the LTI login.
 *
 * Why: the LTI-003 end-to-end test runs the real browser flow. The course page is served from
 *      `http://127.0.0.1:<port>` and frames the tool on `http://localhost:<port>`, another site, so the tool's frame
 *      is third-party exactly as inside Canvas, and its login form is posted from the platform's frame as Canvas does.
 * Spec: LTI-003, LTI-001, LTI-005
 * Invariants:
 *   - Every load of a course page's frame starts a fresh third-party-initiated login (a new `lti_message_hint`),
 *     so reloading the course page relaunches the tool, as in Canvas.
 *   - With Platform Storage the tool frame gets its `src` only after the storage frame has loaded, so ltijs never
 *     posts to a frame that is not listening yet.
 *   - Every value placed in HTML is escaped; data for scripts goes through `jsonForScript`.
 * Collaborators: ./mockCanvas.mjs, ./platformStorageFrame.mjs, ./ltiVocabulary.mjs, ./httpRouter.mjs.
 * Tests: tools/mock-platform/test/canvasPages.test.mjs
 */
import { randomUUID } from 'node:crypto';
import { escapeHtml, htmlDocument, jsonForScript, redirect, sendHtml } from './httpRouter.mjs';
import { CANVAS_USERS, MESSAGE_TYPE } from './ltiVocabulary.mjs';
import { STORAGE_TARGET, platformStorageFramePage } from './platformStorageFrame.mjs';

/** The demo launches the home page offers: a resource link, or one of the three Deep Linking placements. */
export const DEMO_KINDS = Object.freeze([
  'resource',
  'link_selection',
  'assignment_selection',
  'editor_button',
]);
const HEADER = '<header>Mock Canvas</header>';

/**
 * A page that posts hidden fields to `action` as soon as it loads (login initiation, `form_post`).
 * @param {string} title - The page title.
 * @param {string} action - The form's target URL.
 * @param {Record<string, string | undefined>} fields - Fields; undefined ones are left out.
 * @returns {string} The document.
 */
export function autoPostPage(title, action, fields) {
  const inputs = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
    .join('');
  return htmlDocument(
    title,
    `<form id="mock-auto-post" method="post" action="${escapeHtml(action)}">${inputs}` +
      '<noscript><button type="submit">Continue</button></noscript></form>' +
      "<script>document.getElementById('mock-auto-post').submit();</script>",
  );
}

/**
 * The page for a refused authentication request.
 * @param {{error: string, error_description: string}} refusal - From `canvas.authorize`.
 * @returns {string} The document.
 */
export const refusalPage = (refusal) =>
  htmlDocument(
    'Mock Canvas · launch refused',
    `${HEADER}<main><h1 id="mock-error">${escapeHtml(refusal.error)}</h1>` +
      `<p>${escapeHtml(refusal.error_description)}</p></main>`,
  );

/** The course page's script: it starts the tool frame, once the Platform Storage frame (if any) has loaded. */
export const COURSE_SCRIPT = `(function () {
  var data = JSON.parse(document.getElementById('mock-course-launch').textContent);
  var tool = document.getElementById('tool_content');
  var start = function () { tool.src = data.frameSrc; };
  if (!data.storageTarget) return start();
  var storage = document.createElement('iframe');
  storage.name = data.storageTarget;
  storage.title = 'Platform Storage';
  storage.hidden = true;
  storage.addEventListener('load', start, { once: true });
  storage.src = '/post_message_forwarding';
  document.body.appendChild(storage);
})();`;

const coursePage = (launch, frameSrc) =>
  htmlDocument(
    `Mock Canvas · ${launch.course.title}`,
    `${HEADER}<main><h1>${escapeHtml(launch.course.title)}</h1>` +
      '<iframe class="tool" id="tool_content" name="tool_content" title="HVL Interaktiv"></iframe></main>' +
      `<script type="application/json" id="mock-course-launch">${jsonForScript({
        frameSrc,
        storageTarget: launch.platformStorage ? STORAGE_TARGET : null,
      })}</script><script>${COURSE_SCRIPT}</script>`,
  );

const option = (value) => `<option value="${value}">${value}</option>`;
const homePage = (canvas) =>
  htmlDocument(
    'Mock Canvas',
    `${HEADER}<main><h1>Mock Canvas for HVL Interaktiv</h1>` +
      `<p>Tool <code>${escapeHtml(canvas.toolUrl)}</code>, issuer <code>${escapeHtml(canvas.issuer)}</code>, ` +
      `client ID <code>${escapeHtml(canvas.clientId)}</code>, deployment <code>${escapeHtml(canvas.deploymentId)}</code>.</p>` +
      '<form method="get" action="/demo/launch">' +
      `<p><label>Launch <select name="kind">${DEMO_KINDS.map(option).join('')}</select></label> ` +
      `<label>as <select name="user">${Object.keys(CANVAS_USERS).map(option).join('')}</select></label></p>` +
      '<p><label>contentId (resource links) <input name="contentId"></label></p>' +
      '<p><label><input type="checkbox" name="platformStorage" value="on"> send lti_storage_target</label></p>' +
      '<p><button type="submit">Open the course page</button></p></form></main>',
  );

/** The launch spec of a demo launch chosen on the home page, or undefined for an unknown kind. */
function demoSpec(query) {
  const kind = query.get('kind') ?? 'resource';
  if (!DEMO_KINDS.includes(kind)) return undefined;
  const contentId = query.get('contentId') ?? '';
  const deepLinking = kind !== 'resource';
  const user = query.get('user') ?? 'student';
  return {
    messageType: deepLinking ? MESSAGE_TYPE.deepLinking : MESSAGE_TYPE.resourceLink,
    // WHY: `hasOwn`, so `user=__proto__` or `user=constructor` cannot pick an inherited value.
    user: Object.hasOwn(CANVAS_USERS, user) ? CANVAS_USERS[user] : CANVAS_USERS.student,
    placement: deepLinking ? kind : undefined,
    custom: deepLinking ? { feide_login: '$Canvas.user.loginId', hvl_placement: kind } : { contentId },
    resourceLinkId: contentId === '' ? undefined : `mock-link-${contentId}`,
    platformStorage: query.get('platformStorage') === 'on',
  };
}

/**
 * Creates the course pages of one mock Canvas.
 * @param {object} canvas - The mock Canvas (`toolUrl`, `origin`, `loginInitiation`).
 * @param {(spec: object) => object} normalise - Fills in a launch spec's defaults.
 * @returns {{urlFor: (spec: object) => string, register: (router: {add: Function}) => void}} `urlFor` stores a
 *   launch and returns its course page URL; `register` adds the page routes.
 */
export function createCanvasPages(canvas, normalise) {
  const launches = new Map();
  const urlFor = (spec) => {
    const launch = normalise(spec);
    const id = randomUUID();
    launches.set(id, launch);
    return `${canvas.origin}/courses/${encodeURIComponent(launch.course.id)}/launches/${id}`;
  };
  const find = ({ course, launchId }) => {
    const launch = launches.get(launchId);
    return launch?.course.id === course ? launch : undefined;
  };
  const notFound = (res) =>
    sendHtml(res, 404, refusalPage({ error: 'not_found', error_description: 'No such launch' }));
  const register = (router) => {
    router.add('GET', '/', (_req, res) => sendHtml(res, 200, homePage(canvas)));
    router.add('GET', '/demo/launch', (_req, res, { query }) => {
      const spec = demoSpec(query);
      if (!spec) return notFound(res);
      redirect(res, urlFor(spec));
    });
    router.add('GET', '/courses/:course/launches/:launchId', (_req, res, { params }) => {
      const launch = find(params);
      if (!launch) return notFound(res);
      const frame = `/courses/${encodeURIComponent(params.course)}/launches/${encodeURIComponent(params.launchId)}/frame`;
      sendHtml(res, 200, coursePage(launch, frame));
    });
    router.add('GET', '/courses/:course/launches/:launchId/frame', (_req, res, { params }) => {
      const launch = find(params);
      if (!launch) return notFound(res);
      const fields = canvas.loginInitiation(launch);
      sendHtml(res, 200, autoPostPage('Mock Canvas · launching', `${canvas.toolUrl}/lti/login`, fields));
    });
    router.add('GET', '/post_message_forwarding', (_req, res) =>
      sendHtml(res, 200, platformStorageFramePage(new URL(canvas.toolUrl).origin)),
    );
  };
  return { urlFor, register };
}
