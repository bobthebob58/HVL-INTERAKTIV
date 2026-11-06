/**
 * Integration test for forgetting ltijs's cached NRPS token on PostgreSQL: after a 401 exactly the token of that
 * platform URL, client ID and NRPS scope goes; another scope's token and other platforms' tokens stay, and a token
 * that is already gone is no error.
 *
 * Spec: LTI-008
 */
import { afterAll, expect, it } from 'vitest';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { forgetNrpsToken, NRPS_SCOPE } from '../../../src/lti/nrps/nrpsTokenCache.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

const AGS_SCORE_SCOPE = 'https://purl.imsglobal.org/spec/lti-ags/scope/score';

describeWithServices('[LTI-008] forgetting a refused NRPS token', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const url = `https://${uniqueName('nrps-token')}.platform.test`;
  const otherUrl = `https://${uniqueName('nrps-token-other')}.platform.test`;
  const clientId = 'client-a';

  afterAll(async () => {
    await db.ltiAccessToken.deleteMany({ where: { platformUrl: { in: [url, otherUrl] } } });
    await db.$disconnect();
  });

  it('[LTI-008] deletes only the NRPS token of that platform and client; other scopes and platforms keep theirs', async () => {
    // Arrange: the token to forget, and three neighbours that differ in one part of the cache key each
    const row = { tokenEncrypted: new Uint8Array([1]), expiresAt: new Date(Date.now() + 3_600_000) };
    await db.ltiAccessToken.createMany({
      data: [
        { ...row, platformUrl: url, clientId, scopes: NRPS_SCOPE },
        { ...row, platformUrl: url, clientId, scopes: AGS_SCORE_SCOPE },
        { ...row, platformUrl: url, clientId: 'client-b', scopes: NRPS_SCOPE },
        { ...row, platformUrl: otherUrl, clientId, scopes: NRPS_SCOPE },
      ],
    });
    const forget = forgetNrpsToken(db);
    // Act: twice, as two nodes might
    await forget({ url, clientId });
    await forget({ url, clientId });
    // Assert
    const left = await db.ltiAccessToken.findMany({
      where: { platformUrl: { in: [url, otherUrl] } },
      select: { platformUrl: true, clientId: true, scopes: true },
    });
    expect(left).toHaveLength(3);
    expect(left).toEqual(
      expect.arrayContaining([
        { platformUrl: url, clientId, scopes: AGS_SCORE_SCOPE },
        { platformUrl: url, clientId: 'client-b', scopes: NRPS_SCOPE },
        { platformUrl: otherUrl, clientId, scopes: NRPS_SCOPE },
      ]),
    );
  });
});
