/**
 * Integration tests for the deployment guard: only the `(platform, deployment)` pairs in `LtiDeployment` may launch.
 *
 * Spec: LTI-001, LTI-002
 */
import { randomUUID } from 'node:crypto';
import { afterAll, expect, it, vi } from 'vitest';
import { HttpError } from '../../../src/http/HttpError.js';
import { isAuthError } from '../../../src/http/authErrors.js';
import { LtiDeploymentGuard } from '../../../src/lti/platforms/LtiDeploymentGuard.js';
import { describeWithServices } from '../../support/services.js';
import { createLtiStorageTestbed } from './ltiStorageTestbed.js';

describeWithServices('[LTI-001] LtiDeploymentGuard', () => {
  const bed = createLtiStorageTestbed();
  afterAll(() => bed.close());

  it('[LTI-001] allows exactly the deployments configured for each platform', async () => {
    // Arrange
    const [canvas, other] = [await bed.createPlatform(['d-1', 'd-2']), await bed.createPlatform(['d-3'])];
    const guard = new LtiDeploymentGuard(bed.db);
    // Act
    const answers = await Promise.all([
      guard.isAllowed(canvas.id, 'd-1'),
      guard.isAllowed(canvas.id, 'd-2'),
      guard.isAllowed(canvas.id, 'd-3'),
      guard.isAllowed(other.id, 'd-1'),
      guard.isAllowed(canvas.id, 'D-1'),
      guard.isAllowed(randomUUID(), 'd-1'),
    ]);
    // Assert
    expect(answers).toEqual([true, true, false, false, false, false]);
  });

  it('[LTI-001] refuses a missing or malformed ID without asking the database', async () => {
    // Arrange
    const findUnique = vi.fn();
    const guard = new LtiDeploymentGuard({ ltiDeployment: { findUnique } } as never);
    const platformId = randomUUID();
    // Act
    const answers = await Promise.all([
      guard.isAllowed(platformId, ''),
      guard.isAllowed(platformId, undefined as never),
      guard.isAllowed('not-a-uuid', 'd-1'),
      guard.isAllowed(undefined as never, 'd-1'),
    ]);
    // Assert
    expect(answers).toEqual([false, false, false, false]);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('[LTI-001] assertAllowed throws hvl:deployment-not-allowed (403) naming neither ID', async () => {
    // Arrange
    const canvas = await bed.createPlatform(['d-1']);
    const guard = new LtiDeploymentGuard(bed.db);
    // Act
    const refusal = await guard
      .assertAllowed(canvas.id, 'secret-deployment')
      .catch((error: unknown) => error);
    // Assert
    await expect(guard.assertAllowed(canvas.id, 'd-1')).resolves.toBeUndefined();
    expect(isAuthError(refusal, 'hvl:deployment-not-allowed')).toBe(true);
    expect((refusal as HttpError).status).toBe(403);
    expect(JSON.stringify(refusal) + String(refusal)).not.toMatch(
      new RegExp(`secret-deployment|${canvas.id}`),
    );
  });
});
