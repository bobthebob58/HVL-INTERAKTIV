/**
 * Integration tests for the authentication audit trail: fixed codes, a hashed address and no failure propagation.
 *
 * Spec: DATA-007, AUTH-001
 */
import { afterAll, expect, it } from 'vitest';
import { AuthAuditRecorder } from '../../../src/auth/audit/AuthAuditRecorder.js';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { capturedLogger } from '../../support/capturedLogger.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';

describeWithServices('[DATA-007] authentication audit trail', () => {
  const env = serviceEnv();
  const db = createPrismaClient(env.DATABASE_URL);
  const hasher = new IdentityHasher(env.IDENTITY_HASH_KEYS);
  const { logger, lines } = capturedLogger('error');
  afterAll(() => db.$disconnect());

  it('[DATA-007] stores the event, reason and a keyed hash of the address, never the address', async () => {
    // Arrange
    const recorder = new AuthAuditRecorder({ db, hasher, logger });
    const actorUserId = crypto.randomUUID();
    // Act
    await recorder.record({
      event: 'login.feide.failed',
      reason: 'no-feide-id',
      ip: '203.0.113.7',
      actorUserId,
    });
    // Assert
    const row = await db.authAuditEvent.findFirstOrThrow({ where: { actorUserId } });
    expect(row).toMatchObject({ event: 'login.feide.failed', reason: 'no-feide-id' });
    expect(row.ipHash).toBe(hasher.hash('auth-audit-ip', '203.0.113.7').hash);
    expect(row.ipKeyId).toBe(env.IDENTITY_HASH_KEYS.current.id);
    expect(JSON.stringify(row)).not.toContain('203.0.113.7');
    await db.authAuditEvent.delete({ where: { id: row.id } });
  });

  it('[AUTH-001] logs, but never throws, when the database refuses the write', async () => {
    // Arrange
    const broken = { authAuditEvent: { create: () => Promise.reject(new Error('db down')) } };
    const recorder = new AuthAuditRecorder({ db: broken as unknown as typeof db, hasher, logger });
    // Act
    await expect(recorder.record({ event: 'logout', ip: '198.51.100.1' })).resolves.toBeUndefined();
    // Assert
    expect(lines.join('')).toContain('auth audit event not recorded');
    expect(lines.join('')).not.toContain('198.51.100.1');
  });
});
