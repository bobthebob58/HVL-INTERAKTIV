/**
 * Tests that an insight view and a CSV download are audited before anything is sent (DATA-007, INS-007): when the
 * audit event cannot be written the person gets a 500 and none of the view, so there is never an unaudited view; the
 * contexts and findings, which are not about learners, are not audited.
 *
 * Spec: DATA-007, INS-007, INS-009
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { QUESTION_SET } from '../fixtures/insightActivities.js';
import { questionSetRows } from '../fixtures/thirtyLearners.js';
import { reportOf } from '../support/insightFixtureReport.js';
import { insightStubApp } from './support/insightStubApp.js';

const CONTENT = '0190f5d2-0000-7000-8000-000000000001';
const BASE = `/api/content/${CONTENT}/insight`;

describe('[DATA-007] insight is audited before it is sent', () => {
  it('[DATA-007] a view and a download whose event cannot be written fail with 500 and show nothing', async () => {
    // Arrange
    const report = reportOf(QUESTION_SET, questionSetRows());
    const { app } = insightStubApp(report, { auditFails: true });
    // Act
    const view = await request(app).get(BASE);
    const csv = await request(app).get(`${BASE}/export`);
    // Assert
    for (const res of [view, csv]) {
      expect(res.status).toBe(500);
      expect(res.body.errorCode).toBe('internal');
      expect(res.headers['content-disposition']).toBeUndefined();
      expect(res.text).not.toContain(report.scope.periodStart);
      expect(res.text).not.toContain('participation');
    }
  });

  it('[DATA-007] each view and download writes its own event, and the contexts route writes none', async () => {
    // Arrange
    const { app, audited } = insightStubApp(reportOf(QUESTION_SET, questionSetRows()));
    // Act
    const answers = [
      await request(app).get(`${BASE}?period=14d`),
      await request(app).get(`${BASE}/export`),
      await request(app).get(`${BASE}/contexts`),
    ];
    // Assert
    expect(answers.map((res) => res.status)).toEqual([200, 200, 200]);
    expect(audited).toEqual([
      expect.objectContaining({ action: 'insight.view', targetType: 'H5PContent' }),
      expect.objectContaining({ action: 'insight.export', targetType: 'H5PContent' }),
    ]);
  });
});
