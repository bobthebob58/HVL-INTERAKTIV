/**
 * Integration tests of the insight view and its CSV export on PostgreSQL: the answer is the core's report, untouched
 * and within the contract; the query takes only fixed periods, a version and a context; every view and download is
 * audited with the four details D-106 allows; the CSV carries the same suppression and a file name without personal
 * data; the per-person limit answers 429; and an app that has not wired insight refuses.
 *
 * Spec: PROD-010, INS-001, INS-006, INS-007, INS-009, DATA-007, PROD-013
 */
import { insightReportSchema } from '@hvl-interaktiv/api-contract';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { Principal } from '../../../src/auth/Principal.js';
import { INSIGHT_EXPORT_ACTION, INSIGHT_VIEW_ACTION } from '../../../src/insight/http/insightAudit.js';
import type { PersonLimit } from '../../../src/learningDesign/collaboration/PersonRateLimit.js';
import { describeWithServices } from '../../support/services.js';
import { cellsIn } from '../support/reportInvariants.js';
import { parseCsv } from './support/csvRecords.js';
import { openInsightHttpBench, portalPrincipal, type InsightHttpBench } from './support/insightHttpBench.js';

describeWithServices('[INS-001] the insight view and its CSV through the API', () => {
  let bench: InsightHttpBench;
  let owner: Principal;
  const get = (path: string, principal: Principal | undefined = owner, options = {}) =>
    request(bench.appAs(principal, options)).get(`/api/content/${bench.contentId}/insight${path}`);
  const auditOf = () =>
    bench.db.auditEvent.findMany({
      where: { targetId: bench.contentId, action: { startsWith: 'insight.' } },
      orderBy: { at: 'asc' },
    });

  beforeAll(async () => {
    bench = await openInsightHttpBench();
    owner = portalPrincipal(bench.ownerId);
  }, 60_000);
  beforeEach(() => bench.db.auditEvent.deleteMany({ where: { targetId: bench.contentId } }));
  afterAll(() => bench.close());

  it('[PROD-010] an author gets the activity’s aggregated view: the core’s report, within the contract, no learner', async () => {
    // Act
    const res = await get(`?context=${bench.fx.courseA}`);
    const core = await bench.insight.forActivity({ contentId: bench.contentId, context: bench.fx.courseA });
    // Assert
    expect(res.status).toBe(200);
    expect(insightReportSchema.parse(res.body)).toEqual(JSON.parse(JSON.stringify(core)));
    expect(JSON.stringify(res.body)).not.toMatch(/fixture-learner|learnerKey|attemptId/);
  });

  it('[PROD-013] a version from 1 up to the current one and a fixed period are taken; anything else is 400', async () => {
    // Act
    const older = await get(`?version=1&period=14d&context=${bench.fx.courseA}`);
    const queries = [
      '?version=3',
      '?version=0',
      '?version=abc',
      '?period=60d',
      '?period=2026-10-01',
      '?since=2026-10-01',
      '?period=7d&period=14d',
    ];
    const refused = await Promise.all(queries.map((query) => get(query)));
    // Assert
    expect(older.status).toBe(200);
    expect(older.body.scope).toMatchObject({ contentVersion: 1, currentVersion: 2, period: '14d' });
    refused.forEach((res, i) => {
      expect(res.status, queries[i]).toBe(400);
      expect(res.body.errorCode, queries[i]).toBe('error.badRequest');
    });
  });

  it('[DATA-007] a view and a download each write one event with only the view, period, context and version', async () => {
    // Act
    await get(`?period=30d&context=${bench.fx.courseA}`);
    await get(`/export?version=1`);
    await get('/contexts');
    await get('/findings');
    await get('?version=9');
    await get('', portalPrincipal(bench.colleagueId));
    // Assert
    const events = await auditOf();
    expect(
      events.map(({ action, actorUserId, targetType, details }) => ({
        action,
        actorUserId,
        targetType,
        details,
      })),
    ).toEqual([
      {
        action: INSIGHT_VIEW_ACTION,
        actorUserId: bench.ownerId,
        targetType: 'H5PContent',
        details: { view: 'beforeSession', period: '30d', context: bench.fx.courseA, contentVersion: 2 },
      },
      {
        action: INSIGHT_EXPORT_ACTION,
        actorUserId: bench.ownerId,
        targetType: 'H5PContent',
        details: { view: 'beforeSession', period: '7d', context: 'portal', contentVersion: 1 },
      },
    ]);
  });

  it('[INS-009] the CSV is the same view as a UTF-8 file: same suppression, the formative note, a plain file name', async () => {
    // Act
    const view = await get(`?context=${bench.fx.courseA}`);
    const csv = await get(`/export?context=${bench.fx.courseA}`);
    // Assert
    const text = csv.text;
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(csv.headers['content-disposition']).toBe('attachment; filename="innsikt-7d-2026-11-04.csv"');
    expect(csv.headers['cache-control']).toBe('no-store');
    expect(text.startsWith('﻿Del,Spørsmål-ID,Nr. eller sekund,Tekst,Mål,Verdi\r\n')).toBe(true);
    expect(text).toContain('ikkje for eksamen eller karakterar');
    const records = parseCsv(text.slice(1));
    expect(records.every((record) => record.length === 6)).toBe(true);
    const hidden = cellsIn(view.body).filter((cell) => cell.suppressed).length;
    expect(records.filter((record) => record[5] === '< 5')).toHaveLength(hidden);
    expect(text).not.toContain('fixture-learner');
  });

  it('[INS-009] the CSV speaks the person’s language, also in its file name', async () => {
    // Act
    const res = await get('/export', { ...owner, locale: 'en' });
    // Assert
    expect(res.headers['content-disposition']).toBe('attachment; filename="insight-7d-2026-11-04.csv"');
    expect(res.text.split('\r\n')[0]).toBe('﻿Section,Question ID,No. or second,Text,Measure,Value');
  });

  it('[INS-007] past the per-person limit every route is 429 with Retry-After; a refused person is never counted', async () => {
    // Arrange
    let taken = 0;
    const full: PersonLimit = {
      take: async () => {
        taken += 1;
        return { allowed: false, retryAfterSeconds: 42 };
      },
    };
    // Act
    const limited = await Promise.all(
      ['', '/contexts', '/export', '/findings'].map((path) => get(path, owner, { limit: full })),
    );
    const refused = await get('', portalPrincipal(bench.colleagueId), { limit: full });
    // Assert
    for (const res of limited) {
      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBe('42');
      expect(res.body.errorCode).toBe('hvl:rate-limited');
    }
    expect(refused.status).toBe(403);
    expect(taken).toBe(4);
    expect(await auditOf()).toEqual([]);
  });

  it('[INS-007] an app that has not wired the insight services fails closed with 500 after the access check', async () => {
    // Act
    const unwired = await get('', owner, { services: null });
    const nobody = await request(bench.appAs(undefined, { services: null })).get(
      `/api/content/${bench.contentId}/insight`,
    );
    const colleague = await get('', portalPrincipal(bench.colleagueId), { services: null });
    const malformed = await request(bench.appAs(owner, { services: null })).get(
      '/api/content/not-a-uuid/insight',
    );
    // Assert
    expect([unwired.status, nobody.status, colleague.status, malformed.status]).toEqual([500, 401, 403, 404]);
    expect(unwired.body.errorCode).toBe('internal');
  });
});
