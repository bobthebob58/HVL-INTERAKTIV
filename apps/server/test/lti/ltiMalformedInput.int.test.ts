/**
 * Integration tests that launch input no platform sends is answered as the sender's mistake: a control character
 * in a login field, in the ID token's issuer, in the `sub` or in another claim that is stored gives a 400 page
 * and a warning in the log, never a 500 and an error line. A description on several lines, which a platform may
 * send, still launches.
 *
 * Spec: LTI-001, PROD-012, NFR-006
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';

const NUL = '\u0000';
const LTI = 'https://purl.imsglobal.org/spec/lti/claim/';
const claimsOf = (jwt: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;

describeWithServices('[LTI-001] launch input that no platform sends', () => {
  let tb: AppTestbed;
  let published: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    published = await tb.activity(await tb.staffAccount(), { published: true });
  }, 60_000);
  afterAll(() => tb.close());

  /** The levels of the lines logged since `from`. */
  const levelsSince = (from: number): string[] =>
    tb.logs.slice(from).map((line) => (JSON.parse(line) as { level: string }).level);
  /** A launch whose ID token the platform signed after `change` altered its claims. */
  const launchWith = (change: (claims: Record<string, unknown>) => Record<string, unknown>) =>
    launchFromCanvas(tb.app, tb.mock.canvas, { custom: { contentId: published } }, (token, canvas) =>
      canvas.signIdToken(change(claimsOf(token))),
    );

  it.each([
    'iss',
    'client_id',
    'lti_deployment_id',
    'login_hint',
    'lti_message_hint',
    'target_link_uri',
  ] as const)(
    '[LTI-001] a login whose %s holds a control character is a 400 and no error in the log',
    async (field) => {
      // Arrange
      const login = tb.mock.canvas.loginInitiation({});
      const from = tb.logs.length;
      // Act
      const asForm = await request(tb.app)
        .post('/lti/login')
        .type('form')
        .send({ ...login, [field]: `${login[field]}${NUL}` });
      const asQuery = await request(tb.app)
        .get('/lti/login')
        .query({ ...login, [field]: `${NUL}${login[field]}` });
      // Assert
      expect([asForm.status, asQuery.status]).toEqual([400, 400]);
      expect(asForm.text).toContain('<h1>');
      expect(levelsSince(from)).not.toContain('error');
    },
  );

  it.each([
    ['a zero character in the sub', (c: Record<string, unknown>) => ({ ...c, sub: `learner${NUL}` })],
    [
      'another control character in the sub',
      (c: Record<string, unknown>) => ({ ...c, sub: 'learner\u0007' }),
    ],
    [
      'a zero character in the issuer',
      (c: Record<string, unknown>) => ({ ...c, iss: `${String(c.iss)}${NUL}` }),
    ],
    [
      'a zero character in the deployment ID',
      (c: Record<string, unknown>) => ({ ...c, [`${LTI}deployment_id`]: `1${NUL}` }),
    ],
    [
      'a zero character in the course title',
      (c: Record<string, unknown>) => ({ ...c, [`${LTI}context`]: { id: 'c-1', title: `Kurs${NUL}` } }),
    ],
    [
      'half a surrogate pair in the course title',
      (c: Record<string, unknown>) => ({ ...c, [`${LTI}context`]: { id: 'c-1', title: 'Kurs\ud83d' } }),
    ],
    ['a zero character in the nonce', (c: Record<string, unknown>) => ({ ...c, nonce: `n${NUL}` })],
    [
      'a zero character in a key of a stored claim',
      (c: Record<string, unknown>) => ({
        ...c,
        [`${LTI}context`]: { id: 'c-1', type: [{ [`a${NUL}`]: 1 }] },
      }),
    ],
  ])(
    '[LTI-001] a signed launch with %s is a 400 without an ltik, and no error in the log',
    async (_case, change) => {
      // Arrange
      const from = tb.logs.length;
      const stored = await tb.db.ltiIdToken.count();
      // Act
      const run = await launchWith(change);
      // Assert
      expect(run.res.status).toBe(400);
      expect(run.ltik).toBeUndefined();
      expect(run.res.text).toContain('<h1>');
      expect(levelsSince(from)).not.toContain('error');
      expect(await tb.db.ltiIdToken.count()).toBe(stored);
    },
  );

  it('[LTI-001] a launch whose resource link has a description on several lines still opens the activity', async () => {
    // Act
    const run = await launchWith((claims) => ({
      ...claims,
      [`${LTI}resource_link`]: {
        id: 'link-lines',
        title: 'Brøkar',
        description: 'Første linje\nAndre linje\tmed tabulator',
      },
    }));
    // Assert
    expect(run.res.status).toBe(302);
    expect(run.path).toBe('/lti/play');
  });
});
