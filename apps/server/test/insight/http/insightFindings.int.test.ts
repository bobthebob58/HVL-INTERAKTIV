/**
 * Integration tests of INS-010 on PostgreSQL: insight shows the stored activity's current validator findings and the
 * acknowledgements that cover them to everyone who may see its insight, with an acknowledgement's reason only for
 * those who may edit, and nothing is audited for it.
 *
 * Spec: INS-010, UD-022, PROD-003
 */
import { insightFindingsResponseSchema } from '@hvl-interaktiv/api-contract';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Principal } from '../../../src/auth/Principal.js';
import { altError, colourHint, DAY, findingsOnly } from '../../support/publishFixtures.js';
import { describeWithServices } from '../../support/services.js';
import { FIXTURE_NOW } from '../fixtures/thirtyLearners.js';
import {
  canvasPrincipal,
  openInsightHttpBench,
  portalPrincipal,
  type InsightHttpBench,
} from './support/insightHttpBench.js';

const REASON = 'Biletet er pynt; teksten kjem i neste versjon.';

describeWithServices('[INS-010] validator findings in insight', () => {
  let bench: InsightHttpBench;
  const findings = (principal: Principal) =>
    request(bench.appAs(principal, { validator: findingsOnly(altError, colourHint) })).get(
      `/api/content/${bench.contentId}/insight/findings`,
    );

  beforeAll(async () => {
    bench = await openInsightHttpBench();
    await bench.db.validationAcknowledgement.create({
      data: {
        contentId: bench.contentId,
        ruleId: altError.ruleId,
        path: altError.path,
        reason: REASON,
        userId: bench.ownerId,
        at: new Date(FIXTURE_NOW.getTime() - DAY),
      },
    });
  }, 60_000);
  afterAll(() => bench.close());

  it('[INS-010] the owner sees each current finding with the acknowledgement that covers it and its reason', async () => {
    // Act
    const res = await findings(portalPrincipal(bench.ownerId));
    // Assert
    expect(res.status).toBe(200);
    const body = insightFindingsResponseSchema.parse(res.body);
    expect(
      body.findings.map(({ ruleId, severity, acknowledgement }) => [ruleId, severity, acknowledgement]),
    ).toEqual([
      [
        'V-IMG-ALT',
        'error',
        {
          reason: REASON,
          at: new Date(FIXTURE_NOW.getTime() - DAY).toISOString(),
          expiresAt: new Date(FIXTURE_NOW.getTime() + 13 * DAY).toISOString(),
        },
      ],
      ['V-COLOUR-WORDS', 'hint', null],
    ]);
  });

  it('[INS-010] a Canvas teacher who may not edit sees the same findings and that an error is acknowledged, not why', async () => {
    // Arrange
    const teacher = canvasPrincipal(bench.colleagueId, {
      platformId: bench.platformId,
      contextId: 'A',
      contentId: bench.contentId,
    });
    // Act
    const owner = (await findings(portalPrincipal(bench.ownerId))).body;
    const res = await findings(teacher);
    // Assert
    expect(res.status).toBe(200);
    const body = insightFindingsResponseSchema.parse(res.body);
    expect(body.findings[0]?.acknowledgement).toEqual({ ...owner.findings[0].acknowledgement, reason: null });
    expect(body.findings[1]).toEqual(owner.findings[1]);
    expect(JSON.stringify(res.body)).not.toContain('Biletet er pynt');
    expect(JSON.stringify(res.body)).not.toContain(bench.ownerId);
  });

  it('[INS-010] the findings are not about learners and are not audited; refused readers get none', async () => {
    // Act
    const colleague = await findings(portalPrincipal(bench.colleagueId));
    const learner = await findings(portalPrincipal(bench.colleagueId, ['learner']));
    // Assert
    expect([colleague.status, learner.status]).toEqual([403, 403]);
    expect(await bench.db.auditEvent.count({ where: { targetId: bench.contentId } })).toBe(0);
  });
});
