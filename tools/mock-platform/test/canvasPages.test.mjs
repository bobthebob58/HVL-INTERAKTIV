/**
 * Tests for the mock Canvas's browser pages: course page, login-initiation frame, Platform Storage frame and demo
 * launches.
 *
 * Spec: LTI-003, LTI-001, LTI-005
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import vm from 'node:vm';
import { COURSE_SCRIPT } from '../canvasPages.mjs';
import { CANVAS_USERS, MESSAGE_TYPE, STORAGE_TARGET, startMockCanvas } from '../mockPlatform.mjs';

const TOOL = 'http://localhost:3999';
let canvas;

beforeAll(async () => {
  canvas = await startMockCanvas({ toolUrl: TOOL });
});
afterAll(() => canvas.close());

const page = async (url) => {
  const response = await fetch(url, { redirect: 'manual' });
  return { status: response.status, location: response.headers.get('location'), html: await response.text() };
};
const scriptData = (html, id) =>
  JSON.parse(new RegExp(`id="${id}">(.*?)</script>`, 's').exec(html)?.[1] ?? 'null');
const formFields = (html) =>
  Object.fromEntries([...html.matchAll(/name="([^"]+)" value="([^"]*)"/g)].map((m) => [m[1], m[2]]));

describe('[LTI-003] mock Canvas course page', () => {
  it('[LTI-003] frames the tool from another site, with the storage frame only for Platform Storage', async () => {
    // Arrange
    const plainUrl = canvas.coursePageUrl({
      user: CANVAS_USERS.student,
      course: { id: 'c 1', title: 'Kurs <1>' },
    });
    const storedUrl = canvas.coursePageUrl({ user: CANVAS_USERS.student, platformStorage: true });
    // Act
    const [plain, stored] = [await page(plainUrl), await page(storedUrl)];
    // Assert
    expect(plainUrl).toMatch(new RegExp(`^${canvas.origin}/courses/c%201/launches/[\\da-f-]{36}$`));
    expect(plain.html).toContain('<iframe class="tool" id="tool_content" name="tool_content"');
    expect(plain.html).toContain('<h1>Kurs &lt;1&gt;</h1>');
    expect(scriptData(plain.html, 'mock-course-launch')).toEqual({
      frameSrc: `${new URL(plainUrl).pathname}/frame`,
      storageTarget: null,
    });
    expect(scriptData(stored.html, 'mock-course-launch').storageTarget).toBe(STORAGE_TARGET);
    expect(new URL(canvas.origin).hostname).not.toBe(new URL(TOOL).hostname);
  });

  it('[LTI-001] posts a fresh login initiation to <toolUrl>/lti/login on every load of the frame', async () => {
    // Arrange
    const frameUrl = `${canvas.coursePageUrl({ user: CANVAS_USERS.teacher, platformStorage: true })}/frame`;
    // Act
    const [first, second] = [await page(frameUrl), await page(frameUrl)];
    // Assert
    expect(first.html).toContain(`method="post" action="${TOOL}/lti/login"`);
    expect(formFields(first.html)).toMatchObject({
      iss: canvas.issuer,
      client_id: canvas.clientId,
      login_hint: CANVAS_USERS.teacher.sub,
      target_link_uri: `${TOOL}/lti/launch`,
      lti_deployment_id: canvas.deploymentId,
      lti_storage_target: STORAGE_TARGET,
    });
    expect(formFields(second.html).lti_message_hint).not.toBe(formFields(first.html).lti_message_hint);
  });

  it('[LTI-003] starts the tool frame only after the storage frame has loaded, or at once without one', () => {
    // Arrange: the course script in a sandbox with a minimal DOM
    const run = (storageTarget) => {
      const tool = { src: '' };
      const created = [];
      const config = { textContent: JSON.stringify({ frameSrc: '/frame', storageTarget }) };
      const newFrame = () => {
        const frame = { addEventListener: (type, listener) => type === 'load' && (frame.load = listener) };
        return frame;
      };
      const document = {
        getElementById: (id) => ({ 'mock-course-launch': config, tool_content: tool })[id],
        createElement: newFrame,
        body: { appendChild: (frame) => created.push(frame) },
      };
      vm.runInNewContext(COURSE_SCRIPT, { document });
      return { tool, created };
    };
    // Act
    const plain = run(null);
    const stored = run(STORAGE_TARGET);
    const before = stored.tool.src;
    stored.created[0].load();
    // Assert
    expect([plain.tool.src, plain.created.length]).toEqual(['/frame', 0]);
    expect(stored.created[0]).toMatchObject({
      name: STORAGE_TARGET,
      hidden: true,
      src: '/post_message_forwarding',
    });
    expect([before, stored.tool.src]).toEqual(['', '/frame']);
  });

  it('[LTI-003] serves the storage frame with the tool origin as its only partner', async () => {
    const frame = await page(`${canvas.origin}/post_message_forwarding`);
    expect(scriptData(frame.html, 'mock-storage-config')).toEqual({
      toolOrigin: TOOL,
      frameName: STORAGE_TARGET,
    });
    expect(frame.html).toContain("window.addEventListener('message'");
  });

  it('[LTI-003] answers 404 for an unknown launch or a launch under another course', async () => {
    const url = new URL(canvas.coursePageUrl({ course: { id: 'right' } }));
    const elsewhere = `${canvas.origin}${url.pathname.replace('/right/', '/wrong/')}`;
    const statuses = [await page(`${canvas.origin}/courses/right/launches/nope`), await page(elsewhere)];
    expect(statuses.map((result) => result.status)).toEqual([404, 404]);
  });
});

describe('[LTI-005] mock Canvas home page and demo launches', () => {
  it('[LTI-005] offers the resource link and the three Deep Linking placements', async () => {
    const home = await page(`${canvas.origin}/`);
    for (const kind of ['resource', 'link_selection', 'assignment_selection', 'editor_button']) {
      expect(home.html).toContain(`<option value="${kind}">`);
    }
    expect(home.html).toContain(`deployment <code>${canvas.deploymentId}</code>`);
  });

  it('[LTI-005] opens a Deep Linking launch for a teacher with the placement and the feide_login field', async () => {
    // Act
    const demo = await page(`${canvas.origin}/demo/launch?kind=assignment_selection&user=teacher`);
    const frame = await page(`${demo.location}/frame`);
    const login = formFields(frame.html);
    const result = await canvas.authorize({
      ...login,
      redirect_uri: login.target_link_uri,
      response_type: 'id_token',
      response_mode: 'form_post',
      scope: 'openid',
      prompt: 'none',
      nonce: 'n',
      state: 's',
    });
    // Assert
    expect(demo.status).toBe(302);
    const claims = JSON.parse(Buffer.from(result.idToken.split('.')[1], 'base64url').toString('utf8'));
    expect(claims).toMatchObject({
      sub: CANVAS_USERS.teacher.sub,
      'https://purl.imsglobal.org/spec/lti/claim/message_type': MESSAGE_TYPE.deepLinking,
      'https://www.instructure.com/placement': 'assignment_selection',
      'https://purl.imsglobal.org/spec/lti/claim/custom': {
        feide_login: 'author@hvl.no',
        hvl_placement: 'assignment_selection',
      },
    });
  });

  it('[LTI-005] refuses an unknown demo kind, and launches an unknown or inherited user name as the student', async () => {
    // Act
    const unknownKind = await page(`${canvas.origin}/demo/launch?kind=course_navigation`);
    const inherited = await page(`${canvas.origin}/demo/launch?kind=resource&user=__proto__`);
    const frame = await page(`${inherited.location}/frame`);
    // Assert
    expect([unknownKind.status, inherited.status]).toEqual([404, 302]);
    expect(formFields(frame.html).login_hint).toBe(CANVAS_USERS.student.sub);
  });
});
