/**
 * Integration tests for AUTH-005: a teacher's Canvas identity is linked to their Feide identity at a Deep Linking
 * launch that carries `custom.feide_login`, through the whole app, the mock Canvas and the mock Feide.
 *
 * Spec: AUTH-005, DATA-002
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type CanvasUser } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import { identitySource } from '../../../src/auth/identity/subjectSources.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { loginWithFeide } from '../../support/feideTestbed.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { describeWithServices } from '../../support/services.js';

const FEIDE_LOGIN = { feide_login: '$Canvas.user.loginId' };

describeWithServices('[AUTH-005] Canvas and Feide account linking', () => {
  let tb: AppTestbed;
  let hasher: IdentityHasher;
  beforeAll(async () => {
    tb = await openAppTestbed();
    hasher = new IdentityHasher(tb.env.IDENTITY_HASH_KEYS);
  }, 60_000);
  afterAll(() => tb.close());

  /** A new Feide employee and a Canvas teacher whose login ID is that Feide ID. */
  const person = (canvasLoginId?: string) => {
    const key = `t${randomUUID().slice(0, 8)}`;
    const feide = tb.mock.feide.addUser({ key, affiliations: ['employee', 'staff', 'member'] });
    const canvas: CanvasUser = {
      sub: `canvas-${randomUUID()}`,
      roles: CANVAS_USERS.teacher.roles,
      loginId: canvasLoginId ?? feide.feideId ?? '',
    };
    return { key, feideId: feide.feideId ?? '', canvas };
  };
  const deepLinkAccount = async (user: CanvasUser, custom: Record<string, string> = FEIDE_LOGIN) => {
    const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
      messageType: 'LtiDeepLinkingRequest',
      user,
      custom,
    });
    return (await tb.lti.resolveLtik(run.ltik ?? '')).principal.userId;
  };
  const feideAccount = async (feideId: string) => {
    const hashes = hasher.candidates('identity-subject', identitySource({ kind: 'feide', feideId }));
    const row = await tb.db.identity.findFirst({
      where: { provider: 'feide', subjectHash: { in: hashes.map((c) => c.hash) } },
    });
    return row?.userId;
  };
  const audited = (event: string, reason: string, userId: string) =>
    tb.db.authAuditEvent.count({ where: { event, reason, actorUserId: userId } });

  it('[AUTH-005] a first Deep Linking launch joins the account the teacher already has from Feide', async () => {
    // Arrange: the teacher logged in to the portal first
    const p = person();
    await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, p.key);
    const portalAccount = await feideAccount(p.feideId);
    // Act
    const ltiAccount = await deepLinkAccount(p.canvas);
    // Assert
    expect(portalAccount).toBeDefined();
    expect(ltiAccount).toBe(portalAccount);
    expect(await audited('link.feide-lti', 'link-joined', ltiAccount)).toBe(1);
  });

  it('[AUTH-005] a teacher who starts in Canvas finds the same account at the first Feide login', async () => {
    // Arrange
    const p = person();
    const ltiAccount = await deepLinkAccount(p.canvas);
    // Act
    await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, p.key);
    // Assert
    expect(await feideAccount(p.feideId)).toBe(ltiAccount);
  });

  it('[AUTH-005] an existing Canvas account that owns nothing moves to the Feide account', async () => {
    // Arrange: a Canvas account made before linking (no feide_login), and a separate portal account
    const p = person();
    const before = await deepLinkAccount(p.canvas, {});
    await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, p.key);
    const portalAccount = await feideAccount(p.feideId);
    // Act
    const after = await deepLinkAccount(p.canvas);
    // Assert
    expect(portalAccount).not.toBe(before);
    expect(after).toBe(portalAccount);
  });

  it('[AUTH-005] a Canvas account that owns content is not moved; the conflict is audited', async () => {
    // Arrange
    const p = person();
    const canvasAccount = await deepLinkAccount(p.canvas, {});
    await tb.activity(canvasAccount, { published: true });
    await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, p.key);
    // Act
    const after = await deepLinkAccount(p.canvas);
    // Assert
    expect(after).toBe(canvasAccount);
    expect(await feideAccount(p.feideId)).not.toBe(canvasAccount);
    expect(await audited('link.conflict', 'lti-account-owns-content', canvasAccount)).toBe(1);
  });

  it('[AUTH-005] a login ID Canvas could not expand (`$Canvas.user.loginId`) links nothing', async () => {
    // Arrange: a Canvas user without a login ID, so the variable reaches the tool unexpanded
    const p = person();
    const canvas: CanvasUser = { sub: p.canvas.sub, roles: p.canvas.roles };
    // Act
    await deepLinkAccount(canvas);
    // Assert
    expect(await feideAccount(p.feideId)).toBeUndefined();
  });

  it('[AUTH-005] `feide_login` is never stored with the launch', async () => {
    // Act
    const started = new Date(Date.now() - 1000);
    const p = person();
    await deepLinkAccount(p.canvas);
    // Assert
    const stored = await tb.db.ltiIdToken.findMany({ where: { createdAt: { gte: started } } });
    expect(stored.length).toBeGreaterThan(0);
    expect(JSON.stringify(stored.map((row) => row.claims))).not.toContain(p.feideId);
  });
});
