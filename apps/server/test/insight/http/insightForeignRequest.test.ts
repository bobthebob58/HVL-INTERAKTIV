/**
 * Tests that another site, or a path an author sets in an activity, cannot write the insight audit trail (DATA-007,
 * INS-009, D-106's amendment of 2026-11-05): a browser's top-level navigation, a request it marks as sent from
 * another origin, and an image, video, frame or prefetch that a page of our own origin loads are refused with 403
 * before any audit event is written or the rate limit is taken, while our pages' same-origin fetches and clients
 * without fetch metadata are served and audited as before. The headers are those full Chromium sends.
 *
 * Spec: DATA-007, INS-009, INS-007
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { PersonLimit } from '../../../src/learningDesign/collaboration/PersonRateLimit.js';
import { QUESTION_SET } from '../fixtures/insightActivities.js';
import { questionSetRows } from '../fixtures/thirtyLearners.js';
import { reportOf } from '../support/insightFixtureReport.js';
import { insightStubApp } from './support/insightStubApp.js';

const CONTENT = '0190f5d2-0000-7000-8000-000000000001';
const BASE = `/api/content/${CONTENT}/insight`;

/** What a browser sends when a page on another site sets `location` to the URL. */
const CROSS_SITE_NAVIGATION = {
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
};

/** What a browser sends for our own pages' `fetch` (the web client's `apiRequest`). */
const SAME_ORIGIN_FETCH = {
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
};

/** The insight app with a limit that counts its takes. */
function countingApp() {
  const takes: string[] = [];
  const limit: PersonLimit = {
    take: async (userId) => {
      takes.push(userId);
      return { allowed: true };
    },
  };
  return { ...insightStubApp(reportOf(QUESTION_SET, questionSetRows()), { limit }), takes };
}

describe('[DATA-007] another site cannot write the insight audit trail', () => {
  it('[DATA-007] a cross-site navigation to any insight route is 403, audits nothing and takes no limit', async () => {
    // Arrange
    const { app, audited, takes } = countingApp();
    // Act
    const answers = [];
    for (const route of ['', '/export?period=semester', '/contexts', '/findings']) {
      answers.push(await request(app).get(`${BASE}${route}`).set(CROSS_SITE_NAVIGATION));
    }
    // Assert
    for (const res of answers) {
      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('error.forbidden');
      expect(res.headers['content-disposition']).toBeUndefined();
    }
    expect(audited).toEqual([]);
    expect(takes).toEqual([]);
  });

  it('[DATA-007] a same-site fetch, a typed URL and a same-origin navigation are refused too', async () => {
    // Arrange
    const { app, audited, takes } = countingApp();
    const requests = [
      { 'Sec-Fetch-Site': 'same-site', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Dest': 'image' },
      { 'Sec-Fetch-Site': 'none', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' },
      { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' },
    ];
    // Act
    const answers = [];
    for (const headers of requests) {
      answers.push(await request(app).get(BASE).set(headers));
      answers.push(await request(app).get(`${BASE}/export`).set(headers));
    }
    // Assert
    expect(answers.map((res) => res.status)).toEqual([403, 403, 403, 403, 403, 403]);
    expect(audited).toEqual([]);
    expect(takes).toEqual([]);
  });

  it('[DATA-007] an image, video, frame or prefetch our own page loads (a path in authored content) is refused', async () => {
    // Arrange: what full Chromium sends for `<img>`, `<video>`, `<iframe>` and `<link rel=prefetch>` on a page of our
    // origin, e.g. an H5P image whose path an author set to this URL (H5P plays an absolute path as it is).
    const { app, audited, takes } = countingApp();
    const requests = [
      { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Dest': 'image' },
      { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Dest': 'video' },
      { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'iframe' },
      { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Dest': 'empty' },
    ];
    // Act
    const answers = [];
    for (const headers of requests) {
      answers.push(await request(app).get(BASE).set(headers));
      answers.push(await request(app).get(`${BASE}/export?period=semester`).set(headers));
    }
    // Assert
    expect(answers.map((res) => res.status)).toEqual(Array.from({ length: 8 }, () => 403));
    expect(audited).toEqual([]);
    expect(takes).toEqual([]);
  });

  it('[INS-009] our pages’ fetch and a client without fetch metadata get the view and the CSV, audited', async () => {
    // Arrange
    const { app, audited, takes } = countingApp();
    // Act
    const answers = [
      await request(app).get(BASE).set(SAME_ORIGIN_FETCH),
      await request(app).get(`${BASE}/export`).set(SAME_ORIGIN_FETCH),
      await request(app).get(`${BASE}/export`),
    ];
    // Assert
    expect(answers.map((res) => res.status)).toEqual([200, 200, 200]);
    expect(answers[1]?.headers['content-type']).toMatch(/^text\/csv/);
    expect(audited).toEqual([
      expect.objectContaining({ action: 'insight.view' }),
      expect.objectContaining({ action: 'insight.export' }),
      expect.objectContaining({ action: 'insight.export' }),
    ]);
    expect(takes).toHaveLength(3);
  });
});
