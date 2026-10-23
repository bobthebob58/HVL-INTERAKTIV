/**
 * Integration tests for resolving an ltik into a principal: the checks ltijs does not make (an inactive platform,
 * a removed deployment), the roles an LTI principal may hold, and the same answer for every failure.
 *
 * Spec: LTI-003, LTI-004, LTI-001
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, LTI_ROLE } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { isAuthError } from '../../src/http/authErrors.js';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('[LTI-003] ltik → principal', () => {
  let tb: AppTestbed;
  let published: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    published = await tb.activity(await tb.staffAccount(), { published: true });
  }, 60_000);
  afterAll(() => tb.close());

  const launch = async (roles: readonly string[] = CANVAS_USERS.student.roles) => {
    const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
      user: { sub: `user-${Math.random()}`, roles },
      custom: { contentId: published },
    });
    return run.ltik ?? '';
  };
  const refusal = (ltik: string) =>
    tb.lti.resolveLtik(ltik).then(
      () => 'accepted',
      (error: unknown) => (isAuthError(error, 'hvl:ltik-invalid') ? 'ltik-invalid' : String(error)),
    );

  it('[LTI-003] a valid ltik resolves to a sealed LTI principal of its launch', async () => {
    const { principal } = await tb.lti.resolveLtik(await launch());
    expect(principal.mode).toBe('lti');
    expect(principal.lti?.contentId).toBe(published);
    expect(principal.hvlMember).toBe(false);
    expect(Object.isFrozen(principal)).toBe(true);
  });

  it('[LTI-004] an LTI administrator becomes an author at most, never an admin', async () => {
    const ltik = await launch([LTI_ROLE.administrator, LTI_ROLE.instructor]);
    const { principal } = await tb.lti.resolveLtik(ltik);
    expect(principal.roles).not.toContain('admin');
    expect(principal.roles).toContain('author');
  });

  it('[LTI-003] the ltik stops working at once when the platform is deactivated (D-050)', async () => {
    // Arrange
    const ltik = await launch();
    const platform = await tb.lti.provider.platformManager.getPlatformById(tb.platformId);
    if (!platform) throw new Error('platform missing');
    // Act
    await tb.lti.provider.platformManager.deactivatePlatform(platform);
    const answer = await refusal(ltik);
    await tb.lti.provider.platformManager.updatePlatform(platform, { active: true });
    // Assert
    expect(answer).toBe('ltik-invalid');
    expect(await refusal(ltik)).toBe('accepted');
  });

  it('[LTI-003] the ltik stops working at once when its deployment is removed (D-051)', async () => {
    // Arrange
    const ltik = await launch();
    const deployment = { platformId: tb.platformId, deploymentId: tb.mock.canvas.deploymentId };
    // Act
    await tb.db.ltiDeployment.deleteMany({ where: deployment });
    const answer = await refusal(ltik);
    await tb.db.ltiDeployment.create({ data: deployment });
    // Assert
    expect(answer).toBe('ltik-invalid');
  });

  it('[LTI-003] a forged, truncated or empty ltik gets the same answer', async () => {
    const ltik = await launch();
    const [header, payload] = ltik.split('.');
    const answers = await Promise.all(
      [`${header}.${payload}.AAAA`, ltik.slice(0, -4), '', 'x'].map((value) => refusal(value)),
    );
    expect(answers).toEqual(['ltik-invalid', 'ltik-invalid', 'ltik-invalid', 'ltik-invalid']);
  });

  it('[LTI-003] the ltik of an account that no longer exists is refused', async () => {
    // Arrange
    const ltik = await launch();
    const { principal } = await tb.lti.resolveLtik(ltik);
    // Act
    await tb.db.user.delete({ where: { id: principal.userId } });
    // Assert
    expect(await refusal(ltik)).toBe('ltik-invalid');
  });
});
